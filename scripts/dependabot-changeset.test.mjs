import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("writer rejects a spoofed Dependabot author through its command entrypoint", () => {
  const bootstrap = `globalThis.fetch=async()=>Response.json({user:{login:'dependabot[bot]',type:'User'}});`;
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      `data:text/javascript,${encodeURIComponent(bootstrap)}`,
      "scripts/dependabot-changeset.mjs",
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        GITHUB_REPOSITORY: "Pocket-Trash/pocket-trash",
        PR_NUMBER: "1",
        GITHUB_TOKEN: "fixture-secret",
      },
    },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /actual Dependabot/);
  assert.ok(!result.stderr.includes("fixture-secret"));
});

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Drives the real writer command against a fake GitHub API and records writes.
 * @param t - Test lifecycle.
 * @param mode - GitHub scenario.
 * @returns Command result and observed requests.
 */
function scenario(t, mode) {
  const directory = mkdtempSync(join(tmpdir(), "dependabot-writer-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const log = join(directory, "requests.json");
  const bootstrap = `
    import {writeFileSync} from 'node:fs';
    const mode=process.env.WRITER_CASE,calls=[];let reads=0;
    const repo='Pocket-Trash/pocket-trash',head='a'.repeat(40),base='b'.repeat(40);
    const marker='---\\n"@app/web": patch\\n---\\n\\nRefresh compatible dependencies.\\n';
    const pull={state:'open',user:{login:'dependabot[bot]',type:'Bot'},base:{ref:'main',sha:base,repo:{id:1,full_name:repo}},head:{ref:'dependabot/npm_and_yarn/example',sha:head,repo:{id:1,full_name:repo,fork:false}}};
    if(mode==='fork')pull.head.repo.fork=true;
    if(mode==='missingRepoId'){delete pull.base.repo.id;delete pull.head.repo.id;}
    if(mode==='wrongRepo')pull.head.repo.full_name='someone/fork';
    if(mode==='wrongBase')pull.base.ref='release';
    if(mode==='wrongAuthor')pull.user.login='someone';
    if(mode==='rebasedMarker')pull.head.sha='c'.repeat(40);
    globalThis.fetch=async(url,options)=>{
      if(!url.startsWith('https://api.github.com/repos/'+repo+'/'))throw new Error('Unexpected API host');
      const u=new URL(url),p=u.pathname.slice(('/repos/'+repo).length),method=options.method||'GET';
      const body=options.body&&JSON.parse(options.body);calls.push({path:p,method,body});
      writeFileSync(process.env.WRITER_LOG,JSON.stringify(calls));
      if(mode==='refConflict'&&method==='PATCH')return new Response(null,{status:422});
      if(mode==='apiFailure')return new Response(null,{status:403});
      if(p==='/pulls/1')return Response.json(mode==='stale'&&reads++>0?{...pull,head:{...pull.head,sha:'c'.repeat(40)}}:pull);
      if(p==='/pulls/1/files'){
        let files=mode==='lockOnly'?[{filename:'pnpm-lock.yaml',status:'modified'}]:[{filename:mode==='root'?'package.json':'apps/web/package.json',status:'modified'}];
        if(mode==='path')files.push({filename:'.github/workflows/ci.yml',status:'modified'});
        if(mode==='humanMarker'||mode==='humanMajor')files.push({filename:'.changeset/human.md',status:'added'});
        if(mode==='generatedMarker'||mode==='rebasedMarker')files.push({filename:'.changeset/dependabot-1.md',status:'added'});
        return Response.json(files);
      }
      if(p.startsWith('/contents/')){
        const name=decodeURIComponent(p.slice('/contents/'.length));let text;
        if(name.startsWith('.changeset/'))text=mode==='rebasedMarker'?marker.replace('@app/web','@app/api'):marker;
        else { const manifest={name:mode==='root'?'pocket-trash.app':'@app/web',dependencies:{example:u.searchParams.get('ref')===base?(mode==='preOne'?'0.1.0':'1.2.3'):mode==='preOne'?'0.2.0':mode==='unsafeVersion'?'9007199254740992.1.0':mode==='major'||mode==='humanMajor'?'2.0.0':mode==='unknownVersion'?'latest':mode==='patch'?'1.2.4':'1.3.0'}};
          if(u.searchParams.get('ref')!==base&&mode==='unrelatedManifest')manifest.scripts={install:'unsafe'};
          if(u.searchParams.get('ref')!==base&&mode==='removeDependency')manifest.dependencies={};
          text=JSON.stringify(manifest);
        }
        return Response.json({encoding:'base64',content:Buffer.from(text).toString('base64')});
      }
      if(p==='/pulls/1/commits')return Response.json([{author:{login:mode==='humanCommit'?'maintainer':'dependabot[bot]'},commit:{message:'Bump example'}}]);
      if(method==='GET'&&p.startsWith('/git/commits/'))return Response.json({tree:{sha:'d'.repeat(40)}});
      if(p==='/git/blobs')return Response.json({sha:mode==='badGitObject'?'invalid':'e'.repeat(40)});
      if(p==='/git/trees')return Response.json({sha:'f'.repeat(40)});
      if(p==='/git/commits')return Response.json({sha:'1'.repeat(40)});
      if(method==='PATCH'&&p.startsWith('/git/refs/heads/'))return Response.json({object:{sha:'1'.repeat(40)}});
      throw new Error('Unexpected API request '+method+' '+p);
    };
  `;
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      `data:text/javascript,${encodeURIComponent(bootstrap)}`,
      "scripts/dependabot-changeset.mjs",
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        GITHUB_REPOSITORY: "Pocket-Trash/pocket-trash",
        PR_NUMBER: "1",
        GITHUB_TOKEN: "fixture-secret",
        WRITER_CASE: mode,
        WRITER_LOG: log,
      },
    },
  );
  const calls = JSON.parse(readFileSync(log, "utf8"));
  assert.ok(!result.stderr.includes("fixture-secret"));
  return { result, calls };
}

test("writer creates only a deterministic patch marker with a non-forcing head lease", (t) => {
  const { result, calls } = scenario(t, "valid");
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(calls.find((c) => c.path === "/git/trees").body.tree, [
    {
      path: ".changeset/dependabot-1.md",
      mode: "100644",
      type: "blob",
      sha: "e".repeat(40),
    },
  ]);
  assert.deepEqual(calls.at(-1).body, { sha: "1".repeat(40), force: false });
  assert.deepEqual(
    calls.find((c) => c.method === "POST" && c.path === "/git/commits").body
      .parents,
    ["a".repeat(40)],
  );
  assert.match(
    calls.find((c) => c.path === "/git/commits" && c.method === "POST").body
      .message,
    /\[dependabot skip\]/,
  );
});

for (const mode of [
  "fork",
  "wrongRepo",
  "wrongBase",
  "wrongAuthor",
  "path",
  "lockOnly",
  "major",
  "unknownVersion",
  "unrelatedManifest",
  "removeDependency",
  "humanCommit",
  "stale",
  "apiFailure",
  "badGitObject",
  "preOne",
  "unsafeVersion",
  "missingRepoId",
]) {
  test(`writer blocks ${mode} without updating the branch`, (t) => {
    const { result, calls } = scenario(t, mode);
    assert.equal(result.status, 1);
    assert.ok(!calls.some((c) => c.method === "PATCH"));
  });
}
for (const mode of ["humanMarker", "generatedMarker", "humanMajor"]) {
  test(`writer preserves ${mode} without duplicate marker writes`, (t) => {
    const { result, calls } = scenario(t, mode);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(calls.every((c) => c.method === "GET"));
  });
}
test("root tooling maps to every real app package", (t) => {
  const { result, calls } = scenario(t, "root");
  assert.equal(result.status, 0, result.stderr);
  const marker = calls.find((c) => c.path === "/git/blobs").body.content;
  for (const name of [
    "@app/api",
    "@app/discord-bot",
    "@app/scraper",
    "@app/web",
  ])
    assert.ok(marker.includes(`"${name}": patch`));
});

test("writer accepts a compatible patch", (t) => {
  const { result } = scenario(t, "patch");
  assert.equal(result.status, 0, result.stderr);
});
test("writer regenerates its existing marker against a rebased current head", (t) => {
  const { result, calls } = scenario(t, "rebasedMarker");
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(
    calls.find((c) => c.method === "POST" && c.path === "/git/commits").body
      .parents,
    ["c".repeat(40)],
  );
  assert.equal(calls.find((c) => c.path === "/git/trees").body.tree.length, 1);
});
test("a racing head update is rejected by GitHub's non-forcing ref update", (t) => {
  const { result, calls } = scenario(t, "refConflict");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /HTTP 422/);
  assert.equal(calls.at(-1).body.force, false);
});
