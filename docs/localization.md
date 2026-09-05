# Localization

Locale-prefixed URLs are not needed for this release. The archive content is
the same for every supported locale, and the selected language is resolved from
saved account settings, local preference, and browser/device language.

## QA Record

Checked on 2026-08-10 for ENG-62.

- Web: app-owned archive, settings, account, admin feature-flag, lightbox,
  drawer, sheet, and sidebar labels route through the local web UI catalog.
- Fallback: unsupported browser/device languages are passed through
  `resolveLocale(...)`, which falls back to `en-US`.
- Stored legacy `en` locale values are normalized to `en-US` before browser
  preferences are considered.
- Clerk: the web `ClerkProvider` maps app locales to Clerk localizations locally.

## Third-Party Surfaces

- Clerk owns hosted/sign-in/sign-up/account profile component copy; this release
  passes Clerk's localization object and does not override individual Clerk
  strings.
- Base UI and Vaul drawer/sheet primitives do not own visible copy in this app;
  app wrappers provide localized titles, descriptions, close text, and ARIA
  labels.
