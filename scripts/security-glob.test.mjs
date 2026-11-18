import assert from "node:assert/strict";
import * as fs from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

/**
 * Resolves a dependency through its caller's installed module search paths.
 * @param from - Caller package manifest.
 * @param name - Dependency package name.
 * @returns The dependency's require function.
 */
function dependency(from, name) {
  const caller = createRequire(from);
  const manifest = caller.resolve
    .paths(name)
    .map((path) => join(path, name, "package.json"))
    .find(fs.existsSync);
  assert.ok(manifest, `Installed dependency ${name} is required`);
  return createRequire(manifest);
}
/** Installed caller used to resolve the active dependency graph. */
const web = resolve("apps/web/package.json");
/** Installed caller used to resolve the active dependency graph. */
const storybook = dependency(web, "@storybook/tanstack-react");
/** Installed caller used to resolve the active dependency graph. */
const reactVite = dependency(
  storybook.resolve("./package.json"),
  "@storybook/react-vite",
);
/** Installed caller used to resolve the active dependency graph. */
const docgen = dependency(
  reactVite.resolve("./package.json"),
  "@joshwooding/vite-plugin-react-docgen-typescript",
);
/** Installed caller used to resolve the active dependency graph. */
const vercel = dependency(resolve("package.json"), "vercel");
/** Installed caller used to resolve the active dependency graph. */
const vercelNode = dependency(vercel.resolve("./package.json"), "@vercel/node");
/** Installed caller used to resolve the active dependency graph. */
const nft = dependency(vercelNode.resolve("./package.json"), "@vercel/nft");
for (const [parent, require] of [
  ["Vercel tracing", nft],
  ["Storybook docgen", docgen],
]) {
  test(`${parent} stops directory reads after cancellation`, async (t) => {
    const { glob, globStream, globSync } = require("glob");
    const cwd = fs.mkdtempSync(join(tmpdir(), "glob-cancellation-"));
    t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
    for (let i = 0; i < 8; i += 1) {
      for (let j = 0; j < 8; j += 1) {
        const path = join(cwd, String(i), String(j));
        fs.mkdirSync(path, { recursive: true });
        fs.writeFileSync(join(path, "entry.js"), "");
      }
    }
    for (const mode of ["promise", "stream"]) {
      const controller = new AbortController();
      const reason = new Error("fixture cancellation");
      let reads = 0;
      const options = {
        cwd,
        signal: controller.signal,
        fs: {
          ...fs,
          /**
           * Aborts on the first directory read and observes later reads.
           * @param args - Public filesystem arguments.
           * @returns The filesystem operation result.
           */
          readdir(...args) {
            reads += 1;
            if (reads === 1) controller.abort(reason);
            return fs.readdir(...args);
          },
        },
      };
      const result =
        mode === "promise"
          ? glob("**", options)
          : new Promise((resolve, reject) =>
              globStream("**", options)
                .on("error", reject)
                .on("end", resolve)
                .resume(),
            );
      await assert.rejects(result, reason);
      const atReject = reads;
      await new Promise((resolve) => setTimeout(resolve, 100));
      assert.equal(
        reads,
        atReject,
        `${mode} must stop background directory reads`,
      );
      assert.equal(reads, 1);
    }
    const options = { cwd, absolute: true, nodir: true, ignore: ["0/**"] };
    const expected = [];
    for (let i = 1; i < 8; i += 1)
      for (let j = 0; j < 8; j += 1)
        expected.push(join(cwd, String(i), String(j), "entry.js"));
    assert.deepEqual(globSync("**/*.js", options).sort(), expected.sort());
    assert.deepEqual((await glob("**/*.js", options)).sort(), expected.sort());
  });
}
