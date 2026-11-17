# CI dependency installs

GitHub jobs use `.github/actions/setup-dependencies` with an explicit install
scope. `tools` installs root tooling and its workspace dependencies; `api`,
`database`, `scraper`, and `discord-bot` also install the named consumer's
dependency closure. `full` installs the complete workspace for web builds,
Storybook, web tests, lint, and whole-repository typechecking.
The API scope also includes `@package/queue` for the preview Redis probe.
The database scope includes `@package/storage` for database seed tooling.

`scripts/pnpm-install-scope.sh` owns the selectors. Every scope uses a frozen
lockfile and prefers cached downloads. Repository-approved lifecycle scripts
remain enabled so root tooling such as the Railway CLI is usable.
The pnpm store cache includes OS, architecture, actual Node/pnpm versions,
scope, and lockfile hash. Older lockfile caches restore only within the same
scope; backend caches cannot satisfy a full-workspace cache key. Dependency
installation always runs, including on an exact cache hit.

Full-lockfile supply-chain verification, the seven-day release-age policy, and
security audits remain enabled. Filtered installs exclude web icon tarballs;
they can still require Font Awesome metadata. Fetch the package token before
setup, retain the tracked registry mapping and temporary host-scoped user
configuration, and clear the token after installation. Installation credentials
must never become Worker runtime bindings or browser environment variables.

Run `pnpm test:security` for cold/warm scoped-install fixtures and
`pnpm test:workflows` for workflow contracts. The fixtures use generated dummy
packages, deny backend access to icon payloads, and verify warm reuse after an
unrelated lockfile change; they contain no Font Awesome assets.
