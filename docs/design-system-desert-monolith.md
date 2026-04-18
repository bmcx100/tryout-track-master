# Desert Monolith — Design System

## Role

You are a senior design engineer. Apply this design system to every screen, component, and layout in this project. This document defines the visual identity — palette, typography, spacing, borders, shadows, texture, and animation behavior. It is stack-agnostic. Follow it exactly regardless of what framework or tools are in use.

## Identity

A luxury desert retreat carved from sandstone and silence. Rammed earth walls, canyon shadows, golden hour stretching across raw plaster. Every surface feels sun-baked and deliberate — warm but restrained, rich but never ornate. Amangiri, not Adobe.

## Palette

| Token | Hex | Usage |
|-------|-----|-------|
| Gold | `#9E7B2F` | Primary — brand text, headings with emphasis, active states, data highlights, icons |
| Light Gold | `#C9A84C` | Secondary — gradients, decorative lines, hover states, subtle emphasis |
| Cinnabar | `#B83A2A` | Action — all CTAs, buttons, alerts, badges, destructive actions, links |
| Parchment | `#FBF6ED` | Background — base canvas, page background |
| Dune | `#F2E8D0` | Surface — card backgrounds, input fields, stat blocks, wells |
| Umber | `#2A2117` | Text — primary body text, headings |
| Dust | `#B8A06A` | Muted — labels, secondary text, placeholders, inactive states, timestamps |

### Color Rules
- Gold carries the identity. It appears on brand elements, key data, and anywhere the design needs to feel *expensive*.
- Cinnabar is reserved exclusively for things the user should tap or act on. If it's red, it's actionable. No decorative red.
- Backgrounds alternate between Parchment (open space) and Dune (contained elements). Never stack two Dune surfaces directly.
- Dark sections use Umber as background with Parchment text. The accent word in dark sections uses Cinnabar, not Gold.

## Typography

| Role | Font | Weight | Tracking | Usage |
|------|------|--------|----------|-------|
| Headings | Outfit | 600–700 | -0.01em | Section titles, card headings, navigation labels |
| Drama | Fraunces Italic | 400–700 | normal | Hero statements, pull quotes, philosophy text, large display numbers |
| Data | IBM Plex Mono | 400–500 | 0.02em | Stats, timestamps, badges, system labels, data values |
| Body | Outfit | 400–500 | normal | Paragraphs, descriptions, UI text |

### Type Scale

**Mobile (under 768px):**
- Hero drama text: 40–44px
- Hero heading: 26–28px
- Section headings: 20–22px
- Card headings: 15–16px
- Body: 14–15px
- Labels/badges: 9–10px, uppercase, letter-spaced 0.05–0.15em
- System labels: 10px, IBM Plex Mono, uppercase, letter-spaced 0.15em, Dust color

**Desktop (768px and above):**
- Hero drama text: 52–64px
- Hero heading: 32–38px
- Section headings: 24–28px
- All other sizes remain the same

### Type Rules
- Drama font is only used at large sizes (28px+). Never use Fraunces for body text or small labels.
- Monospace is for data and system elements only. Never use it for descriptions or marketing copy.
- Headings and body both use Outfit — differentiate with weight (700 vs 400), not font family.

## Responsive Layout

Mobile is the primary design target. This app should feel native on a phone — full-screen views, fixed bottom navigation, thumb-friendly targets. Desktop expands the layout with structure, not whitespace.

### Breakpoints
- **Mobile** (under 768px): Single column, bottom tab bar, full-width cards.
- **Desktop** (768px and above): Sidebar navigation replaces tab bar, multi-column content areas, wider cards with horizontal arrangements.

### Mobile Layout (under 768px)
- Content padding: 20px on each side.
- Sections are **full-screen views** — each fills the viewport height or close to it.
- Scrolling should feel like flipping through app screens, not scrolling a webpage.
- Bottom tab bar is fixed and always visible.
- All cards are full-width (minus page padding).
- Stat blocks scroll horizontally with snap behavior.
- CTAs are full-width.
- Touch targets: minimum 44px height on all interactive elements.

### Desktop Layout (768px and above)
- Max content width: 1200px, horizontally centered.
- **Left sidebar** (240px fixed width): replaces bottom tab bar. Brand name at top in Outfit 700, Gold color. Navigation items stacked vertically with icons and labels. Active item: Gold background at 10% opacity, Gold text, 3px left border in Gold. Inactive items: Dust color. Sidebar background: Dune with a 1px right border in `rgba(180, 144, 60, 0.12)`.
- **Main content area** fills remaining width to the right of the sidebar.
- Bottom tab bar is **hidden** on desktop.
- App header remains sticky but spans only the main content area, not the sidebar.
- Cards arrange in a **2- or 3-column grid** instead of stacking vertically. Use 16–24px gap.
- Stat blocks display in a single non-scrolling row, evenly spaced.
- CTAs are auto-width with generous horizontal padding, not full-width.
- Hero section uses extra width: headline can be larger, body and CTA sit beside a decorative image or element instead of stacking.
- Dark sections (philosophy, emphasis) span **full width edge-to-edge**, including behind the sidebar. Text centered, max-width 800px.
- Final CTA section centers in the main content area, max-width 600px.

## Spacing

| Token | Value | Usage |
|-------|-------|-------|
| page-padding | 20px | Content inset from screen edges (mobile). Desktop uses sidebar + centered max-width instead. |
| section-gap | 32–40px | Between major sections |
| card-gap | 12px (mobile) / 16–24px (desktop grid) | Between cards |
| card-padding | 20px | Internal card padding |
| stat-gap | 8px | Between stat blocks in a row |
| element-gap | 8px | Between related elements inside a card |
| tight-gap | 4px | Between a number and its label, icon and its text |

### Spacing Rules
- Generous vertical rhythm between sections. The design should breathe — desert, not city.
- Cards are compact internally (20px padding) but spaced apart. Information density inside, openness between.
- On mobile, no full-bleed content except dark philosophy/emphasis sections — everything else respects page padding.
- On desktop, the sidebar provides the left boundary. Content respects the main area, dark sections break out.

## Borders & Radius

| Element | Radius | Border |
|---------|--------|--------|
| Cards | 1.5rem (24px) | 1px solid `rgba(180, 144, 60, 0.12)` |
| Buttons (primary) | 2rem (32px) | none |
| Buttons (outline) | 1.5rem (24px) | 1.5px solid Cinnabar |
| Stat blocks | 1.5rem (24px) | 1px solid `rgba(180, 144, 60, 0.12)` |
| Input fields | 1rem (16px) | 1px solid `rgba(180, 144, 60, 0.15)` |
| Badges/chips | 1rem (16px) | none (filled background) |
| Tab bar icons | 0.5rem (8px) | none |
| Images/media | 1rem (16px) | none |
| Sidebar nav items | 1rem (16px) | none (active gets 3px left border in Gold) |

### Border Rules
- Borders are always gold-tinted, never gray. Use `rgba(180, 144, 60, opacity)` with opacity between 0.08 and 0.15.
- No sharp corners anywhere. Minimum radius is 0.5rem.
- Cards and containers use soft, barely-visible borders — structural, not decorative.
- Decorative accent lines are 32px wide, 3px tall, with a gold gradient (`#9E7B2F` → `#C9A84C`). Use sparingly — one per card maximum, positioned above the heading.

## Shadows

| Element | Shadow |
|---------|--------|
| Cards (resting) | `0 1px 3px rgba(42, 33, 23, 0.04)` |
| Cards (hover/pressed) | `0 4px 12px rgba(42, 33, 23, 0.08)` |
| Buttons (hover) | `0 2px 8px rgba(184, 58, 42, 0.15)` |
| Header/tab bar/sidebar | none — use backdrop blur + border instead |
| Modals/overlays | `0 8px 32px rgba(42, 33, 23, 0.12)` |

### Shadow Rules
- Shadows are warm-tinted (Umber-based rgba), never cool gray or pure black.
- Shadows are subtle. This is a desert, not a floating UI. Elements sit *on* surfaces, not above them.
- No shadow on resting buttons. Shadow only appears on hover/press as feedback.

## Texture & Surface

- Apply a global noise overlay at **0.03 opacity** — fine grain, like sun-bleached plaster. The surface should feel tactile, never flat digital.
- Parchment and Dune surfaces should feel like different weights of the same paper — warm, slightly textured, organic.
- No gradients on surfaces or backgrounds. Gradients are only used on decorative accent lines (gold) and never on cards or buttons.

## Buttons & Interactive Elements

### Primary Button (CTA)
- Background: Cinnabar `#B83A2A`
- Text: Parchment `#FBF6ED`, Outfit 600, 14–15px
- Radius: 2rem
- Padding: 16px vertical
- **Mobile:** full-width
- **Desktop:** auto-width with 32–40px horizontal padding
- Hover: darken background 8%, add warm shadow
- Press: scale 0.97, shadow removed — press *into* the surface

### Outline Button (Secondary)
- Background: transparent
- Border: 1.5px solid Cinnabar
- Text: Cinnabar, Outfit 600, 12–13px
- Radius: 1.5rem
- Padding: 8px vertical, 20px horizontal
- Hover: Cinnabar background at 5% opacity fills in

### Small Button (Card-level CTA)
- Same as primary but smaller: 12px text, 8px vertical / 20px horizontal padding, 1.5rem radius
- Always auto-width, never full-width — even on mobile

### Badge / Chip
- Background: `rgba(184, 58, 42, 0.10)` (red-tinted) or `rgba(158, 123, 47, 0.12)` (gold-tinted)
- Text: Cinnabar or Gold, IBM Plex Mono, 9px, uppercase, letter-spaced
- Padding: 3px vertical, 8px horizontal
- Radius: 1rem
- No border

### Interactive Rules
- All interactive elements feel **weighted and deliberate** — like pressing a warm stone, not clicking a digital button.
- Hover lifts 1px (`translateY(-1px)`). Press pushes down (`scale(0.97)`).
- Transitions: 200ms ease-out. No bounce, no spring, no overshoot.
- Active/selected states use Gold, never Cinnabar. Red is for action, gold is for state.

## Header & Navigation

### App Header
- Height: 56px. Compact.
- Background: Parchment at 85% opacity with backdrop blur (20px).
- Bottom border: 1px solid `rgba(180, 144, 60, 0.12)`.
- **Left:** Brand name — Outfit 700, 16px, Gold.
- **Right:** Single icon button (menu or avatar), Gold.
- Sticky on both mobile and desktop.
- **Desktop:** spans main content area only, not the sidebar.
- No navigation links in the header. Navigation lives in the tab bar (mobile) or sidebar (desktop).

### Mobile — Bottom Tab Bar
- Fixed to bottom of viewport.
- Height: 70px plus safe-area padding for notched devices.
- Background: Parchment at 92% opacity with backdrop blur (20px).
- Top border: 1px solid `rgba(180, 144, 60, 0.12)`.
- Four tabs: icon above label.
- Active tab: Gold icon + Gold label.
- Inactive tabs: Dust at 40% opacity.
- Labels: Outfit, 9px.
- **Hidden on desktop.**

### Desktop — Sidebar
- Fixed to left edge, full viewport height.
- Width: 240px.
- Background: Dune `#F2E8D0`.
- Right border: 1px solid `rgba(180, 144, 60, 0.12)`.
- Brand name at top: Outfit 700, Gold, with generous top padding.
- Nav items stacked vertically, 8px gap. Each item: icon + label in a row, 12px vertical padding, 20px horizontal padding, 1rem radius.
- Active item: Gold background at 10% opacity, Gold text, 3px left border in Gold.
- Inactive items: Dust color. Hover: Umber text, Dune background darkens slightly.
- Bottom of sidebar: small muted text (version, status) pinned to bottom.
- **Hidden on mobile.**

## Dark Sections

When a section inverts to dark (philosophy, emphasis, footer):
- Background: Umber `#2A2117`
- Primary text: Parchment `#FBF6ED`
- Muted text: Parchment at 45% opacity
- Accent/emphasis word: Cinnabar `#B83A2A` (not Gold — red pops harder on dark)
- Drama font for the large statement, Outfit for the smaller line
- **Desktop:** breaks out full-width edge-to-edge, including behind the sidebar. Text content centered, max-width 800px.

## Animation Behavior

- Entrance animations: fade in + shift up 16px, 300ms, ease-out. Nothing dramatic.
- Stagger timing: 0.08s between elements. Measured, not rapid-fire.
- All motion should feel **unhurried and grounded** — like heat rising from sand. No snap, no bounce, no mechanical precision.
- Scroll-triggered reveals fire when 25% of the element is visible. Content arrives calmly, not urgently.
- Decorative accent lines can animate width from 0 to full on scroll entry (300ms, ease-out).

## Image & Media Mood

When selecting or generating imagery: golden hour desert landscapes, rammed earth architecture, canyon walls, raw plaster, sandstone texture, warm shadow play, dried grasses, copper and brass objects, handmade ceramics, linen cloth. Always warm light. Never blue-toned, never overcast.
