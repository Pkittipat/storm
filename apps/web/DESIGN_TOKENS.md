# Design tokens

Source of truth: [`src/styles/tokens.css`](src/styles/tokens.css) (each token has a fuller
"Usage:" comment there — read it before using a token you don't recognize).
Extracted from the "Stormm — Process canvas" design artifact. Tailwind v4 turns every
`--color-*` / `--text-*` / `--radius-*` / `--shadow-*` key below into a matching utility
class automatically (e.g. `--color-surface-sunken` → `bg-surface-sunken`).

Every raw measurement in the source design is an exact multiple of Tailwind's default 4px
spacing unit, so these named `--spacing-*` tokens don't change what renders — they exist
purely so a reader (or an agent) reaches for `gap-step-sm` instead of reverse-engineering
"this needs to be 8px" from memory. Font **weight** also uses Tailwind's stock `font-normal`
/ `font-medium` / `font-semibold` (400/500/600) unchanged.

⚠️ **Never define a bare `--spacing-xs`/`sm`/`md`/`lg`/`xl`/`2xl`/`3xl`** (no prefix) — those
names collide with Tailwind's own `w-*`/`h-*`/`max-w-*`/`min-w-*` sizing scale, which resolves
named sizes through the same `--spacing-*` theme namespace. This bit us once during
development (`max-w-2xl` silently started resolving to a bare `--spacing-2xl: 16px` instead
of Tailwind's built-in 42rem container size, collapsing the composer bar to 16px wide). Every
token below is prefixed (`step-`, `control-`, `indicator-`, or a unique name) specifically to
rule this out.

## Surface (3-tier elevation)

| Class | Value | Use for |
|---|---|---|
| `bg-surface` | `#FBFAF8` | App/page background, canvas background, recessed code blocks |
| `bg-surface-sunken` | `#F4F3EF` | Sidebar nav rail, docked inspector panel; Menu item hover |
| `bg-surface-raised` | `#FFFFFF` | Floating controls: bordered buttons, zoom stepper, composer, dropdown menus, undocked inspector |
| `bg-surface-selected` | `#EAE8E3` | Active item inside sunken chrome: current nav link, active tab |
| `bg-surface-hover` | `#EEECE8` | Hover fill for rows in sunken chrome: NavItem, sidebar "New" row (NavProject headings stay unfilled) |

## Border (graduated hairlines)

| Class | Value | Use for |
|---|---|---|
| `border-border` | `#E6E4DF` | Default hairline on surface-sunken (sidebar edge, panel dividers); Menu section divider |
| `border-border-subtle` | `#ECEAE5` | Lightest hairline — app header bottom border only |
| `border-border-input` | `#E0DED8` | Bordered control on surface-raised (e.g. "Share" button); sidebar search field ring |
| `border-border-elevated` | `#E3E1DB` | Floating/shadowed surfaces (composer, dropdown menus) |
| `border-border-dot` | `#A3A09A` | Inactive small indicator dot ring |
| `border-port` | `#A9A6A0` | Default (unselected) canvas block connector-port ring |
| `text-connector` / stroke | `#9C9993` | Canvas connector lines between blocks (1.5px, round cap, no arrowhead) |
| canvas bg pattern | `#DAD7D0` | Dot-grid background on the canvas |

## Text

| Class | Value | Use for |
|---|---|---|
| `text-text` | `#1A1A18` | Primary text/icons; also fill for inverted elements (avatar, primary button bg) |
| `text-text-secondary` | `#3A3935` | Standalone numeric/mono readouts (e.g. zoom %) — narrow use |
| `text-text-muted` | `#6B6A65` | Secondary/supporting text, icon-button color, helper/meta text |
| `text-text-placeholder` | `#8A8882` | Input placeholders only |

## Accent

| Class | Value | Use for |
|---|---|---|
| `bg-accent` / `border-accent` | `#2F6FEB` | Selected block border, Command swatch, focus/selection. Pair with `ring-4 ring-accent/[14%]` |
| `bg-accent-subtle` | `#E8EFFC` | Selected/active accent-colored surface fill |
| `text-accent-text` | `#22509F` | Accent eyebrow label text on transparent bg |

## Block types (event-storming palette)

Each type: swatch/dot, card fill (`-surface`), card border (`-line`).

| Type | Swatch | Surface | Line | Meaning |
|---|---|---|---|---|
| `readmodel` | `#3F8A4B` | `#EAF4EC` | `#D2E6D6` | Query-side view (e.g. Cart) |
| `command` | `#2F6FEB` | `#E8EFFC` | `#CFDDF7` | User/system intent (e.g. Place Order) |
| `aggregate` | `#C99A12` | `#FCF3D7` | `#EFE0AE` | Owns state + rules (e.g. Order) |
| `event` | `#E0692E` | `#FCEBDF` | `#F2D2BC` | Fact that happened (e.g. Order Placed) |
| `policy` | `#7B5CD6` | `#F0EBFA` | `#DDD3F2` | Reactive rule ("whenever X, do Y") |
| `system` | `#D1467F` | `#FAEBF1` *(derived)* | `#F4D5E2` *(derived)* | External system |

A **selected** block ignores `-line` and uses a 1.5px `border-accent` + `ring-4 ring-accent/[14%]` instead, regardless of type. System's values marked *derived* were never directly rendered in the source artifact (only the swatch was shown) — they're computed with the same lightening ratio measured across the other types; confirm visually before treating as final.

## Tags / status chips

| Class | Value | Use for |
|---|---|---|
| `bg-actor` / `text-actor-text` | `#F7D54A` / `#3D3000` | Actor chip (e.g. "Customer") |
| `bg-hotspot-surface` / `text-hotspot-text` | `#FBE3E0` / `#A8291F` | Hotspot-count chip on a block; `text-hotspot-text` also for error notices and destructive Menu items |
| `bg-hotspot-dot` | `#C2362B` | Warning dot in the Hotspots list (not interchangeable with hotspot-text) |

## Typography

| Class | Size | Use for |
|---|---|---|
| `font-sans` | Geist | Default UI typeface (overrides Tailwind default) |
| `font-mono` | Geist Mono | Code, field keys/types, numeric values, eyebrow labels |
| `text-micro` | 11px | Uppercase micro-labels/eyebrows |
| `text-meta` | 12px | Secondary meta text, mono readouts |
| `text-label` | 13px | Toolbar buttons, section labels, sidebar "Projects" heading + search, Menu items |
| `text-body` | 14px | Default interactive/body text (most-used size) |
| `text-emphasis` | 15px | Block/card titles, page h1, composer input |
| `text-heading` | 16px | Wordmark, inspector panel heading |
| `text-chip` | 11.5px | Compact pill/tag labels only |
| `text-mono-field` | 12.5px | Inspector mono key/value rows only |
| `tracking-heading` | -0.01em | Pair with `text-heading` |
| `tracking-label` | 0.06em | Pair with `text-micro` + `uppercase` (sans) |
| `tracking-mono-label` | 0.04em | Pair with `text-micro` + `font-mono` + `uppercase` |

These are namespaced away from Tailwind's default `text-xs`/`sm`/`base`/`lg` scale on purpose — the two scales don't collide, so Tailwind defaults remain available unmodified elsewhere.

## Spacing

Three groups, all under the shared `--spacing-*` theme namespace (so `step-sm` works with
`gap-`, `p-`, `px-`, `m-`, `top-`, etc. — the "Use for" column says which utility a token is
actually meant for).

**Inset & gap scale** — the shared small-spacing rhythm behind padding, margin and gap:

| Class | Value | Use for |
|---|---|---|
| `step-3xs` | 2px | Tightest gap — Tabs strip, ZoomControl's internal button gap |
| `step-2xs` | 4px | Tight icon+label gaps (Chip), list-stacking gaps (Sidebar nav list, BlockCard wrapper/footer) |
| `step-xs` | 6px | BlockCard's internal content gap, eyebrow swatch-to-label gap (BlockCard, Panel) |
| `step-sm` | 8px | Button icon+label gap, Composer's row gap, Header's action gap, ZoomControl/AddBlockMenu inset |
| `step-md` | 10px | AddBlockMenu item gap, Sidebar wordmark/footer gaps, standard row inset (NavItem, Tabs, FieldRow) |
| `step-lg` | 12px | NavItem/Header leading-icon gap, BlockCard padding, Sidebar/Panel outer padding, Flow row gap |
| `step-xl` | 14px | PanelSection's divider top-margin/padding rhythm; gap between sidebar NavProject groups |
| `step-2xl` | 16px | Header's outer edge padding, floating Panel's inset from the viewport edge, NavItem's left inset |
| `step-3xl` | 24px | Header's default left padding, Composer's inset from the canvas edges |
| `nav-group-gap` | 22px | ONLY the top margin above a second+ sidebar NavGroupLabel |
| `nav-section-gap` | 20px | ONLY the top margin between the sidebar's "New" row and the "Projects" heading |
| `chip-inset` | 7px | ONLY Chip's horizontal padding (half-step between step-xs and step-sm) |

**Control size** — recurring interactive-element heights (and, where noted, widths):

| Class | Value | Use for |
|---|---|---|
| `control-2xs` | 22px | Chip height |
| `control-xs` | 28px | IconButton `sm`, ZoomControl's +/− buttons, PanelSection header row, sidebar "Projects" row + search field, NavItem's right padding for its ⋮ action; IconButton `sm` is also every sidebar row action (`+`, search, sort, ⋮) |
| `control-sm` | 30px | Avatar diameter, Menu/AddBlockMenu item row, ZoomControl button width |
| `control-md` | 32px | IconButton `md`, NavItem, NavProject heading, Tabs, FieldRow |
| `control-lg` | 36px | Button (toolbar), ZoomControl shell, Composer's send button, sidebar "New" row |
| `control-xl` | 40px | Composer's add-block button and text input |

**Indicator size** — small circular/square status marks:

| Class | Value | Use for |
|---|---|---|
| `indicator-xs` | 6px | NavItem's status dot; TypeSwatch `xs` (BlockCard/Panel eyebrow) |
| `indicator-sm` | 7px | TypeSwatch `sm` (inspector Flow list) |
| `indicator-md` | 8px | TypeSwatch `md` (Add-block menu items) |
| `indicator-lg` | 9px | BlockCard's connector-port dot |
| `indicator-offset` | 5px | How far a port dot hangs off its card's edge (always negative) |

**Structure** — one-off layout constants: `header-height`(56px), `sidebar-width`(256px),
`panel-width`(288px), `node-width`(140px), `node-height`(104px), `menu-width`(184px — every
Menu: AddBlockMenu, the sidebar's sort/project/process menus).

## Radius

Most radii reuse Tailwind's default scale directly: `rounded-xs` (2px, swatches), `rounded-md`
(6px, chips/icon buttons), `rounded-lg` (8px, list items), `rounded-xl` (12px, dropdown menus),
`rounded-2xl` (16px, composer pill), `rounded-full` (circular). Three custom tokens fill the gaps:

| Class | Value | Use for |
|---|---|---|
| `rounded-toolbar` | 9px | Header toolbar buttons only (Share, Generate code) |
| `rounded-node` | 10px | Canvas block cards, composer add-button, zoom stepper |
| `rounded-floating-panel` | 14px | Undocked floating inspector panel only |

## Shadow

Tailwind's default `shadow-*` uses neutral black and doesn't match this design — use these instead.

| Class | Value | Use for |
|---|---|---|
| `shadow-float-sm` | `0 8px 24px rgba(26,26,24,.06), 0 1px 2px rgba(26,26,24,.04)` | Elevation 1 — floats directly on canvas (composer bar) |
| `shadow-float-md` | `0 12px 32px rgba(26,26,24,.10), 0 1px 3px rgba(26,26,24,.06)` | Elevation 2 — floats above other floating content (dropdown menus, floating inspector) |
