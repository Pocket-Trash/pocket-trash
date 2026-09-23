# Design System Reference Sheet

## 1. Brand Identity & Tone
- **Visual Identity:** Theme-aware archival product browser for machined pens; compact, technical, image-led, and filter-heavy.
- **Aesthetic Inspiration:** Precision-tool catalog and enthusiast archive rather than marketing site. The UI emphasizes scannability, specs, materials, and product photography.
- **Tone:** Utilitarian, quiet, data-rich, and maker-focused. Copy is direct and factual; interface labels are short.
- **Primary Experience:** Shared site chrome around route-owned content. Autmog provides its own searchable/filterable product grid, desktop filter panel, settings controls, and image/spec lightbox.

## 2. Primitive & Semantic Design Tokens
### Typography
- **Font Family:** `"Geist Mono Variable"`, `"Geist Mono"`, monospace for sans, serif, and mono roles.
- **Base:** `15px/1.5` on `html, body`.
- **Header Title:** `18px`, `letter-spacing: 0.5px`; mobile `16px`, then `15px` below 480px.
- **Card Headline:** `15px/1.3`, `600`, clamped to 2 lines with reserved height.
- **Card Metadata:** `12px-13px`; subtitles use `12.5px/1.45`.
- **Section Labels:** `10px-12.5px`, uppercase, `letter-spacing: 0.8px-1.2px`, `600-700`.
- **Lightbox Title:** `28px/1.15`, `700`, slight negative tracking; mobile `22px`.
- **Descriptions:** `13.5px/1.6`, italic in the lightbox.

### Tailwind Theme Tokens
Use Tailwind v4 CSS-first tokens. The app must apply `.dark` on the document root for dark mode and remove it for light mode. The `system` theme setting follows `prefers-color-scheme` and updates when the system preference changes.

The Advent of Code palette is the visual source. The foreground, focus-ring, and control-border adjustments below preserve its colors while meeting normal-text and interactive-control contrast requirements.

```css
:root {
  color-scheme: light;
  --background: #f7f7f7;
  --foreground: #333333;
  --card: #ffffff;
  --card-foreground: #333333;
  --popover: #ffffff;
  --popover-foreground: #333333;
  --primary: #705800;
  --primary-foreground: #ffffff;
  --secondary: #3178c6;
  --secondary-foreground: #ffffff;
  --muted: #aaaaaa;
  --muted-foreground: #333333;
  --accent: #f7dc6f;
  --accent-foreground: #333333;
  --destructive: #cc3737;
  --destructive-foreground: #ffffff;
  --border: #cccccc;
  --input: #ffffff;
  --control-border: #8c8c8c;
  --ring: #3178c6;
  --chart-1: #f7dc6f;
  --chart-2: #3178c6;
  --chart-3: #8e44ad;
  --chart-4: #1abc9c;
  --chart-5: #16a085;
  --sidebar: #f7f7f7;
  --sidebar-foreground: #333333;
  --sidebar-primary: #705800;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: #f7dc6f;
  --sidebar-accent-foreground: #333333;
  --sidebar-border: #cccccc;
  --sidebar-ring: #3178c6;
  --font-sans: "Geist Mono Variable", "Geist Mono", monospace;
  --font-serif: "Geist Mono Variable", "Geist Mono", monospace;
  --font-mono: "Geist Mono Variable", "Geist Mono", monospace;
  --radius: 0px;
}

.dark {
  color-scheme: dark;
  --background: #333333;
  --foreground: #ffffff;
  --card: #444444;
  --card-foreground: #ffffff;
  --popover: #444444;
  --popover-foreground: #ffffff;
  --primary: #f2c464;
  --primary-foreground: #333333;
  --secondary: #6688cc;
  --secondary-foreground: #111111;
  --muted: #666666;
  --muted-foreground: #ffffff;
  --accent: #f2c464;
  --accent-foreground: #333333;
  --destructive: #cc3737;
  --destructive-foreground: #ffffff;
  --border: #555555;
  --input: #444444;
  --control-border: #909090;
  --ring: #f2c464;
  --chart-1: #f2c464;
  --chart-2: #6688cc;
  --chart-3: #7a288a;
  --chart-4: #1abc9c;
  --chart-5: #16a085;
  --sidebar: #333333;
  --sidebar-foreground: #ffffff;
  --sidebar-primary: #f2c464;
  --sidebar-primary-foreground: #333333;
  --sidebar-accent: #f2c464;
  --sidebar-accent-foreground: #333333;
  --sidebar-border: #555555;
  --sidebar-ring: #f2c464;
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
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--control-border);
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
  --radius-sm: var(--radius);
  --radius-md: var(--radius);
  --radius-lg: var(--radius);
  --radius-xl: var(--radius);
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
- **Page Shell:** Sticky top header, two-column main area, footer centered below grid.
- **Desktop Main Grid:** `grid-template-columns: 290px 1fr`, `gap: 20px`, `padding: 18px 22px 22px`.
- **Filter Sidebar:** Sticky at `top: 70px`, max height `calc(100vh - 90px)`, square corners, hidden scrollbar, scrollable content.
- **Collapsed Filters:** Body class `filters-closed` changes main to `0 1fr`, sets `gap: 0`, and reveals a fixed vertical edge tab.
- **Product Grid:** CSS grid with max 5 columns: `repeat(auto-fill, minmax(max(240px, calc((100% - 4 * 18px) / 5)), 1fr))`; `gap: 18px`.
- **Responsive Breakpoints:** At `max-width: 880px`, Autmog filters become a fixed slide-in drawer with scrim and its grid becomes full width; at `max-width: 480px`, product grids become single column. Catalog filters use their mobile sheet through 880px and their desktop overlay from 881px.
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

### Catalog Filters
- `/products`, `/collections`, and `/user/collections` own a compact filter row beneath the breadcrumbs. It is route content, not global App Shell content. Keep the primary route action on the same row when space permits.
- Product Type is a combobox and scopes the available Material, Finish, Colour, fade, and Maker facets. Product Type choices remain stable while the scope changes.
- Material and Finish expose the five most common values as checkboxes. Colour combines solid colours and fades, orders them by occurrence, and exposes the five most common choices as toggle buttons. Each facet's More control overlays additional choices instead of moving the product or collection grid.
- Frequency comes from product associations on `/products` and collection-item occurrences on collection routes. Ordinary filter selections do not remove available facet choices; changing Product Type may prune selections unavailable in the new scope.
- A colour swatch shows its stored hex value. A fade swatch uses overlapping circles in its stored display order. Every swatch has a name tooltip and accessible label, and communicates selection with both `aria-pressed` and a visible border.
- More Filters opens an anchored overlay on desktop without changing document flow and a bottom sheet through 880px. The expanded controls contain Maker and Match Mode; the desktop layout starts at 881px.
- The default Any mode uses OR within a facet and AND between facets. Finish, colour, and fade criteria must match the same finish option. All mode changes within-facet matching to AND. Fade matching is direction-insensitive and accepts close variations containing all selected colours, including repeated or intermediate colours.
- Clear filters restores the unfiltered state. Filter state persists in URL search parameters; URL writes use a 300ms debounce and replace the current history entry.
- These filters are separate from Autmog and do not change Autmog's sidebar, chips, matching, or persistence behavior.

### Autmog Filter Chips
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

### User Settings
- Signed-in display preferences live at `/user/settings` in a left-aligned, readable-width form.
- Uses segmented controls for dimensions and weight and a select menu for currency.
- Language is available globally in the shared header; signed-out choices persist locally, while authenticated choices sync to user settings.
- Theme is available globally in the shared header and persists in `localStorage` under `pocket-trash.theme`.

### Lightbox
- Full-screen dialog with dark blurred overlay.
- Desktop layout is two columns: image area `1.1fr`, info area `1fr`.
- Container max width `1280px`, square corners, heavy shadow.
- Opens from clicked card using FLIP-style transform and rotate animation.
- Includes carousel navigation, image counter, swipe navigation on touch, Escape close, and arrow-key image navigation.
- Mobile lightbox stacks image above info, uses a scrollable container, and pins close button near safe-area top.

### Footer
- Centered informational footer with max width `720px`.
- Uses muted text, top border, and underlined accent links for non-color link affordance.

## 5. Interaction & Motion
- **Motion Curve:** Primary expand/collapse transitions use `cubic-bezier(0.22, 0.65, 0.27, 1)`.
- **Durations:** Autmog filter drawer transitions use the primary motion curve; lightbox enter is `520ms` and exit is `380ms`.
- **Hover States:** Accent border/color is the standard hover affordance for cards, chips, buttons, links, and controls.
- **Search:** Debounced at `150ms`; multi-token AND search across title, tags, price, and body text.
- **Sorting:** Supports date, price, weight, diameter, and title.
- **Catalog Filter Persistence:** Product and collection filters serialize to route search parameters after a `300ms` debounce and replace the current history entry.
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
- Catalog colour and fade toggles include tooltips, accessible names, `aria-pressed`, and a non-colour selected-state border.
- Links are underlined in the footer so they are distinguishable without color alone.
- Mobile Autmog filters use a scrim and bottom-sheet controls.
- Layout reserves space for dynamic controls and text blocks to reduce layout shift.
