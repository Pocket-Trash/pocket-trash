# Localizations Local Dev With yalc

Use this when `pocket-trash` and `localizations` are cloned side by side:

```txt
workspace/
  pocket-trash/
  localizations/
```

## Install yalc

Install yalc once:

```sh
pnpm add -g yalc
```

Confirm it is available:

```sh
yalc --version
```

## Publish localizations locally

From the `localizations` repo:

```sh
cd ../localizations
pnpm install
pnpm build
yalc publish
```

`yalc publish` copies the package's publishable files into yalc's local store.
For this package, that means the built `dist` output.

## Add localizations to Pocket Trash

From the `pocket-trash` repo:

```sh
cd ../pocket-trash
yalc add @pocket-trash/localizations --link
pnpm install
```

Then run Pocket Trash:

```sh
pnpm dev
```

## Reflect localizations changes

After changing files in `localizations`, rebuild and push the updated package
into Pocket Trash:

```sh
cd ../localizations
pnpm build
yalc push
```

If you are actively editing localizations, keep TypeScript watch running in one
terminal:

```sh
cd ../localizations
pnpm dev
```

After each rebuild, push the current yalc package:

```sh
yalc push --changed
```

## Undo yalc

From the `pocket-trash` repo:

```sh
yalc remove @pocket-trash/localizations
pnpm install
```

## Notes

- `pnpm dev` in `localizations` rebuilds `dist`; it does not push changes into
  Pocket Trash by itself.
- `yalc push` is the step that updates Pocket Trash's local copy.
- If Pocket Trash does not reflect a pushed change, restart `pnpm dev`; Vite can
  cache dependencies during local development.
