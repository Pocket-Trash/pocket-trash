import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { ESLint } from "eslint";

import config from "./index.mjs";

/** Repository root used to resolve real path-scoped lint overrides. */
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

test("central lint config preserves representative Biome coverage", async (context) => {
  const workspace = mkdtempSync(join(repoRoot, ".lint-smoke-"));
  context.after(() => rmSync(workspace, { force: true, recursive: true }));
  mkdirSync(join(workspace, "src"));
  writeFileSync(
    join(workspace, "tsconfig.json"),
    JSON.stringify({ compilerOptions: { jsx: "react-jsx", strict: true } }),
  );
  writeFileSync(join(workspace, "src", "types.ts"), "export type Item = {};\n");
  writeFileSync(
    join(workspace, "src", "sample.tsx"),
    `import { useEffect } from "react";
import { Item } from "./types.js";

declare const item: Item | undefined;
export const name = item && item.name;
export const asserted = [item][0]!.name;
export function Card() {
  if (item) useEffect(() => undefined, []);
  return <img src="item.png" />;
}
`,
  );
  writeFileSync(join(workspace, "duplicate.json"), '{ "key": 1, "key": 2 }\n');
  writeFileSync(join(workspace, "invalid.css"), "a { unknown-property: 1; }\n");
  writeFileSync(
    join(workspace, "invalid.html"),
    '<!doctype html><html><body><img src="item.png"></body></html>\n',
  );

  const eslint = new ESLint({
    cwd: repoRoot,
    overrideConfig: config,
    overrideConfigFile: true,
  });
  const results = await eslint.lintFiles([workspace]);
  const ruleIds = new Set(
    results.flatMap(({ messages }) => messages.map(({ ruleId }) => ruleId)),
  );

  for (const ruleId of [
    "@html-eslint/require-img-alt",
    "@typescript-eslint/consistent-type-imports",
    "@typescript-eslint/no-non-null-assertion",
    "@typescript-eslint/prefer-optional-chain",
    "css/no-invalid-properties",
    "json/no-duplicate-keys",
    "jsx-a11y-x/alt-text",
    "react-hooks/rules-of-hooks",
  ]) {
    assert.equal(ruleIds.has(ruleId), true, `Expected ${ruleId}`);
  }

  const scoped = await eslint.lintText(
    'import "@package/storage";\nconsole.log("lint smoke");\n',
    { filePath: join(repoRoot, "apps/web/src/lint-smoke.js") },
  );
  assert.deepEqual(
    new Set(scoped[0].messages.map(({ ruleId }) => ruleId)),
    new Set(["no-console", "no-restricted-imports"]),
  );
  assert.equal(
    await eslint.isPathIgnored(join(repoRoot, "apps/web/src/routeTree.gen.ts")),
    true,
  );
  assert.equal(
    await eslint.isPathIgnored(join(repoRoot, "scripts/lint-smoke.mjs")),
    false,
  );

  const formatFile = join(workspace, "imports.mjs");
  const disorderedImports =
    'import { z } from "./z.js";\nimport { a } from "./a.js";\nexport { a, z };\n';
  writeFileSync(formatFile, disorderedImports);
  execFileSync(
    join(repoRoot, "node_modules", ".bin", "biome"),
    ["check", "--write", "--linter-enabled=false", formatFile],
    { cwd: repoRoot },
  );
  const organizedImports = readFileSync(formatFile, "utf8");
  assert.notEqual(organizedImports, disorderedImports);
  assert.equal(
    organizedImports.indexOf('from "./a.js"') <
      organizedImports.indexOf('from "./z.js"'),
    true,
  );
});
