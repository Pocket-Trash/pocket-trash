import { appImportRestrictions } from "./apps.mjs";

/** Authored web source, configuration, stories, tests, and browser harnesses. */
const webFiles = ["apps/web/**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"];
/** Existing state-ownership guidance shared by import/property diagnostics. */
const stateGuidance =
  "Follow docs/coding-standards-references/state-management.md: use semantic reducers, effect reducers, forms, Router state, or isolated Nano Stores.";

/**
 * Composes the existing application boundaries with the web hook policy.
 * @param hooks - Hooks forbidden at this exact authored-web path.
 * @returns Built-in import and property restrictions without replacing prior app restrictions.
 */
function hookRestrictions(hooks) {
  return {
    "no-restricted-imports": [
      "error",
      {
        ...appImportRestrictions,
        paths: [
          ...appImportRestrictions.paths,
          {
            name: "react",
            importNames: hooks,
            message: stateGuidance,
          },
        ],
      },
    ],
    "no-restricted-properties": [
      "error",
      ...hooks.map((property) => ({ property, message: stateGuidance })),
    ],
  };
}

export default [
  {
    files: webFiles,
    rules: hookRestrictions(["useState", "useEffect", "useLayoutEffect"]),
  },
  {
    files: [
      "apps/web/src/components/markdown-visual-editor.tsx",
      "apps/web/src/providers/user-settings-provider.tsx",
      "apps/web/src/hooks/use-image-file-validation.ts",
    ],
    rules: hookRestrictions(["useState", "useLayoutEffect"]),
  },
  {
    files: ["apps/web/src/components/markdown-editor.tsx"],
    rules: hookRestrictions(["useState", "useEffect"]),
  },
];
