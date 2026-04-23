# Spec 021: Light Mode (Gold Scale Theme)

**PRD Reference:** NFR (UI/UX enhancement)
**Priority:** Should Have
**Depends on:** None

## What This Feature Does

Adds a light mode theme to Track Master, built on the gold OKLCH color scale derived from the existing brand color `--dm-gold: oklch(0.76 0.14 85)`. Users toggle between dark and light mode via a switch on the Settings page. The preference is stored in localStorage and defaults to dark mode for new users. All pages (app, admin, and public) respect the chosen theme.

## Design Reference

A browser mockup of the light theme exists at `docs/mockups/light-mode.html`. Open in a browser and click the **"New (Gold Scale)"** tab to see the approved design. The gold shade swatch panel on the right side shows the full scale from gold-50 to gold-950.

## Gold Scale Definition

All light mode colors are derived from the brand gold hue (OKLCH hue angle 85) with varying lightness and chroma:

| Token | OKLCH | Role in Light Mode |
|-------|-------|--------------------|
| `--gold-50` | `oklch(0.98 0.02 85)` | Page background |
| `--gold-100` | `oklch(0.94 0.04 85)` | Cards, header, nav surfaces |
| `--gold-200` | `oklch(0.89 0.07 85)` | Stat pills, surface-alt, toggle track |
| `--gold-300` | `oklch(0.84 0.11 85)` | Decorative, lighter accents |
| `--gold-400` | `oklch(0.80 0.13 85)` | Icons, secondary accents |
| `--gold-500` | `oklch(0.76 0.14 85)` | CTAs, active toggle bg, active filter chips (= existing `--dm-gold`) |
| `--gold-600` | `oklch(0.68 0.13 85)` | Text on light backgrounds |
| `--gold-700` | `oklch(0.56 0.11 85)` | Dark text, headings |
| `--gold-800` | `oklch(0.45 0.09 85)` | Muted text, labels |
| `--gold-900` | `oklch(0.35 0.07 85)` | Borders (at alpha), high-contrast text |
| `--gold-950` | `oklch(0.25 0.05 85)` | Primary text, jersey numbers, bottom nav bg |

## Current State

### Theme system
- All colors defined as CSS custom properties in `frontend/app/globals.css` lines 65-158
- `:root` block defines the dark palette (`--dm-*` tokens) and shadcn semantic tokens
- `.dark` block exists (line 126) but is **never applied** — it's a placeholder with minor variations
- `@custom-variant dark (&:is(.dark *))` defined at line 5 for Tailwind `dark:` classes
- Body gets `bg-background text-foreground` via `@layer base` at line 164

### Root layout
- `frontend/app/layout.tsx` — renders `<html>` and `<body>` with font classes, no theme class logic

### Settings page
- `frontend/components/settings/settings-page-client.tsx` — client component with existing localStorage preference pattern (`useSyncExternalStore` for onboarding toggle)
- `frontend/app/(app)/settings/page.tsx` — server component that fetches user data and passes to client
- Toggle UI already exists (`.settings-toggle` / `.settings-toggle-on` CSS classes at globals.css line 3681)

### localStorage pattern
- `frontend/components/shared/onboarding-manager.tsx` — established pattern: localStorage key + custom event + `useSyncExternalStore` for SSR-safe reactivity

### Desktop phone-frame
- Body background is `oklch(0.06 0 0)` (near-black) on desktop to frame the 393px phone shell (globals.css line 794)
- `body:has(.admin-shell)` overrides to `var(--dm-parchment)` (line 1206)

### Hard-coded colors
- Many component classes in globals.css use hard-coded `oklch(...)` values directly (e.g., `background: oklch(0.08 0 0)` for bottom nav, `color: oklch(0.15 0 0)` for button text) rather than referencing `--dm-*` variables. These will need light-mode overrides.

## Changes Required

### Database

No database changes needed. Theme preference is stored in localStorage (consistent with existing onboarding preference pattern).

### Server Actions / API Routes

No server actions needed.

### Pages

No new pages. Modifications to:

- `frontend/app/layout.tsx` — Add a `<ThemeProvider>` wrapper (client component) that reads localStorage on mount, applies `data-theme="light"` attribute to `<html>`, and handles flash prevention via an inline script.

### Components

#### New: `frontend/components/shared/theme-provider.tsx`

Client component that:
1. Reads `theme-preference` from localStorage on mount
2. Applies `data-theme="light"` attribute to the `<html>` element when light mode is selected (no attribute = dark, the default)
3. Exports `setThemePreference(mode: "dark" | "light")` function for the settings toggle
4. Exports `useThemePreference()` hook using `useSyncExternalStore` (same pattern as onboarding manager)
5. Dispatches a custom `"theme-change"` event when preference changes

#### New: Inline script in `frontend/app/layout.tsx`

A `<script>` tag inside `<head>` (before body renders) that reads localStorage and sets `data-theme` on `<html>` **before first paint** to prevent flash of wrong theme. This must be a raw inline script, not a React component.

```
// Pseudocode — the implementing agent writes the actual code
try {
  if (localStorage.getItem('theme-preference') === 'light') {
    document.documentElement.setAttribute('data-theme', 'light')
  }
} catch {}
```

#### Modified: `frontend/components/settings/settings-page-client.tsx`

Add a "Dark Mode" toggle row in the Preferences section (below the existing "Show Onboarding Tips" toggle). Uses the same `.settings-toggle` / `.settings-toggle-on` CSS pattern. Calls `setThemePreference()` on toggle. Add `Moon` icon import from lucide-react.

### Styles

All style changes happen in `frontend/app/globals.css`. The approach uses `[data-theme="light"]` as the selector (NOT the `.dark` class — that stays for shadcn compatibility).

#### 1. Define gold scale tokens in `:root`

Add the gold scale variables to the existing `:root` block so they're available in both themes:

```
--gold-50 through --gold-950 (11 tokens from the table above)
```

#### 2. Add `[data-theme="light"]` block

A new CSS block that overrides the `--dm-*` variables for light mode. This is the core mapping:

| Dark token | Light mode value | Source |
|-----------|-----------------|--------|
| `--dm-parchment` | `var(--gold-50)` | Page background |
| `--dm-dune` | `var(--gold-100)` | Card surfaces |
| `--dm-dune-alt` | `var(--gold-200)` | Deeper surfaces |
| `--dm-umber` | `var(--gold-950)` | Primary text |
| `--dm-dust` | `var(--gold-800)` | Muted text |
| `--dm-gold` | `var(--gold-500)` | Brand accent (unchanged) |
| `--dm-light-gold` | `var(--gold-400)` | Lighter accent |
| `--dm-cinnabar` | `var(--gold-500)` | CTAs |
| `--dm-border` | `oklch(0 0 0 / 8%)` | Borders (dark on light, inverted) |
| `--dm-border-subtle` | `oklch(0 0 0 / 5%)` | Subtle borders |
| `--dm-shadow-sm` | `0 1px 3px oklch(0 0 0 / 6%)` | Softer shadows |
| `--dm-shadow-md` | `0 4px 12px oklch(0 0 0 / 8%)` | Medium shadows |
| `--dm-shadow-lg` | `0 8px 32px oklch(0 0 0 / 10%)` | Large shadows |

Also override the shadcn semantic tokens:

| Token | Light mode value |
|-------|-----------------|
| `--background` | `var(--gold-50)` |
| `--foreground` | `var(--gold-950)` |
| `--card` | `var(--gold-100)` |
| `--card-foreground` | `var(--gold-950)` |
| `--popover` | `var(--gold-100)` |
| `--popover-foreground` | `var(--gold-950)` |
| `--primary` | `var(--gold-500)` |
| `--primary-foreground` | `var(--gold-100)` |
| `--secondary` | `var(--gold-200)` |
| `--secondary-foreground` | `var(--gold-950)` |
| `--muted` | `var(--gold-200)` |
| `--muted-foreground` | `var(--gold-800)` |
| `--accent` | `var(--gold-500)` |
| `--accent-foreground` | `var(--gold-100)` |
| `--border` | `oklch(0 0 0 / 8%)` |
| `--input` | `oklch(0 0 0 / 10%)` |

#### 3. Override hard-coded oklch values

Many component classes use raw oklch values instead of variables. These need `[data-theme="light"]` overrides. The implementing agent must search globals.css for every hard-coded `oklch(0.0x` through `oklch(0.3x` value (dark backgrounds/surfaces) and every `oklch(0.8x` through `oklch(0.9x` (light text on dark) and add light-mode equivalents.

Key areas with hard-coded colors that need overrides:

- **Bottom nav** (line ~575): `background: oklch(0.08 0 0)` — change to `var(--gold-950)` in light mode. Keep inactive icon color `oklch(1 0 0 / 30%)` and active color `var(--dm-cinnabar)` the same (light icons on dark nav).
- **App header** (line ~170): `background: oklch(0.12 0 0 / 85%)` — change to gold-100 at 95% alpha
- **Button text** (line ~226): `color: oklch(0.12 0 0)` — ensure readable on gold-500 bg
- **View toggle** (line ~309): `background: oklch(0.22/0.25/0.28 0 0)` — change to gold-200
- **Active toggle button**: In light mode, active state should be gold-500 background with gold-100 text
- **Active filter chip**: In light mode, gold-500 background with gold-50 text
- **Status colors** (`--dm-official-green`, `--dm-red`, `--dm-orange`): Keep the same values in both themes — they already have sufficient contrast on both dark and light surfaces
- **Desktop body background** (line ~794): `background: oklch(0.06 0 0)` — change to a warm neutral for the phone frame surround (e.g., `oklch(0.88 0.02 85)`)
- **`body:has(.admin-shell)`** (line ~1206): Override to `var(--gold-50)` in light mode
- **Player row hover/active states**: Search for `oklch(0.15` through `oklch(0.25` backgrounds
- **Hero card stats, badges**: Hard-coded `oklch(0.76 0.14 85 / 15%)` backgrounds — may need to increase to `/ 20%` for visibility on gold-50 bg

#### 4. Jersey numbers in light mode

Jersey numbers use `color: var(--dm-gold)` currently. In light mode, override to `var(--gold-950)` for readability against gold-100 card backgrounds.

#### 5. Settings toggle for theme row

Reuse existing `.settings-toggle` / `.settings-toggle-on` pattern. The toggle represents "Dark Mode" — ON = dark (default), OFF = light.

## Key Implementation Details

### Flash prevention

The inline `<script>` in `<head>` is critical. Without it, users in light mode will see a flash of dark theme on every page load because React hydration happens after first paint. The script must run synchronously before the browser paints.

### Why `data-theme` instead of `.dark` class

The existing `.dark` class (line 126) and `@custom-variant dark` (line 5) are set up for shadcn's dark mode convention. Since our app is dark-by-default and light is the alternate mode, we use `data-theme="light"` to avoid conflicts. The `:root` block remains the dark theme. The `[data-theme="light"]` selector overrides variables when light mode is active.

### localStorage key

Use `"theme-preference"` as the localStorage key. Values: `"light"` or absent/`"dark"`. Follows the same pattern as `"onboarding-disabled"`.

### Custom event

Dispatch `"theme-change"` event on `window` when preference changes (same pattern as `"onboarding-change"`). This lets `useSyncExternalStore` subscribers re-render.

### Hard-coded color audit

The implementing agent must do a thorough audit of globals.css for hard-coded oklch values that assume a dark background. The safest approach:

1. Search for all `background: oklch(0.0` through `background: oklch(0.3` — these are dark surfaces that need light alternatives
2. Search for all `color: oklch(0.7` through `color: oklch(0.95` — these are light text that needs dark alternatives
3. Search for all `oklch(1 0 0 /` — these are white-at-alpha borders/overlays that need black-at-alpha alternatives
4. Group related overrides by component section (follow the existing `/* ===== Section ===== */` comments in globals.css)

Not every hard-coded value needs changing — colors used for status indicators (green, red, orange) and the gold accent itself should stay the same in both themes.

### Admin pages

Admin pages use `.admin-shell` with `var(--dm-parchment)` background. Since we're overriding `--dm-parchment` to gold-50 in light mode, admin pages will automatically get the light background. The `body:has(.admin-shell)` rule also needs a light-mode override.

### Public pages (login, signup, landing)

Public pages use `.public-layout`. These should also respect the theme. Since unauthenticated users haven't set a preference yet, they'll get the default (dark). The inline script handles this correctly — no localStorage key means no `data-theme` attribute means dark.

## Acceptance Criteria

- [ ] Settings page has a "Dark Mode" toggle in the Preferences section
- [ ] Toggle defaults to ON (dark mode) for new users / cleared localStorage
- [ ] Toggling to OFF applies light theme immediately without page reload
- [ ] Toggling back to ON restores dark theme immediately
- [ ] Preference persists across page reloads (localStorage)
- [ ] No flash of wrong theme on page load (inline script works)
- [ ] All (app) pages render correctly in light mode: dashboard, teams, sessions, my-favourites, settings, help
- [ ] All (admin) pages render correctly in light mode: corrections, add-player, scraper, import
- [ ] Public pages (login, signup, landing) render correctly in light mode
- [ ] Bottom nav has gold-950 background in light mode with existing dark icon styling
- [ ] Active toggle buttons use gold-500 bg with gold-100 text
- [ ] Active filter chips use gold-500 bg with gold-50 text
- [ ] Jersey numbers are gold-950 in light mode
- [ ] Header has gold-100 background in light mode
- [ ] Cards have gold-100 background in light mode
- [ ] Status colors (green/red/orange) remain legible in both themes
- [ ] Desktop phone-frame surround changes to a warm neutral in light mode
- [ ] No hard-coded dark backgrounds visible in light mode (thorough audit)
- [ ] Build passes (`npm run build`)
- [ ] No lint errors (`npm run lint`)

## Playwright Test Plan

**CRITICAL — Live Data Safety:**
All tests below are read-only. No player data, annotations, or corrections are modified. The only mutation is the localStorage `theme-preference` key, which is cleaned up at the end.

**Setup:** Log in as `testparent@test.com` / `testpass123`. Navigate to `/dashboard`. Ensure localStorage has no `theme-preference` key (clear it if present).

### Test 1: Default is dark mode
1. Navigate to `/dashboard`
2. Take a snapshot
3. **Verify:** Page background is dark (near-black). Bottom nav is dark. This is the default experience.

### Test 2: Settings toggle exists and defaults to ON
1. Navigate to `/settings`
2. Take a snapshot
3. **Verify:** A "Dark Mode" toggle row exists in the Preferences section, below "Show Onboarding Tips". The toggle is in the ON position (`.settings-toggle-on`).

### Test 3: Toggling to light mode
1. On `/settings`, click the "Dark Mode" toggle
2. Take a snapshot
3. **Verify:** Theme changes immediately — page background becomes warm cream (gold-50), cards become gold-100, text becomes dark (gold-950). Toggle is now in OFF position. The `<html>` element has `data-theme="light"`.

### Test 4: Light mode persists on navigation
1. While in light mode, navigate to `/dashboard`
2. Take a snapshot
3. **Verify:** Dashboard renders in light mode — hero cards on gold-100 surface, gold-950 jersey numbers, gold-500 active filter chip.

### Test 5: Light mode persists on reload
1. While in light mode, reload the page
2. Take a snapshot
3. **Verify:** Page loads directly in light mode with no flash of dark theme.

### Test 6: Teams page in light mode
1. Navigate to `/teams`
2. Take a snapshot
3. **Verify:** View toggle has gold-500 active background with gold-100 text. Position filter chips are gold-500 active with gold-50 text. Team cards have gold-100 background. Player names are gold-950.

### Test 7: Sessions page in light mode
1. Navigate to `/continuations`
2. Take a snapshot
3. **Verify:** Session cards render on gold-100 background. Status colors (green/red/orange left borders) are visible and legible. Text is dark.

### Test 8: My Favourites page in light mode
1. Navigate to `/my-favourites`
2. Take a snapshot
3. **Verify:** Player rows render with gold-950 text on gold-100 cards. Status text colors (green, red, orange, gold) are legible. Hearts are visible.

### Test 9: Bottom nav styling in light mode
1. On any page in light mode, inspect the bottom nav
2. Take a snapshot
3. **Verify:** Bottom nav has a dark background (gold-950). Inactive icons are white at 30% opacity. Active icon is cinnabar yellow. This matches the current dark nav styling on a warm-dark background.

### Test 10: Header styling in light mode
1. Take a snapshot of the app header
2. **Verify:** Header has gold-100 background (slightly warmer than page). Division text and avatar are legible.

### Test 11: Admin pages in light mode (admin user)
1. Log out and log in as `testadmin@test.com` / `TestAdmin1234`
2. Set localStorage `theme-preference` to `"light"`
3. Navigate to `/settings/corrections`
4. Take a snapshot
5. **Verify:** Admin corrections page renders in light mode — readable text, proper card backgrounds.

### Test 12: Toggle back to dark mode
1. Navigate to `/settings`
2. Click the "Dark Mode" toggle (turning it ON)
3. Take a snapshot
4. **Verify:** Theme reverts to dark immediately. All colors match the original dark theme.

### Test 13: Desktop phone-frame surround
1. Resize browser to desktop width (>640px)
2. While in light mode, take a snapshot
3. **Verify:** The body background around the phone frame is a warm neutral (not black, not white), creating a pleasant frame effect.

### Test 14: Public pages respect theme
1. Navigate to `/login` (or log out first)
2. Set localStorage `theme-preference` to `"light"`
3. Reload
4. Take a snapshot
5. **Verify:** Login page renders in light mode.

### Test Mutations Log

| Test | What Changed | How to Revert |
|------|-------------|---------------|
| Tests 3-14 | `localStorage.theme-preference` set to `"light"` | `localStorage.removeItem("theme-preference")` |

**After all tests pass, run `localStorage.removeItem("theme-preference")` in the browser console to clean up.**

## Files to Touch

1. `frontend/app/globals.css` — Add gold scale tokens to `:root`, add `[data-theme="light"]` block with all variable overrides, add light-mode overrides for hard-coded oklch values throughout the file
2. `frontend/components/shared/theme-provider.tsx` — **CREATE** — theme preference localStorage management, `useThemePreference()` hook, `setThemePreference()` export
3. `frontend/app/layout.tsx` — Add inline `<script>` for flash prevention, wrap children in `<ThemeProvider>`
4. `frontend/components/settings/settings-page-client.tsx` — Add "Dark Mode" toggle row in Preferences section

## Implementation Checklist

After implementing the changes above, you MUST complete these steps
in order before claiming the work is done:

1. **Build:** Run `cd frontend && npm run build` — fix any errors.
2. **Lint:** Run `cd frontend && npm run lint` — fix any errors.
3. **Start dev server:** Run `cd frontend && npm run dev` to start the local dev server on port 3000.
4. **Run every Playwright test above.** Open the browser, follow each test's steps exactly, and verify each expected result using browser snapshots. If a test fails, fix the code and re-run it.
5. **Do not skip any test.** Every test in the Playwright Test Plan must pass before this spec is considered complete.
6. **Revert all test mutations.** Check the Test Mutations Log and undo every data change made during testing. Confirm with the user that all test data has been cleaned up.
