# Design System Reference Sheet

## 1. Brand Identity & Tone
- **Visual Identity:** Theme-aware archival product browser for machined pens; compact, technical, image-led, and filter-heavy.
- **Aesthetic Inspiration:** Precision-tool catalog and enthusiast archive rather than marketing site. The UI emphasizes scannability, specs, materials, and product photography.
- **Tone:** Utilitarian, quiet, data-rich, and maker-focused. Copy is direct and factual; interface labels are short.
- **Primary Experience:** Shared site chrome around route-owned content. Autmog provides its own searchable/filterable product grid, desktop filter panel, settings controls, and image/spec lightbox.

## 2. Primitive & Semantic Design Tokens
### Typography
- **Font Family:** `ui-sans-serif`, `system-ui`, `-apple-system`, `BlinkMacSystemFont`, `"Segoe UI"`, `Roboto`, `"Helvetica Neue"`, `Arial`, `"Noto Sans"`, sans-serif.
- **Base:** `15px/1.5` on `html, body`.
- **Header Title:** `18px`, `letter-spacing: 0.5px`; mobile `16px`, then `15px` below 480px.
- **Card Headline:** `15px/1.3`, `600`, clamped to 2 lines with reserved height.
- **Card Metadata:** `12px-13px`; subtitles use `12.5px/1.45`.
- **Section Labels:** `10px-12.5px`, uppercase, `letter-spacing: 0.8px-1.2px`, `600-700`.
- **Lightbox Title:** `28px/1.15`, `700`, slight negative tracking; mobile `22px`.
- **Descriptions:** `13.5px/1.6`, italic in the lightbox.

### Tailwind Theme Tokens
Use Tailwind v4 CSS-first tokens. The app must apply `.dark` on the document root for dark mode and remove it for light mode. The `system` theme setting follows `prefers-color-scheme` and updates when the system preference changes.

```css
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --chart-1: oklch(0.646 0.222 41.116);
  --chart-2: oklch(0.6 0.118 184.704);
  --chart-3: oklch(0.398 0.07 227.392);
  --chart-4: oklch(0.828 0.189 84.429);
  --chart-5: oklch(0.769 0.188 70.08);
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.205 0 0);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.97 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.708 0 0);
  --font-sans: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji';
  --font-serif: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  --radius: 0.625rem;
}

.dark {
  --background: oklch(0.000 0.000 0.000);
  --foreground: oklch(0.832 0.015 43.985);
  --card: oklch(0.000 0.000 0.000);
  --card-foreground: oklch(1.000 0.000 263.283);
  --popover: oklch(0.000 0.000 0.000);
  --popover-foreground: oklch(1.000 0.000 263.283);
  --primary: oklch(0.926 0.195 104.561);
  --primary-foreground: oklch(0.000 0.000 0.000);
  --secondary: oklch(0.521 0.000 263.283);
  --secondary-foreground: oklch(1.000 0.000 263.283);
  --muted: oklch(0.000 0.000 0.000);
  --muted-foreground: oklch(1.000 0.000 263.283);
  --accent: oklch(0.315 0.087 281.076);
  --accent-foreground: oklch(1.000 0.000 263.283);
  --destructive: oklch(0.579 0.136 336.939);
  --border: oklch(1.000 0.000 263.283 / 6%);
  --input: oklch(0.000 0.000 0.000);
  --ring: oklch(0.926 0.195 104.561);
  --chart-1: oklch(0.464 0.078 219.573);
  --chart-2: oklch(0.753 0.207 146.722);
  --chart-3: oklch(0.926 0.195 104.561);
  --chart-4: oklch(0.579 0.136 336.939);
  --chart-5: oklch(0.632 0.254 21.746);
  --sidebar: oklch(0.000 0.000 0.000);
  --sidebar-foreground: oklch(1.000 0.000 263.283);
  --sidebar-primary: oklch(0.926 0.195 104.561);
  --sidebar-primary-foreground: oklch(0.000 0.000 0.000);
  --sidebar-accent: oklch(1.000 0.000 263.283 / 6%);
  --sidebar-accent-foreground: oklch(1.000 0.000 263.283);
  --sidebar-border: oklch(0.5 0 0);
  --sidebar-ring: oklch(0.315 0.087 281.076);
  --font-sans: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji';
  --font-serif: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  --radius: 0.625rem;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
  --font-sans: var(--font-sans);
  --font-mono: var(--font-mono);
  --font-serif: var(--font-serif);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}
```

### Semantic Tailwind Usage
- Page backgrounds use `bg-background text-foreground`.
- Card and repeated item surfaces use `bg-card text-card-foreground border-border`.
- Sidebar and filter drawer surfaces use `bg-sidebar text-sidebar-foreground border-sidebar-border`.
- Inputs and selects use `bg-background border-input ring-ring`.
- Primary actions and active segmented controls use `bg-primary text-primary-foreground`.
- Secondary controls, inactive chips, and low-emphasis surfaces use `bg-secondary text-secondary-foreground`.
- Muted metadata uses `text-muted-foreground`.
- Radius classes should map to the tokenized scale: `rounded-md`, `rounded-lg`, and `rounded-xl`.

### Semantic Tag Colors
- Tags should use chart tokens instead of ad hoc hex colors.
- **Size:** `bg-chart-2/15 text-chart-2`.
- **Material:** `bg-chart-1/15 text-chart-1`.
- **Refill:** `bg-chart-3/15 text-chart-3`.
- **Tip / Nose:** `bg-chart-4/15 text-chart-4`.
- **Archived:** `bg-accent text-accent-foreground` or `border-border text-muted-foreground` when lower emphasis is needed.

## 3. Structural Layout Rules
- **Page Shell:** Sticky top header, route content, and a centered footer. The shell never owns route-specific sidebars or bottom toolbars.
- **Autmog Desktop Grid:** `grid-template-columns: 290px 1fr`, `gap: 20px`, `padding: 18px 22px 22px`.
- **Filter Sidebar:** Sticky at `top: 70px`, max height `calc(100vh - 90px)`, `10px` radius, hidden scrollbar, scrollable content.
- **Product Grid:** CSS grid with max 5 columns: `repeat(auto-fill, minmax(max(240px, calc((100% - 4 * 18px) / 5)), 1fr))`; `gap: 18px`.
- **Responsive Breakpoints:** At `max-width: 880px`, filters become a fixed slide-in drawer with scrim and grid becomes full width; at `max-width: 480px`, product grid becomes single column.
- **Mobile Grid:** `repeat(auto-fill, minmax(160px, 1fr))` between 480px and 880px.
- **Header Mobile Behavior:** Header wraps; search takes its own full-width row below title/count/sort/settings.
- **Card Constraints:** Product images use `aspect-ratio: 4 / 3`; cards reserve heights for headline, subtitle, metadata, dimensions, and tags to prevent uneven layout jumps.

## 4. Component Patterns
### Shared Header
- Sticky, translucent, blurred background using `bg-background/90`, `backdrop-blur`, and `border-border`.
- Keeps the Pocket Trash site name at the upper left with route breadcrumbs directly below it.
- Places the language selector, theme toggle, and account control at the upper right in that order.
- Signed-in users receive an avatar menu; signed-out users receive an explicit Sign In button.
- Route-specific actions and metadata wrap onto a separate header row when present.
- Inputs use Tailwind theme tokens: `bg-background`, `border-input`, `text-foreground`, `ring-ring`, and inherited font.

### Filter Chips
- Filters are grouped by Category, Size, Material, Refill, Mechanism, Clip, Body details, Tip / Nose, and Finish.
- Chips are rounded pills with small count badges.
- Active chips invert to accent fill and `--chip-on-text`.
- Multi-valued groups can show an `any | all` segmented pill; inactive pills reserve space with `visibility: hidden` to avoid header movement.

### Product Cards
- Card background `bg-card`, `1px` `border-border`, tokenized radius, clipped overflow.
- Hover state lifts card by `translateY(-2px)` and changes border to accent.
- Year badge is placed top-right on image with translucent panel background and blur.
- Headline is normalized into concise model language; original title is reserved for detail/search.
- Subtitle splits long title details into stacked lines.
- Metadata places price left and archived badge right.
- Dimensions use compact symbols for weight, diameter, and length.
- Tags use semantic colors for size, material, refill, and nose.

### Settings Drawer
- Right-side fixed drawer, `360px` wide, `max-width: 92vw`.
- Opens over a dark scrim with blur.
- Uses segmented controls for theme (`Light`, `Dark`, `System`), dimensions, and weight; select menu for currency.
- Gear button rotates when drawer is open.
- Theme mode persists in `localStorage` under `pocket-trash.theme`; units and weight persist under `pocket-trash.settings`; currency persists separately.

### Lightbox
- Full-screen dialog with dark blurred overlay.
- Desktop layout is two columns: image area `1.1fr`, info area `1fr`.
- Container max width `1280px`, border radius `14px`, heavy shadow.
- Opens from clicked card using FLIP-style transform and rotate animation.
- Includes carousel navigation, image counter, swipe navigation on touch, Escape close, and arrow-key image navigation.
- Mobile lightbox stacks image above info, uses a scrollable container, and pins close button near safe-area top.

### Footer
- Centered informational footer with max width `720px`.
- Uses muted text, top border, and underlined accent links for non-color link affordance.

## 5. Interaction & Motion
- **Motion Curve:** Primary expand/collapse transitions use `cubic-bezier(0.22, 0.65, 0.27, 1)`.
- **Durations:** Sidebar collapse around `280ms`; settings drawer `350ms`; lightbox enter `520ms`, exit `380ms`.
- **Hover States:** Accent border/color is the standard hover affordance for cards, chips, buttons, links, and controls.
- **Search:** Debounced at `150ms`; multi-token AND search across title, tags, price, and body text.
- **Sorting:** Supports date, price, weight, diameter, and title.
- **Persistence:** Theme mode (`light`, `dark`, `system`) persists as `pocket-trash.theme`; language persists in local storage; units, weight, and currency persist through user settings where available.

## 6. Content & Data Rules
- **Catalog Model:** Products are pens or accessories with titles, dates, price range, archived state, specs, local images, body text, and tag arrays.
- **Primary Product Attributes:** Size, material, refill, mechanism, clip state, body details, nose/tip, finish, diameter, weight, length, price, and release date.
- **Image Rule:** Prefer local archived images from `images_local`; fall back to product image if needed.
- **Currency Rule:** Native prices are CAD; other currencies are estimated from cached FX rates plus a Shopify Markets markup.
- **Archived Rule:** Archived items remain searchable and visible, with an explicit badge rather than removal.

## 7. Accessibility & Usability Notes
- Dark and light theme tokens must be checked for readable contrast in the implemented UI states.
- System theme mode must respect `prefers-color-scheme` and update without requiring a page refresh.
- Search, sort, settings, filters, and dialogs include ARIA labels or dialog roles.
- Links are underlined in the footer so they are distinguishable without color alone.
- Mobile Autmog filters use a scrim and bottom-sheet controls.
- Layout reserves space for dynamic controls and text blocks to reduce layout shift.
