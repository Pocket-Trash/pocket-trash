# Localization

Pocket Trash user-visible text lives in `@pocket-trash/localizations`. Use that
package for UI labels, component text, document metadata, API responses, toast
messages, and errors shown to users.

The app can use the published package from npm, or developers can clone the
localizations repo and link it for local development. See
[Localizations Local Dev With yalc](./localizations-yalc-local-dev.md) for the
local clone/link workflow.

## Implement Text

Do not add hard-coded user-visible strings in Pocket Trash code. Add the key and
translations in the localizations repo, then consume the key here.

Use semantic keys, not English text, as localization keys. Do not add app-local
catalogs such as `apps/web/src/lib/ui-text.ts`.

Use a local `t(...)` helper for new localized strings and migrations. In React
components, define it after reading the current locale:

```tsx
import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { useLocale } from "@/providers/locale-provider";

function SaveButton() {
  const { locale } = useLocale();
  const t = (key: TranslationKey) => formatTranslation(key, {}, locale);

  return <button type="button">{t("action.save")}</button>;
}
```

When a string has placeholders, keep the same local helper shape and pass the
values through:

```ts
import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";

const t = (
  key: TranslationKey,
  values: Readonly<Record<string, unknown>> = {},
) => formatTranslation(key, values, locale);

const message = t("web.archive.itemCount", { visible, total });
```

Use placeholders instead of building translated sentences from pieces:

```ts
t("locale.current", { locale });
```

Use the same `t(...)` pattern outside React anywhere a locale is already
available.

Use `localizedServerError` for server errors that can be shown to users. It is
the app wrapper around package localization:

```ts
import { localizedServerError } from "@/lib/server-errors";

throw localizedServerError("error.generic", locale);
```
