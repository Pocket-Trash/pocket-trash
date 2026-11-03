import assert from "node:assert/strict";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";

/** Real repository root whose eslint.config.mjs must own every regression case. */
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
/** Unmodified root configuration, including existing application boundaries. */
const eslint = new ESLint({ cwd: repoRoot });
/** Default authored-web fixture path avoids typed-project fixture overrides. */
const webPath = "apps/web/src/state-policy-fixture.jsx";
/** Built-in rules that implement the authored-web hook restriction. */
const restrictedRules = new Set([
  "no-restricted-imports",
  "no-restricted-properties",
]);

/**
 * Runs source through the actual root config and rejects parser/ignore false positives.
 * @param source - Authored source under test.
 * @param filePath - Exact repository-relative source path.
 * @returns Root lint messages for this source.
 */
async function messages(source, filePath = webPath) {
  const results = await eslint.lintText(source, {
    filePath: join(repoRoot, filePath),
  });
  assert.equal(results.length, 1);
  assert.equal(
    results[0].fatalErrorCount,
    0,
    JSON.stringify(results[0].messages),
  );
  assert.equal(
    results[0].messages.some(({ message }) =>
      /ignored|no matching configuration/i.test(message),
    ),
    false,
  );
  return results[0].messages;
}

for (const hook of ["useState", "useEffect", "useLayoutEffect"]) {
  for (const [label, source] of [
    ["named import", `import { ${hook} } from "react"; export { ${hook} };`],
    [
      "aliased import",
      `import { ${hook} as legacy } from "react"; export { legacy };`,
    ],
    [
      "default property",
      `import React from "react"; export const legacy = React.${hook};`,
    ],
    [
      "aliased default",
      `import R from "react"; export const legacy = R.${hook};`,
    ],
    [
      "namespace property",
      `import * as R from "react"; export const legacy = R.${hook};`,
    ],
    [
      "computed literal",
      `import R from "react"; export const legacy = R["${hook}"];`,
    ],
    [
      "destructured alias",
      `import R from "react"; const { ${hook}: legacy } = R; export { legacy };`,
    ],
    [
      "computed destructuring",
      `import R from "react"; const { ["${hook}"]: legacy } = R; export { legacy };`,
    ],
    ["named re-export", `export { ${hook} as legacy } from "react";`],
    ["type re-export", `export type { ${hook} } from "react";`],
  ]) {
    test(`web hooks reject ${hook}: ${label}`, async () => {
      const path =
        label === "type re-export" ? "apps/web/src/client.tsx" : webPath;
      assert.equal(
        (await messages(source, path)).some(
          ({ ruleId, severity }) =>
            restrictedRules.has(ruleId) && severity === 2,
        ),
        true,
      );
    });
  }
}

for (const source of [
  'export * from "react";',
  'export * as React from "react";',
]) {
  test(`web hooks reject broad re-export: ${source}`, async () => {
    assert.equal(
      (await messages(source)).some(
        ({ ruleId }) => ruleId === "no-restricted-imports",
      ),
      true,
    );
  });
}

for (const filePath of [
  "apps/web/.storybook/state-policy-fixture.jsx",
  "apps/web/src/component.stories.jsx",
  "apps/web/src/component.test.jsx",
  "apps/web/e2e/local/src/state-policy-fixture.jsx",
  "apps/web/vite-state-policy-fixture.mjs",
]) {
  test(`authored path has no hook waiver: ${filePath}`, async () => {
    assert.equal(
      (
        await messages(
          'import { useState } from "react"; export { useState };',
          filePath,
        )
      ).some(({ ruleId }) => ruleId === "no-restricted-imports"),
      true,
    );
  });
}

for (const filePath of [
  "apps/web/src/components/markdown-visual-editor.tsx",
  "apps/web/src/providers/user-settings-provider.tsx",
  "apps/web/src/hooks/use-image-file-validation.ts",
]) {
  test(`passive effect exception is exact and still forbids state/layout hooks: ${filePath}`, async () => {
    const allowed = await messages(
      'import React, { useEffect } from "react"; export function Adapter() { useEffect(() => undefined, []); React.useEffect(() => undefined, []); return null; }',
      filePath,
    );
    assert.equal(
      allowed.some(({ ruleId }) => restrictedRules.has(ruleId)),
      false,
    );
    for (const hook of ["useState", "useLayoutEffect"])
      assert.equal(
        (
          await messages(
            `import React, { ${hook} } from "react"; export const legacy = React["${hook}"]; export { ${hook} };`,
            filePath,
          )
        ).some(({ ruleId }) => restrictedRules.has(ruleId)),
        true,
      );
  });
}

test("the editor keeps only its genuine selection layout exception", async () => {
  const filePath = "apps/web/src/components/markdown-editor.tsx";
  assert.equal(
    (
      await messages(
        'import React, { useLayoutEffect } from "react"; export function Editor() { useLayoutEffect(() => undefined, []); React.useLayoutEffect(() => undefined, []); return null; }',
        filePath,
      )
    ).some(({ ruleId }) => restrictedRules.has(ruleId)),
    false,
  );
  for (const hook of ["useState", "useEffect"])
    assert.equal(
      (
        await messages(
          `import React from "react"; export const legacy = React.${hook};`,
          filePath,
        )
      ).some(({ ruleId }) => restrictedRules.has(ruleId)),
      true,
    );
});

for (const filePath of [
  "apps/web/src/components/markdown-visual-editor.jsx",
  "apps/web/src/pages/markdown-visual-editor.jsx",
  "apps/web/.storybook/user-settings-provider.jsx",
  "apps/web/e2e/local/src/use-image-file-validation.js",
]) {
  test(`same adapter name cannot widen the exact effect exception: ${filePath}`, async () => {
    assert.equal(
      (
        await messages(
          'import { useEffect } from "react"; export { useEffect };',
          filePath,
        )
      ).some(({ ruleId }) => ruleId === "no-restricted-imports"),
      true,
    );
  });
}

test("recommended React, Form, Router, Nano Store, and effect reducer APIs remain permitted", async () => {
  const source = `import React, { useReducer, useRef, useSyncExternalStore } from "react";
import { useEffectReducer } from "use-effect-reducer";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "@tanstack/react-router";
import { atom } from "nanostores";
export { React, useReducer, useRef, useSyncExternalStore, useEffectReducer, useForm, useRouter, atom };
export const reducer = React.useReducer;`;
  assert.equal(
    (await messages(source)).some(({ ruleId }) => restrictedRules.has(ruleId)),
    false,
  );
});

test("effect reducers are hooks without being dependency-array effects", async () => {
  const source =
    'import { useEffectReducer } from "use-effect-reducer"; export function Example() { return useEffectReducer((state) => state, 0, {})[0]; }';
  assert.equal(
    (await messages(source)).some(
      ({ ruleId }) => ruleId === "react-hooks/exhaustive-deps",
    ),
    false,
  );
  const native = await messages(
    'import { useEffect } from "react"; export function Adapter({ value }: { value: number }) { useEffect(() => { void value; }, []); return null; }',
    "apps/web/src/hooks/use-image-file-validation.ts",
  );
  assert.equal(
    native.some(({ ruleId }) => ruleId === "react-hooks/exhaustive-deps"),
    true,
  );
  const conditional = await messages(
    'import { useReducer } from "react"; export function Example({ enabled }) { if (enabled) useReducer((state) => state, 0); return null; }',
  );
  assert.equal(
    conditional.some(({ ruleId }) => ruleId === "react-hooks/rules-of-hooks"),
    true,
  );
});

test("hook restrictions compose with Lucide, storage, console, and database logger boundaries", async () => {
  for (const filePath of [
    webPath,
    "apps/web/src/components/markdown-visual-editor.tsx",
  ]) {
    const result = await messages(
      'import "lucide-react"; import "@package/storage"; console.log("fixture");',
      filePath,
    );
    assert.equal(
      result.filter(({ ruleId }) => ruleId === "no-restricted-imports").length,
      2,
    );
    assert.equal(
      result.some(({ ruleId }) => ruleId === "no-console"),
      true,
    );
  }
  assert.equal(
    (
      await messages(
        'import "@package/logger";',
        "packages/database/src/state-policy-fixture.js",
      )
    ).some(({ ruleId }) => ruleId === "no-restricted-imports"),
    true,
  );
  assert.equal(
    (
      await messages(
        'import { useState } from "react"; export { useState };',
        "apps/api/src/state-policy-fixture.js",
      )
    ).some(({ ruleId }) => restrictedRules.has(ruleId)),
    false,
  );
});

test("generated and dependency files stay excluded while hidden authored stories stay covered", async () => {
  for (const filePath of [
    "apps/web/src/routeTree.gen.ts",
    "apps/web/node_modules/dependency/index.js",
    "apps/web/.output/server/index.js",
    "apps/web/storybook-static/assets/story.js",
    "apps/web/dist/client.js",
  ])
    assert.equal(
      await eslint.isPathIgnored(join(repoRoot, filePath)),
      true,
      filePath,
    );
  assert.equal(
    await eslint.isPathIgnored(
      join(repoRoot, "apps/web/.storybook/story-fixtures.tsx"),
    ),
    false,
  );
});

test("default type imports remain permitted while broad namespaces are intentionally rejected", async () => {
  const typeOnly = await messages(
    'import type React from "react"; export type Node = React.ReactNode;',
    "apps/web/src/client.tsx",
  );
  assert.equal(
    typeOnly.some(({ ruleId }) => restrictedRules.has(ruleId)),
    false,
  );
  const namespace = await messages(
    'import * as React from "react"; export const reducer = React.useReducer;',
  );
  assert.equal(
    namespace.some(({ ruleId }) => ruleId === "no-restricted-imports"),
    true,
  );
});

test("native hook checks cover non-JSX web hooks without treating effect reducers as dependency effects", async () => {
  const source =
    'import { useEffectReducer } from "use-effect-reducer"; export function useExample(enabled: boolean) { if (enabled) useEffectReducer((state) => state, 0, {}); }';
  const result = await messages(
    source,
    "apps/web/src/hooks/use-image-file-validation.ts",
  );
  assert.equal(
    result.some(({ ruleId }) => ruleId === "react-hooks/rules-of-hooks"),
    true,
  );
  assert.equal(
    result.some(({ ruleId }) => ruleId === "react-hooks/exhaustive-deps"),
    false,
  );
});
