# Trust the user-managed Font Awesome Kit

Roy approved a permanent release-age exception for
`@awesome.me/kit-64c2f1f813` on November 18, 2026. Roy controls the Kit's selected
icons and generated revisions through his Font Awesome account. Waiting seven
days and adding/removing an exception for every revision adds maintenance to
that owner-controlled workflow.

Use the exact package name in `minimumReleaseAgeExclude`, covering all versions
of this Kit. Its name comes from its Kit ID and stays the same when icons or
settings change. A different Kit ID requires a separate review. This replaces
the initial `1.0.4` exception and its scheduled removal.

The package includes generated JavaScript icon definitions as well as SVG
assets. This decision trusts the named Kit and its publisher workflow; it does
not assume SVG-only contents. New revisions still need exact dependency pins,
reviewed lockfile integrity, inventory/export validation and the dependency
audit. Package updates remain explicit changes rather than automatic account
mutations. Keep installation credentials host-scoped and out of public output.

Other Kits, framework packages and unrelated dependencies keep their current
release-age policy. Do not use an `@awesome.me/*` wildcard. Existing install
fixtures prove fresh revisions of this Kit install while other Font Awesome
packages remain age-gated.

Sources: [ENG-687](https://linear.app/pocket-trash/issue/ENG-687/permanently-exempt-the-user-managed-font-awesome-kit-from-release-age),
[pnpm package-name exclusions](https://pnpm.io/settings/dependency-resolution#minimumreleaseageexclude),
[Font Awesome Kit package identity](https://docs.fontawesome.com/web/setup/packages/).
