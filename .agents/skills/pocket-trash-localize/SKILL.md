---
name: pocket-trash-localize
description: Add or track Pocket Trash user-visible localized text.
---

# Localize

Add or track Pocket Trash user-visible text through
`@pocket-trash/localizations`.

This workflow is only intended for the `Pocket-Trash/pocket-trash` repo. Before
using it, confirm the current repo with `git remote get-url origin`. If that
does not identify `Pocket-Trash/pocket-trash`, inspect the root `package.json`;
treat it as Pocket Trash only when the package name is `pocket-trash.app`.

If the current repo is not Pocket Trash, stop before running commands or making
changes. Name the repo you detected when possible and ask whether the user wants
to continue even though the workflow might not work.

## Workflow

1. Identify every added or modified string that a user can see: UI text,
   component labels, placeholders, titles, ARIA text, toast messages, API/server
   responses, and errors displayed to users.
2. Replace those strings with existing localization helpers when editing code.
   Use `@pocket-trash/localizations` as the source of truth for all new keys; do
   not add new app-local catalogs such as `apps/web/src/lib/ui-text.ts`.
3. Keep a working JSON object for the new keys and both required locales:

   ```json
   {
     "en-US": {
       "some.key": "English text"
     },
     "es-MX": {
       "some.key": "Spanish Mexico text"
     }
   }
   ```

4. Require the same key set in `en-US` and `es-MX`. If the Spanish Mexico text
   is unknown, ask the user for it instead of guessing.
5. Ask the user for the path to the localizations repo. Accept relative or
   absolute paths. Resolve relative paths from the current working directory.
6. Verify the target path is the `Pocket-Trash/localizations` repo by checking
   `git remote get-url origin` or the root `package.json` name
   `@pocket-trash/localizations`.
7. Build the plan filename from the current date as
   `plan-add-localizations-fri-sep-4.md`, using lowercase abbreviated weekday,
   lowercase abbreviated month, and numeric day with no leading zero.
8. If that file already exists, assume it belongs to another agent, process, or
   developer. Pick the next available suffix instead:
   `plan-add-localizations-fri-sep-4-1.md`, then `-2.md`, and so on.
9. Show the target file path and JSON, then ask permission before writing.
10. Write Markdown containing only one fenced `json` code block with the JSON
    object. Do not overwrite or append to an existing plan file.

## Error Handling

- If the current repo is not Pocket Trash, stop and report the detected repo.
- If the target path is not the localizations repo, stop and ask for the correct
  path.
- If any `en-US` key is missing from `es-MX`, or the reverse, stop and ask for
  the missing translation.
