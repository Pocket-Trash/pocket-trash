import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

/**
 * Runs preview configuration with a fake Railway CLI at its public boundary.
 * @param t - Test lifecycle.
 * @param mode - Provider fixture mode.
 * @param overrides - Process environment overrides.
 * @returns Captured result and CLI requests.
 */
function configure(t, mode = "normal", overrides = {}) {
  const directory = mkdtempSync(join(tmpdir(), "railway-preview-vars-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const log = join(directory, "calls.json");
  writeFileSync(
    join(directory, "pnpm"),
    `#!${process.execPath}
const fs=require('node:fs');const args=process.argv.slice(2),query=args[3];
const input=fs.readFileSync(0,'utf8');
const calls=fs.existsSync(process.env.CALL_LOG)?JSON.parse(fs.readFileSync(process.env.CALL_LOG)):[];
calls.push({args,input});fs.writeFileSync(process.env.CALL_LOG,JSON.stringify(calls));
if(process.env.MODE==='rate'&&calls.length===1){process.stderr.write('You are being ratelimited. Try again in about 0 minutes');process.exit(1);}
if(process.env.MODE==='longRate'){process.stderr.write('You are being ratelimited. Try again in about 33 minutes');process.exit(1);}
if(process.env.MODE==='failure'){process.stderr.write('sensitive-token redis://password@private');process.exit(1);}
let data;
if(process.env.MODE==='malformed'){process.stdout.write('sensitive-token redis://password@private');process.exit(0);}
if(process.env.MODE==='apiError'){process.stdout.write(JSON.stringify({errors:[{message:'sensitive-token redis://password@private'}]}));process.exit(0);}
if(query.includes('ProjectContext'))data={project:{id:'project',name:process.env.MODE==='wrongProject'?'Clerk':'Pocket Trash',environments:{edges:[{node:{id:'env-pr',name:'pocket-trash-pr-485'}}]},services:{edges:[{node:{id:'scraper',name:'pocket-trash (preview)'}},{node:{id:'queue',name:'pocket-trash-queue'}}]}}};
else if(query.includes('mutation')){data={scraper:process.env.MODE!=='partial',queue:true};fs.writeFileSync(process.env.VARIABLE_STATE,input);}
else {const state=fs.existsSync(process.env.VARIABLE_STATE)?JSON.parse(fs.readFileSync(process.env.VARIABLE_STATE)):null;data={scraper:state?.scraper.variables||{},queue:state?.queue.variables||{}};if(process.env.MODE==='mismatch')data.scraper.BUNNY_IMAGE_FOLDER_PREFIX='images/production';}
process.stdout.write(JSON.stringify({data}));
`,
    { mode: 0o755 },
  );
  /**
   * Starts the command with only fake provider access.
   * @returns Captured process result.
   */
  const run = () =>
    spawnSync(
      process.execPath,
      ["--import", "tsx", "scripts/railway-preview-variables.mjs"],
      {
        encoding: "utf8",
        timeout: mode === "longRate" ? 1500 : 15_000,
        env: {
          ...process.env,
          PATH: `${directory}:${process.env.PATH}`,
          CALL_LOG: log,
          VARIABLE_STATE: join(directory, "state.json"),
          MODE: mode,
          RAILWAY_PROJECT_ID: "project",
          PR_NUMBER: "485",
          ISOLATED: "true",
          DB_CHANGING: "false",
          DATABASE_URL: "postgres://fixture:password@private/db",
          FONTAWESOME_PACKAGE_TOKEN: "sensitive-token",
          ...overrides,
        },
      },
    );
  let result = run();
  if (mode === "unchanged") {
    assert.equal(result.status, 0, result.stderr);
    result = run();
  }
  const calls = existsSync(log) ? JSON.parse(readFileSync(log, "utf8")) : [];
  assert.ok(!`${result.stdout}${result.stderr}`.includes("sensitive-token"));
  assert.ok(!`${result.stdout}${result.stderr}`.includes("password@private"));
  return { result, calls };
}

test("preview variables are batched, scoped and verified without deploying", (t) => {
  const { result, calls } = configure(t);
  assert.equal(result.status, 0, result.stderr);
  const mutations = calls.filter((c) => c.args[3].includes("mutation"));
  assert.equal(mutations.length, 1);
  const body = JSON.parse(mutations[0].input);
  assert.equal(body.scraper.environmentId, "env-pr");
  assert.equal(body.queue.environmentId, "env-pr");
  for (const input of [body.scraper, body.queue]) {
    assert.equal(input.replace, false);
    assert.equal(input.skipDeploys, true);
  }
  assert.equal(
    body.scraper.variables.BUNNY_IMAGE_FOLDER_PREFIX,
    "images/preview/pr-485",
  );
  assert.equal(body.scraper.variables.SCRAPER_CRON_ENABLED, "false");
  assert.equal(
    body.scraper.variables.FONTAWESOME_PACKAGE_TOKEN,
    "sensitive-token",
  );
  assert.equal(
    body.scraper.variables.DATABASE_URL,
    "postgres://fixture:password@private/db",
  );
  assert.equal(
    body.scraper.variables.RAILPACK_INSTALL_CMD,
    "./scripts/pnpm-install.sh --frozen-lockfile --prefer-offline",
  );
  assert.equal(
    body.scraper.variables.REDIS_URL,
    "${{pocket-trash-queue.REDIS_PUBLIC_URL}}",
  );
  assert.equal(body.queue.variables.LOG_DEPLOYMENT_ID, "pocket-trash-pr-485");
  assert.ok(calls.length <= 5);
  assert.ok(calls.every((c) => !c.args.join(" ").includes("sensitive-token")));
});
for (const mode of [
  "wrongProject",
  "failure",
  "mismatch",
  "malformed",
  "apiError",
  "partial",
])
  test(`preview configuration fails safely for ${mode}`, (t) => {
    const { result } = configure(t, mode);
    assert.notEqual(result.status, 0);
  });
test("unknown PR targets are rejected before provider calls", (t) => {
  const { result, calls } = configure(t, "normal", { PR_NUMBER: "production" });
  assert.notEqual(result.status, 0);
  assert.equal(calls.length, 0);
});
test("rate limits are retried rather than hidden", (t) => {
  const { result, calls } = configure(t, "rate");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(calls.length, 6);
});
test("a long provider cooldown does not trigger an immediate retry storm", (t) => {
  const { result, calls } = configure(t, "longRate");
  assert.notEqual(result.status, 0);
  assert.equal(calls.length, 1);
});

test("an unchanged configuration does not issue a second write", (t) => {
  const { result, calls } = configure(t, "unchanged");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(calls.filter((c) => c.args[3].includes("mutation")).length, 1);
  assert.equal(calls.length, 8);
});
test("shared previews keep shared images and opt in to changed-database cron", (t) => {
  const { result, calls } = configure(t, "normal", {
    ISOLATED: "false",
    DB_CHANGING: "true",
  });
  assert.equal(result.status, 0, result.stderr);
  const body = JSON.parse(
    calls.find((c) => c.args[3].includes("mutation")).input,
  );
  assert.equal(
    body.scraper.variables.BUNNY_IMAGE_FOLDER_PREFIX,
    "images/preview",
  );
  assert.equal(body.scraper.variables.SCRAPER_CRON_ENABLED, "true");
});
