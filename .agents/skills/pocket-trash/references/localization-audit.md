# Localization Audit

Audit Pocket Trash code for user-visible strings that are not localized.

This workflow is only intended for the `Pocket-Trash/pocket-trash` repo. Before
using it, confirm the current repo with the router repo-scope check.

## Workflow

1. Search app and package source for plain language strings that could be shown
   to users while using the app.
2. Include UI/components, web flows, existing app logic, API/server responses,
   user-displayed errors, toast messages, placeholders, labels, titles, ARIA
   text, and package errors/messages that can surface through the app or API.
3. Search at least:
   - JSX text nodes and string props such as `aria-label`, `placeholder`,
     `title`, and `alt`.
   - `toast.*`, `new Error(...)`, `throw new Error(...)`, response bodies, and
     constants imported into UI or API paths.
   - `apps/**` and `packages/**`, excluding generated files and tests.
4. Ignore strings that are not user-visible: tests, docs, logger event names,
   storage keys, route paths, env var names, CSS classes, database identifiers,
   source product content, internal CLI/CI-only messages, and developer-only
   invariant errors.
5. For each finding, report:
   - file and line,
   - the string,
   - why it appears user-visible,
   - the recommended localization key.
6. Do not edit files unless the user explicitly asks for fixes. If fixes are
   requested, use `$pocket-trash localize` for every new key.

## Error Handling

- If the current repo is not Pocket Trash, stop and report the detected repo.
- If a string's visibility is unclear, include it as "needs review" instead of
  silently ignoring it.
