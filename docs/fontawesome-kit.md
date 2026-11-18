# Font Awesome Kit upkeep

The web app bundles the Pro Kit [Pocket Trash Web](https://fontawesome.com/kits/64c2f1f813/icons)
(`@awesome.me/kit-64c2f1f813`). It uses Font Awesome 7.3.1 with **By Icon**
selection and package installation enabled. The reviewed
[icon inventory](fontawesome-icons.txt) contains 78 Classic Light, one Classic
Solid, and two Brands icons. Its text format can be imported directly into the
Kit's icon list.

The exact package revision is pinned in `apps/web/package.json`. Use individual
style imports rather than the full Light, Solid, or Brands packages. The
application migration is tracked in
[ENG-684](https://linear.app/pocket-trash/issue/ENG-684/migrate-web-icons-to-the-subsetted-kit).
Package identity, exact revision, integrity, compressed size, publication time,
and release-age eligibility are recorded in
[ENG-683](https://linear.app/pocket-trash/issue/ENG-683/prepare-the-reviewed-81-icon-font-awesome-kit).

Run `pnpm icons:check` after installation to compare all web and story imports
with the inventory and installed Kit exports. It rejects missing or extra icons,
style drift, full icon packs, and whole-Kit imports. Local import aliases are
preserved. Web builds and the root test commands run this check; backend builds
do not require the Kit. `pnpm test:icons` exercises the validator's public CLI
using synthetic definitions, without downloading or copying Pro assets.

Roy approved a temporary release-age exception only for the initial Kit revision
`1.0.4`. [ENG-687](https://linear.app/pocket-trash/issue/ENG-687/remove-the-temporary-kit-104-release-age-exception-after-maturity)
tracks removal after **2026-11-24T16:56:13Z**, when that revision matures. All other
packages and future Kit revisions retain the existing seven-day rule.

## Updating icons

1. Review the new icon's canonical name and exact family/style alongside all web
   imports, including stories. Update the inventory without silently changing a
   Light icon to Solid or selecting another family. The Light import
   `faQuestionCircle` is the alias of canonical `circle-question`; retain that
   local name when importing the Kit's `faCircleQuestion` export.
2. Have an authorized account owner update the Kit's **By Icon** inventory and
   save it. Importing a list only adds icons: remove obsolete or unintended
   icons separately and review the final list. Keep Font Awesome 7.3.1 selected
   unless a version change is also explicitly reviewed.
3. Read the generated npm package metadata and verify its exports against the
   inventory. Record the exact new version, integrity, compressed size, and
   publication time in the supporting Linear issue. Preserve the seven-day
   release-age policy; do not add an exemption for a new Kit revision.
4. Once eligible, pin the exact package version and commit the lockfile update
   with the inventory and import changes. Use individual style imports through
   `icons/classic/light`, `icons/classic/solid`, or `icons/classic/brands` and
   preserve local aliases. Run `pnpm icons:check`, `pnpm test:icons`, the existing
   web and Storybook checks, type checking, and `pnpm security:audit` before
   creating the PR. An inventory or validator change selects web, Storybook,
   preview, and safe E2E validation in CI.
5. Keep package authentication host-scoped and installation-only. Use bundled
   icons; a browser Kit script or CDN embed is not part of this integration.
   Do not commit downloaded Pro assets or package archives. Kit account updates
   remain reviewed operations, without automatic account mutations or new API
   credentials.

See Font Awesome's [Kit package API](https://docs.fontawesome.com/web/dig-deeper/kit-package-api/)
and [icon-list import format](https://docs.fontawesome.com/web/setup/kit-icon-lists/).
