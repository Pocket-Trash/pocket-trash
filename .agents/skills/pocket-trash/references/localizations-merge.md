# Localizations Merge

Merge planned localization files into the `Pocket-Trash/localizations` repo.

This workflow is only intended for the `Pocket-Trash/localizations` repo. Before
using it, confirm the current repo with the router repo-scope check.

## Workflow

1. Find every root file matching `plan-add-localizations-*.md`, including
   same-day suffixed files such as `plan-add-localizations-fri-sep-4-1.md`. Sort
   by filename.
2. If no files exist, report that there are no planned localizations to merge.
3. For each file, extract the single fenced `json` block and parse it as:

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

4. Validate that `en-US` and `es-MX` exist and contain the same dot-path keys.
5. Before editing, compare each planned key against keys already present in:
   `src/types/localization.ts`, `src/localizations/en-US.ts`,
   `src/localizations/es-MX.ts`, and plan files already processed during this
   run.
6. Also compare each planned English value against existing English catalog
   values. If the exact string, a near-identical string, or the same product/app
   concept already exists under another key, flag it before adding a new key.
   Show the incoming key/value and the existing key/value, then ask whether to
   reuse the existing key and value instead. For example, if incoming
   `site.name` is `"Machined Pen Archive"` but existing `app.name` is
   `"Pocket Trash"`, ask whether the caller should use `app.name` and keep
   `"Pocket Trash"` instead of adding `site.name`.
7. Track every case where the user chooses an existing key instead of the
   incoming key. Record the incoming key, incoming value, chosen existing key,
   and chosen existing value.
8. Skip duplicate keys only when the existing value is identical for the same
   locale. If a duplicate key has different translations, report the conflicting
   values and ask the user which value to keep before continuing.
9. Show the parsed keys for the current file and ask for confirmation before
   merging that file.
10. Add new keys to `CompleteLocalizationResource` in
    `src/types/localization.ts`, add English values to
    `src/localizations/en-US.ts`, and add Spanish Mexico values to
    `src/localizations/es-MX.ts`.
11. Run `pnpm localization:sync`.
12. Delete the processed plan file only after the merge and sync complete.
13. Repeat for the next matching file.
14. At the end, if any incoming keys were replaced by existing keys, show a
    copyable prompt for the developer to pass to the Pocket Trash repo agent.
    Include every replacement and tell the agent to update callers from the
    incoming key to the chosen existing key, removing any now-unused planned key
    references. Use this shape:

    ```text
    In the Pocket Trash repo, resolve localization key changes from the localizations merge:
    - Replace incoming `site.name` ("Machined Pen Archive") with existing `app.name` ("Pocket Trash").

    Update all callers that were changed to use the incoming keys so they use the existing keys instead.
    ```

15. At the end, tell the user to use `$pocket-trash commit`, then
    `$pocket-trash pr-create` or `$pocket-trash pr-update`.

## Error Handling

- If the current repo is not localizations, stop and report the detected repo.
- If a plan file has no fenced `json` block, has multiple `json` blocks, or
  cannot be parsed, skip that file and ask the user how to proceed.
- If planned locale key sets differ, stop on that file and ask for the missing
  values.
- If duplicate keys have conflicting translations, do not edit catalogs until
  the user chooses the value to keep.
- If an incoming value appears to duplicate an existing concept under another
  key, do not add the new key until the user chooses whether to reuse the
  existing key/value or add the new one anyway.
