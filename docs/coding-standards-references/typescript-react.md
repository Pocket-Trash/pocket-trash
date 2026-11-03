# TypeScript and React

Follow the applicable [base JS/TS configuration](../../packages/lint/eslint/base.mjs), [React configuration](../../packages/lint/eslint/react.mjs) and [composed lint policy](../../packages/lint/eslint/index.mjs); keep executable configuration authoritative rather than copying rule inventories.

Use type-only imports for types and optional chaining where appropriate. Avoid non-null assertions when absence can be handled. Preserve hook call ordering and complete dependency lists; lint warnings remain actionable guidance. Reuse existing repository patterns and keep browser globals within their configured scope.

Read [state management](state-management.md) before changing web state and [JSDoc](jsdoc.md) before adding or modifying stable named declarations.
