# Mobile-Friendly Web (Native Feel)

Goal: a mobile-friendly version of the site that feels like a native iOS app but
stays **pure web** — no native app, no webview wrapper. Responsive and easy to
navigate across iPhone, iPad, and Android, in portrait and landscape.

## Approach

Stay on the existing `apps/web` stack (TanStack Start / React DOM) and ship it as
an installable PWA with a mobile-first layout and native-feel interactions. One
codebase, one URL; the "app" feel comes from layout, gestures, and standalone
install — not from leaving the web. We are **not** building the Expo native app
or a webview wrapper.

## Responsive tiers

- **Compact** (iPhone / small Android, `< 768px`) — single/2-column grid, slim
  top bar, bottom toolbar + sheets (below).
- **Regular** (iPad portrait and up, `≥ 768px` — including landscape and large
  tablets) — persistent filter sidebar as a two-pane layout, roomier grid.
- Set the two-pane threshold at **~768px**, bumped down from today's 881px so
  iPad portrait gets the sidebar rather than the phone toolbar. Keep the 481px
  single→two-column grid step, and layer safe-area + `dvh` on top so notches and
  the home indicator are handled on both iOS and Android.

## Bottom toolbar of actions (compact screens)

The archive's controls move from the top header to a thumb-reachable bottom bar.
This is a _toolbar_ (each item opens a sheet), not a navigation tab bar — it does
not switch screens. Four items:

- **Search** — magnifier that expands a field docked above the keyboard.
- **Filters** — opens the filter sheet; shows an active-filter count badge.
- **Sort** — opens a compact sheet of the sort options.
- **Settings** — opens the settings sheet (currency / units / theme).

Pad with `env(safe-area-inset-bottom)`, 44pt+ targets, ≤5 items. Keep navigation
out of it: account / collections live behind a top-bar avatar, not in the
toolbar. On Regular screens the toolbar gives way to the persistent sidebar.

## Native-feel details

- **Sheets** — filters / sort / settings as bottom sheets with snap points and
  swipe-to-dismiss, replacing the desktop slide-in drawers on compact screens.
- **Popup** — the lightbox already swipes between images; add
  swipe-down-to-dismiss, momentum, and route-backed open (ties into
  `shareable-pen-links.md`, so back button and share both work).
- **Polish** — `viewport-fit=cover` + `env(safe-area-inset-*)`, `100dvh/svh`,
  `overscroll-behavior: contain`, kill tap highlight / text-size-adjust /
  double-tap zoom, skeleton loaders (already in `components/skeletons`),
  pull-to-refresh.

## Installable PWA

> **Status: DEFERRED (2026-07-04).** The breakpoint/native-feel, compact
> toolbar + bottom sheets, and lightbox-polish slices are done; this PWA slice is
> on hold **pending the brand asset set** (see "Still needed" below). Build order
> and open decisions: `handoff-mobile-native.md` §3.3 / §4.
>
> When picked up, it needs: web manifest + `vite-plugin-pwa`/Workbox service
> worker (precache app shell + product data + 141 primary images; leave the full
> 344MB catalog uncached), `theme-color` / `apple-touch-icon` / maskable icons,
> and the install affordance (Android `beforeinstallprompt`, iOS A2HS hint in the
> Settings sheet, suppressed when already standalone).

- Web manifest (`display: standalone`, theme/background color), maskable + Apple
  touch icons, splash.
- **Offline scope** — the service worker (Vite PWA / Workbox) precaches the app
  shell, the product data (~0.6MB), and the 141 primary images (~38MB), so the
  grid is complete offline. Gallery/detail images cache on view
  (stale-while-revalidate, capped LRU). The full 344MB catalog is _not_
  precached — too large for iOS cache quotas.
- **Install** — a low-key, once-per-user, dismissible affordance in the settings
  sheet: Android fires the real `beforeinstallprompt`; iOS shows an
  Add-to-Home-Screen hint (there's no API to trigger it). Suppress it when
  already running standalone, and surface it after engagement, not on first
  paint.

## Still needed

- Brand asset set for the PWA: app icon (192 / 512 / maskable), Apple touch
  icon, splash, and theme + background colors.
