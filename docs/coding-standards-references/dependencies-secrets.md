# Dependencies and secrets

- Respect release-age policy in [pnpm-workspace.yaml](../../pnpm-workspace.yaml): external releases must mature seven days; missing publication times and noncompliant lockfiles fail installs.
- For urgent security releases, use only reviewed exact-version exceptions in `minimumReleaseAgeExclude`, with Linear issue, reason and UTC maturity/removal time in a YAML comment; remove after maturity. Never lower the age or add scope wildcards. Preserve existing organization-package exemptions.
- Run `pnpm security:audit` for dependency/lockfile changes and before builds/deployments. [Release security governance](../release.md#dependency-security) owns Roy-approved vulnerability exceptions and expiry tracking; do not bypass it.
- Keep server secrets out of browser code. Only [approved build aliases](../../apps/web/vite.config.ts) expose public values as `VITE_`; installation tokens are server/tooling-only.
- Keep runtime schemas authoritative; follow [environment placement](../environment-variables.md) for provider/tooling paths, environment separation and cross-runtime secret constraints.

The `tsc` build/typecheck executable comes from TypeScript 7 through the
`@typescript/native` alias. The `typescript` alias supplies Microsoft's
TypeScript 6 compatibility API for ESLint and the JSDoc checker. Keep both
aliases together when updating the compiler; TypeScript 7.0 has no compiler API.
See [Microsoft's side-by-side setup](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-60).
