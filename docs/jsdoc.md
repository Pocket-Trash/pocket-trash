# JSDoc

Pocket Trash uses concise JSDoc to describe stable JavaScript and TypeScript
contracts for developers and coding agents. `pnpm lint:jsdoc` enforces this
standard on every eligible declaration in tracked, hand-authored JS/TS-family
source, including untouched declarations. Git diffs and base refs do not restrict
coverage.

## Targets

Add JSDoc when you add or modify a stable named declaration:

- functions, React components, hooks, classes, methods, and accessors
- function-valued variables or object properties
- interfaces, type aliases, callable type members, and declared properties
- exported or module-level values such as schemas, constants, and service objects

Skip anonymous/contextual callbacks, imports, and re-exports. The generated
exclusions are:

- `apps/api/src/worker-configuration.d.ts`
- `apps/web/src/routeTree.gen.ts`
- `apps/web/src/vite-env.d.ts`

Dependencies, build output, and other untracked files are outside the scan. Do
not add file-overview comments that would only repeat a filename or expression.

## Style

Place the `/** ... */` block directly above its declaration. Start with one
short sentence that states the contract. Add a second sentence only for a
caller-visible constraint, side effect, fallback, or failure.

Use concrete domain terms. Document units, ordering, null behavior, persistence,
authorization, normalization, and retry behavior when callers need them. Do not
claim behavior that the code, types, or database does not enforce.

## Tags

Add each tag that applies:

| Tag | Use |
| --- | --- |
| `@param` | Each parameter root. Describe meaning instead of repeating its type. |
| `@returns` | Each non-void result, including rendered component output. |
| `@throws` | A synchronous failure visible to the caller. |
| `@rejects` | A meaningful promise rejection condition. |
| `@template` | Each generic type parameter. |
| `@yields` | Values produced by a generator. |
| `@next` | Values a generator accepts through `next()`. |
| `@default` | A default that changes behavior and is not clear from the declaration. |
| `@deprecated` | The replacement and migration path for a deprecated contract. |
| `@example` | A non-obvious public API, encoding, or multi-step operation. |
| `@see` or `{@link ...}` | A related symbol or protocol needed to understand the contract. |
| `@override` or `@inheritdoc` | An inherited contract that should not be duplicated. |
| `@fires` or `@listens` | An application event contract. |
| `@internal` | An exported symbol outside the supported package API. |

Use exact parameter names. Give an inline destructured parameter a semantic root
such as `props`, `options`, or `input`. Document dotted members only when a named
type does not own their descriptions.

TypeScript syntax already carries types and visibility. Do not add type fragments
or redundant `@type`, `@async`, `@private`, `@public`, `@readonly`, or `@static`
tags. JavaScript files may use `@type`, `@typedef`, `@callback`, `@property`,
`@enum`, or `@this` when the file cannot express that information in syntax.

## Examples

```ts
/**
 * Resolves a route parameter to its catalog product.
 *
 * @param productId - Slug with a trailing base-36 product code.
 * @returns The matching product, or `null` for an invalid or unknown code.
 */
export function decodeProductParam(productId: string): Product | null {
  // ...
}
```

```tsx
/**
 * Renders the catalog toolbar and its active controls.
 *
 * @param props - Filter state and update callbacks.
 * @returns The catalog toolbar UI.
 */
export function CatalogToolbar(props: CatalogToolbarProps) {
  // ...
}
```

## Run the check

Run the full-repository check from the repository root; no staged diff is needed:

```sh
pnpm lint:jsdoc
```

`pnpm lint`, the pre-commit hook, and CI run the same full-source JSDoc check.
The checker reads working-tree contents for paths listed by `git ls-files`.
Stage new source files to include them; modified tracked files are checked even
when unstaged. Deleted files are skipped. No changed-only mode or baseline is
supported.
