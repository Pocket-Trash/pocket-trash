import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { getHighestChangesetBump } from "./check-pr-changeset.mjs";
import { getWorkspacePackages } from "./workspace-packages.mjs";

/** Trusted repository identity; fork and cross-repository writes are forbidden. */
const repository = "Pocket-Trash/pocket-trash";
/** Trusted base checkout directory. */
const root = fileURLToPath(new URL("..", import.meta.url));

/**
 * Calls GitHub with bounded requests and no redirects or response-body logging.
 * @param path - Repository-relative API path.
 * @param method - HTTP method.
 * @param body - Optional JSON payload.
 * @returns Parsed GitHub response.
 * @rejects When GitHub rejects the request or returns invalid JSON.
 */
async function request(path, method = "GET", body) {
  const response = await fetch(
    `https://api.github.com/repos/${repository}${path}`,
    {
      method,
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      headers: {
        authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        accept: "application/vnd.github+json",
        "content-type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    },
  );
  if (!response.ok)
    throw new Error(`GitHub ${method} failed (HTTP ${response.status}).`);
  return response.json();
}

/**
 * Reads a complete paginated GitHub list, refusing truncated results.
 * @param path - API list path without query parameters.
 * @returns The complete list.
 * @rejects When a response is invalid or the list exceeds GitHub's PR limit.
 */
async function list(path) {
  const entries = [];
  for (let page = 1; page <= 30; page += 1) {
    const batch = await request(`${path}?per_page=100&page=${page}`);
    if (!Array.isArray(batch)) throw new Error("Invalid GitHub list response.");
    entries.push(...batch);
    if (batch.length < 100) return entries;
  }
  throw new Error("GitHub list exceeds the qualification limit.");
}

/**
 * Reads a file through GitHub, without checking out or executing the PR head.
 * @param path - Repository file path.
 * @param sha - Exact commit SHA.
 * @returns Decoded UTF-8 text.
 * @rejects When contents are absent or malformed.
 */
async function content(path, sha) {
  const file = await request(
    `/contents/${encodeURIComponent(path)}?ref=${sha}`,
  );
  if (
    file.encoding !== "base64" ||
    typeof file.content !== "string" ||
    file.size > 1_000_000
  )
    throw new Error("Invalid GitHub file content.");
  return Buffer.from(file.content, "base64").toString("utf8");
}

/**
 * Recognizes a stable exact/caret/tilde version without broad ranges or tags.
 * @param value - Dependency declaration.
 * @returns Numeric major/minor/patch tuple.
 * @throws When a declaration requires human assessment.
 */
function version(value) {
  const match =
    typeof value === "string" &&
    value.match(/^[~^]?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u);
  if (!match)
    throw new Error("Unknown dependency version requires human assessment.");
  const parts = match.slice(1).map(Number);
  if (!parts.every(Number.isSafeInteger))
    throw new Error("Version exceeds the supported numeric range.");
  return parts;
}

/**
 * Qualifies dependency-only stable patch/minor changes in one known manifest.
 * @param before - Trusted base manifest.
 * @param after - Untrusted head JSON data.
 * @returns Whether at least one dependency version increased.
 * @throws When any unrelated or major change is present.
 */
function qualifyManifest(before, after) {
  const oldRest = structuredClone(before);
  const newRest = structuredClone(after);
  let changed = false;
  for (const group of [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
  ]) {
    const previous = before[group] ?? {};
    const next = after[group] ?? {};
    if (
      !isDeepStrictEqual(Object.keys(previous).sort(), Object.keys(next).sort())
    )
      throw new Error(
        "Adding or removing dependencies requires human assessment.",
      );
    for (const [name, target] of Object.entries(next)) {
      if (target === previous[name]) continue;
      const oldVersion = version(previous[name]);
      const newVersion = version(target);
      if (
        oldVersion[0] !== newVersion[0] ||
        (oldVersion[0] === 0 && oldVersion[1] !== newVersion[1]) ||
        newVersion[1] < oldVersion[1] ||
        (newVersion[1] === oldVersion[1] && newVersion[2] <= oldVersion[2])
      )
        throw new Error(
          "Major, downgraded or unchanged versions require human assessment.",
        );
      changed = true;
    }
    delete oldRest[group];
    delete newRest[group];
  }
  if (!isDeepStrictEqual(oldRest, newRest))
    throw new Error("Unrelated manifest changes are forbidden.");
  return changed;
}

/**
 * Writes only a qualified deterministic marker with an optimistic head lease.
 * @returns Completion or an idempotent no-op.
 * @rejects On identity, diff, version, API or stale-head failures.
 */
async function main() {
  const number = Number(process.env.PR_NUMBER);
  if (
    process.env.GITHUB_REPOSITORY !== repository ||
    !process.env.GITHUB_TOKEN ||
    !Number.isSafeInteger(number) ||
    number < 1
  )
    throw new Error("Invalid writer repository or pull request.");
  const pull = await request(`/pulls/${number}`);
  if (pull.user?.login !== "dependabot[bot]" || pull.user?.type !== "Bot")
    throw new Error("Only the actual Dependabot author is eligible.");
  if (
    pull.state !== "open" ||
    pull.base?.ref !== "main" ||
    pull.base?.repo?.full_name !== repository ||
    pull.head?.repo?.full_name !== repository ||
    pull.head.repo.id !== pull.base.repo.id ||
    !Number.isSafeInteger(pull.base.repo.id) ||
    pull.base.repo.id < 1 ||
    pull.head.repo.fork !== false ||
    !/^dependabot\/[\w./-]+$/u.test(pull.head.ref) ||
    pull.head.ref.includes("..") ||
    !/^[a-f\d]{40}$/u.test(pull.head.sha) ||
    !/^[a-f\d]{40}$/u.test(pull.base.sha)
  )
    throw new Error("Fork, repository, base or head is ineligible.");
  const marker = `.changeset/dependabot-${number}.md`;
  const files = await list(`/pulls/${number}/files`);
  const packages = getWorkspacePackages(root);
  const knownNames = new Set(packages.map(({ manifest }) => manifest.name));
  const manifests = new Map(
    packages.map(({ directory, manifest }) => [
      `${directory}/package.json`,
      manifest.name,
    ]),
  );
  const affected = new Set();
  const markers = [];
  let existing;
  const changedManifests = [];
  for (const file of files) {
    if (!["added", "modified"].includes(file.status))
      throw new Error("Unexpected file operation.");
    if (/^\.changeset\/[\w-]+\.md$/u.test(file.filename)) {
      const text = await content(file.filename, pull.head.sha);
      if (file.filename === marker) existing = text;
      else markers.push({ content: text });
      continue;
    }
    if (file.filename === "pnpm-lock.yaml") continue;
    if (file.filename !== "package.json" && !manifests.has(file.filename))
      throw new Error("Unexpected dependency diff path.");
    changedManifests.push(file.filename);
  }
  if (getHighestChangesetBump(markers, knownNames)) return;
  for (const filename of changedManifests) {
    const before = JSON.parse(await content(filename, pull.base.sha));
    const after = JSON.parse(await content(filename, pull.head.sha));
    if (manifests.has(filename) && before.name !== manifests.get(filename))
      throw new Error("Unknown package mapping.");
    if (filename === "package.json" && before.name !== "pocket-trash.app")
      throw new Error("Unknown root package mapping.");
    if (!qualifyManifest(before, after)) continue;
    if (filename === "package.json") {
      for (const { directory, manifest } of packages)
        if (directory.startsWith("apps/")) affected.add(manifest.name);
    } else affected.add(manifests.get(filename));
  }
  if (!affected.size)
    throw new Error("Lock-only or unknown updates require human assessment.");
  const commits = await list(`/pulls/${number}/commits`);
  const message = `chore: mark dependency update [dependabot skip]`;
  if (
    !commits.length ||
    commits.some(
      (commit) =>
        commit.author?.login !== "dependabot[bot]" &&
        !(
          commit.author?.login === "github-actions[bot]" &&
          commit.commit?.message === message
        ),
    )
  )
    throw new Error("Unrelated human commits require assessment.");
  const text = `---\n${[...affected]
    .sort()
    .map((name) => `"${name}": patch`)
    .join("\n")}\n---\n\nRefresh compatible dependencies.\n`;
  if (existing === text) return;
  const parent = await request(`/git/commits/${pull.head.sha}`);
  if (!/^[a-f\d]{40}$/u.test(parent.tree?.sha))
    throw new Error("Invalid parent tree.");
  const blob = await request("/git/blobs", "POST", {
    content: text,
    encoding: "utf-8",
  });
  if (!/^[a-f\d]{40}$/u.test(blob.sha))
    throw new Error("Invalid Git object response.");
  const tree = await request("/git/trees", "POST", {
    base_tree: parent.tree.sha,
    tree: [{ path: marker, mode: "100644", type: "blob", sha: blob.sha }],
  });
  if (!/^[a-f\d]{40}$/u.test(tree.sha))
    throw new Error("Invalid Git object response.");
  const commit = await request("/git/commits", "POST", {
    message,
    tree: tree.sha,
    parents: [pull.head.sha],
  });
  if (!/^[a-f\d]{40}$/u.test(commit.sha))
    throw new Error("Invalid Git object response.");
  const latest = await request(`/pulls/${number}`);
  if (latest.head?.sha !== pull.head.sha)
    throw new Error("Stale pull-request head; no reference updated.");
  const updated = await request(
    `/git/refs/heads/${encodeURIComponent(pull.head.ref)}`,
    "PATCH",
    { sha: commit.sha, force: false },
  );
  if (updated.object?.sha !== commit.sha)
    throw new Error("GitHub did not confirm the marker commit.");
}
main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
