# Localizations Local Development Options

## Current State

`@pocket-trash/localizations` is currently consumed as a published registry package:

- `apps/web/package.json`: `@pocket-trash/localizations: ^0.1.0`
- `packages/services/package.json`: `@pocket-trash/localizations: ^0.1.0`
- `pnpm-lock.yaml`: resolves `@pocket-trash/localizations@0.1.0` by integrity hash, not `workspace:`, `link:`, or `file:`

The local package at `/Users/royanger/code/pocket-trash-work/localizations` builds `src` to `dist` with `pnpm dev` (`tsc --watch`). Its package exports point at `dist/index.js` and `dist/index.d.ts`.

## Constraints From Tooling

- pnpm workspaces are the native way to link local packages. `workspace:` refuses registry fallback when the matching workspace package is missing. Source: https://pnpm.io/workspaces
- pnpm's default for local workspace dependencies is a symlink to the package source directory, unless `dependenciesMeta.*.injected` is enabled. pnpm says this default makes modifications immediately visible to consumers. Source: https://pnpm.io/package_json#dependenciesmetainjected
- Vite's dev watcher skips `node_modules`, and Vite currently says packages in `node_modules` cannot be watched directly. Source: https://vite.dev/config/server-options#server-watch
- Vite treats linked deps not resolved from `node_modules` as source in monorepos, but its docs also warn that linked dependency changes may require a forced dev-server restart because of dependency optimizer/cache behavior. Source: https://vite.dev/guide/dep-pre-bundling#monorepos-and-linked-dependencies
- `pnpm link <dir>` symlinks a local package into a project. pnpm's docs say changes are reflected, but the linked package's dependencies are not installed by the consuming project. Source: https://pnpm.io/cli/link
- `file:` hard-links a local package and installs its dependencies. pnpm's docs say source modifications are reflected, but hard-linked/injected flows can need synchronization after builds. Sources: https://pnpm.io/cli/link and https://pnpm.io/package_json#dependenciesmetainjected
- Vite aliases to file-system paths should use absolute paths. Source: https://vite.dev/config/shared-options#resolve-alias

## Options

### 1. Add `localizations` As A Real Workspace Package

Shape:

- Put the localizations repo inside this repo tree, most likely as `packages/localizations` or `external/localizations`.
- Add that path to `pnpm-workspace.yaml`.
- Change consumers to `@pocket-trash/localizations: workspace:*`.
- Do not enable `dependenciesMeta.*.injected` for it.
- Keep `pnpm dev` for localizations running so its `dist` updates.

Pros:

- Best fit for checked-in configuration.
- pnpm-native and widely used.
- `workspace:*` prevents accidental registry fallback.
- Default workspace symlink means the package directory is the source of truth.
- Keeps package release semantics clean; pnpm rewrites `workspace:` ranges when packing/publishing workspace packages.

Cons:

- Requires bringing the separate repo into this repo tree somehow.
- If done with a git submodule, developers must initialize/update the submodule.
- If done with subtree/vendor copy, ownership gets muddy.
- Vite may still need explicit dev config if it pre-bundles/cache-treats the package as a dependency.

Live-change fit: high, assuming Vite is configured to resolve/watch the linked package output instead of a cached `node_modules` package.

### 2. Checked-In Vite Dev Alias To The Sibling Repo

Shape:

- Keep production dependency as `^0.1.0`.
- In `apps/web/vite.config.ts`, when an env var is set, alias `@pocket-trash/localizations` to `/Users/royanger/code/pocket-trash-work/localizations/dist/index.js` or to a repo-relative conventional sibling path.
- Add `server.fs.allow` for that sibling path.
- Exclude `@pocket-trash/localizations` from dev optimization if needed.

Pros:

- Does not require merging repos or using submodules.
- Most config can be checked in.
- Uses the existing `pnpm dev`/`tsc --watch` output exactly as requested.
- Keeps CI and normal installs on the published package.

Cons:

- Needs a convention for where the sibling repo lives.
- Absolute user paths cannot be checked in cleanly; env-var or relative path convention is cleaner.
- Only fixes the Vite app. Node-side usage in `packages/services` may still resolve the installed package unless run through Vite or separately aliased.
- Needs a small verification test because Vite's official linked-dep docs are conservative about restart behavior.

Live-change fit: high for `apps/web` if Vite watches the aliased `dist` file; lower for non-Vite consumers unless separately handled.

### 3. `pnpm link ../localizations`

Shape:

- Developer runs `pnpm link /path/to/localizations` from the relevant consuming packages or workspace root.
- Localizations keeps running `pnpm dev`.

Pros:

- pnpm-supported.
- Direct symlink to the local source package.
- Good for one-off package authoring.

Cons:

- Not checked in.
- Easy for two developers to have different local state.
- Linked package dependencies must be installed in the linked repo.
- Same Vite `node_modules` watching/cache caveat unless Vite resolves the real path and does not optimize it.

Live-change fit: medium. pnpm says linked source changes are reflected, but Vite may still need config.

### 4. `file:` Dependency Or Root Override To `file:../localizations`

Shape:

- Change direct dependencies or root pnpm override to point to a local `file:` path.

Pros:

- Can be checked in if the sibling path convention is checked in.
- pnpm installs linked package dependencies.
- Better peer dependency behavior than `pnpm link` per pnpm docs.

Cons:

- Hard-link/copy behavior is more likely to need synchronization after rebuilds.
- Committing a local filesystem dependency is brittle unless the repo layout is standardized.
- It changes dependency resolution globally if done as an override.

Live-change fit: medium to low. pnpm says modifications reflect, but this is not the cleanest path for built TypeScript output and live dev.

### 5. yalc

Shape:

- Use `yalc publish`/`yalc add` or `yalc link`.
- Use `yalc push --changed` from a watcher after `tsc --watch` emits new `dist`.

Pros:

- Tests the packed package shape instead of raw source.
- Designed for local package author workflows.
- Can keep `.yalc`/`yalc.lock` checked in if the team wants that.

Cons:

- Adds another tool and another store.
- Existing localizations `pnpm dev` alone is not enough; you need push/watch glue.
- More moving parts than pnpm workspace/link.
- Better for package release smoke tests than everyday app dev.

Live-change fit: medium only with extra watcher/push wiring.

## Recommendation

Best long-term option: make `localizations` a real pnpm workspace package and consume it with `workspace:*`, ideally via a git submodule if it must remain a separate repo.

Best no-repo-merge option: add a checked-in Vite dev alias gated by an env var or conventional sibling path, pointing to the localizations repo's built `dist/index.js`.

Avoid as the primary solution: yalc and `file:` overrides. They work, but they add synchronization or local-state failure modes that are not needed here.
