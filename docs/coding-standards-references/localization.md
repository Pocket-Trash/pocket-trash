# Localization

- Put all user-visible text (UI, metadata, API responses, toasts and errors) in `@pocket-trash/localizations`. Add semantic keys and translations in that repository before consumption; use the localization workflow to track changes. Keep catalogs out of app code.
- Read the current locale before defining a local `t(...)` helper around `formatTranslation(key, values, locale)`. Use the same helper outside React wherever a locale exists.
- Pass placeholder values to the helper; translate complete sentences rather than concatenated fragments.
- Use `localizedServerError` from `@/lib/server-errors` for user-visible server errors.
- Follow the [yalc runbook](../localizations-yalc-local-dev.md) for local linking or use the published package.
