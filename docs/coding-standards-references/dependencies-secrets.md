# Dependencies and secrets

- Respect release-age policy in [pnpm-workspace.yaml](../../pnpm-workspace.yaml): external releases must mature seven days; missing publication times and noncompliant lockfiles fail installs.
- For urgent security releases, use only reviewed exact-version exceptions in `minimumReleaseAgeExclude`, with Linear issue, reason and UTC maturity/removal time in a YAML comment; remove after maturity. Never lower the age or add scope wildcards. Preserve existing organization-package exemptions.
- Run `pnpm security:audit` for dependency/lockfile changes and before builds/deployments. [Release security governance](../release.md#dependency-security) owns Roy-approved vulnerability exceptions and expiry tracking; do not bypass it.
- Keep server secrets out of browser code. Only [approved build aliases](../../apps/web/vite.config.ts) expose public values as `VITE_`; installation tokens are server/tooling-only.
- Keep runtime schemas authoritative; follow [environment placement](../environment-variables.md) for provider/tooling paths, environment separation and cross-runtime secret constraints.
