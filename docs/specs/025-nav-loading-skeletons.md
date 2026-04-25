# Spec 025: Navigation Loading Skeletons

**PRD Reference:** NFR-024 (perceived performance)
**Priority:** Should Have
**Depends on:** None

## What This Feature Does

When a user taps a bottom nav tab (Home, Help, Teams, Sessions), the content area immediately shows a skeleton loading screen that matches the target page's layout. This eliminates the current dead-air gap where the old page sits unchanged until the new page renders, making the app feel faster and more responsive.

The skeletons only appear on bottom nav transitions — not on internal links, back buttons, or settings navigation.

## Current State

### Navigation tracking already exists
`frontend/components/layout/bottom-nav.tsx` already tracks `pendingHref` state during navigation. It sets this when a tab is tapped and clears it when `pathname` catches up. The active tab highlight updates immediately (optimistic UI), but no loading indicator is shown in the content area.

### No loading infrastructure exists
- Zero `loading.tsx` files in the app
- No skeleton components in `components/ui/` or `components/shared/`
- No shimmer/pulse animation classes in `globals.css`

### Page layouts (what each skeleton must approximate)

**Dashboard (Home):**
- 3-5 hero cards (~110px tall each, 16px rounded, stacked vertically with 12px gap)
- Favourites section header line
- 3-4 favourite cards (~54px tall, 14px rounded, with left colour border)

**Help:**
- Section header with icon + title
- 3 cards (~72px tall, 12px rounded, icon square on left + text lines on right)
- Second section header
- 3 more cards (same structure)

**Teams:**
- View toggle bar (two pills, ~40px tall, rounded-2xl)
- Position filter chips row (4 chips + reset button)
- 3 team headers (~32px tall, full-width bars)
- 5-7 player rows per team (~44px tall, with drag handle + jersey + name placeholders)

**Sessions (Continuations):**
- Round selector dropdown bar (~36px)
- Continuing/Cuts toggle (two pills, ~40px tall)
- Position filter chips row
- 2 session subheaders (~28px)
- 6-8 player rows per session (~44px, same structure as Teams)

## Changes Required

### Database
No database changes needed.

### Server Actions / API Routes
No server-side changes needed.

### Pages
No page files need modification. The skeletons are rendered by the layout/nav layer, not by individual pages.

### Components

#### 1. New: `frontend/components/shared/nav-loading-provider.tsx`
Client component that provides navigation loading state to the content area.

**Approach — `useTransition` wrapper in bottom nav:**
- BottomNav wraps `router.push()` in a React `useTransition`
- Passes `isPending` + `pendingHref` up to a context provider
- The app layout content area reads the context and conditionally renders the appropriate skeleton

**Context shape:**
```
NavLoadingContext {
  isPending: boolean
  targetHref: string | null
}
```

The provider wraps `{children}` in the `(app)` layout. When `isPending` is true, it renders the skeleton matching `targetHref` instead of `{children}`.

#### 2. New: `frontend/components/shared/skeleton-dashboard.tsx`
Renders the Dashboard skeleton:
- Shimmer header placeholder (small text line + large text line)
- 3 hero card placeholders (rounded rectangles with inner shimmer lines for stats)
- Section divider
- 3 favourite card placeholders (thin rectangles with left colour accent)

#### 3. New: `frontend/components/shared/skeleton-help.tsx`
Renders the Help skeleton:
- Section header placeholder (icon circle + text line)
- 3 card placeholders (icon square on left + 2 text lines on right)
- Second section header placeholder
- 3 more card placeholders

#### 4. New: `frontend/components/shared/skeleton-teams.tsx`
Renders the Teams skeleton:
- Toggle bar placeholder (two pill shapes)
- Filter chips row placeholder (4 small rounded rectangles + circle)
- 3 repeating groups of: team header bar + 5 player row placeholders
- Each player row: small grip dots + number box + small badge + long text line + short text line

#### 5. New: `frontend/components/shared/skeleton-sessions.tsx`
Renders the Sessions skeleton:
- Round selector bar placeholder
- Toggle bar placeholder (two pill shapes)
- Filter chips row placeholder
- 2 repeating groups of: session subheader + 6 player row placeholders
- Player rows same structure as Teams skeleton

#### 6. Modified: `frontend/components/layout/bottom-nav.tsx`
- Import and use `useTransition` from React
- Wrap `router.push()` in `startTransition`
- Provide `isPending` and `pendingHref` to the NavLoading context

#### 7. Modified: `frontend/app/(app)/layout.tsx`
- Wrap the content area with `<NavLoadingProvider>`
- The provider handles swapping between skeleton and real content

### Styles

Add to `frontend/app/globals.css`:

**Shimmer animation:**
- `.skeleton-shimmer` — pulse/shimmer animation using a moving gradient (dark → slightly lighter → dark). Uses OKLCH colours matching the dark mode palette.
- Animation: `@keyframes shimmer` — horizontal gradient sweep, 1.5s duration, infinite loop, ease-in-out

**Skeleton element base classes:**
- `.skeleton-block` — rounded rectangle placeholder, uses `oklch(0.18 0 0)` base with shimmer overlay
- `.skeleton-line` — text line placeholder, 12px tall by default, same shimmer
- `.skeleton-line-short` — shorter text line (60% width)
- `.skeleton-circle` — circular placeholder (for icons/avatars)
- `.skeleton-card` — card-shaped placeholder matching `.dm-dune` background with border
- `.skeleton-row` — 44px tall row matching player row height
- `.skeleton-toggle` — pill toggle placeholder matching view toggle dimensions
- `.skeleton-chip` — small rounded rectangle for filter chips

**Page-specific skeleton layout classes:**
- `.skeleton-dashboard`, `.skeleton-help`, `.skeleton-teams`, `.skeleton-sessions` — page containers with correct padding and gaps
- `.skeleton-hero-card` — 110px tall, 16px rounded, matching dashboard hero proportions
- `.skeleton-fav-card` — 54px tall, 14px rounded, with 4px left border accent
- `.skeleton-team-header` — 32px tall full-width bar
- `.skeleton-session-subheader` — 28px tall full-width bar

## Key Implementation Details

1. **React `useTransition` is the key mechanism.** When `startTransition` wraps `router.push()`, React keeps the old UI mounted while the new page's server component renders. During this pending phase, we show the skeleton instead. This is a built-in React 19 / Next.js pattern — no extra libraries needed.

2. **Skeleton selection by href.** Map `pendingHref` to the correct skeleton component:
   - `/dashboard` → `SkeletonDashboard`
   - `/help` → `SkeletonHelp`
   - `/teams` → `SkeletonTeams`
   - `/continuations` → `SkeletonSessions`

3. **Colour palette for skeletons.** Use the existing dark mode palette:
   - Base: `oklch(0.15 0 0)` (matches `.dm-night` background)
   - Shimmer highlight: `oklch(0.22 0 0)` (subtle lift, not too bright)
   - Accent hints: `oklch(0.76 0.14 85 / 8%)` for gold-tinted placeholders (hero cards, toggles)

4. **Keep the header visible during transitions.** The `DivisionSwitcher` header should NOT be replaced by the skeleton — it stays stable. Only the content below the header transitions. This means the skeleton renders inside the `{children}` slot, not over the entire layout.

5. **Minimum display time.** If the page loads very fast (< 150ms), the skeleton flash can feel janky. Add a minimum 150ms display time before showing real content. Use a `setTimeout` + state flag to enforce this.

6. **Follow the `@apply` convention.** All skeleton styles go in `globals.css` using `@apply` — no inline Tailwind in the skeleton components beyond single utility classes.

7. **Existing `pendingHref` logic in BottomNav.** The component already sets `pendingHref` on tap and clears it when pathname catches up. Refactor this to use the shared context instead of local state, so both BottomNav (for tab highlighting) and NavLoadingProvider (for skeleton display) react to the same state.

## Acceptance Criteria

- [ ] Tapping any bottom nav tab immediately shows a skeleton that approximates the target page layout
- [ ] Skeleton uses a shimmer/pulse animation (not static grey blocks)
- [ ] Dashboard skeleton shows hero card placeholders + favourite card placeholders
- [ ] Help skeleton shows section headers + card placeholders with icon squares
- [ ] Teams skeleton shows toggle + filter chips + team headers + player rows
- [ ] Sessions skeleton shows round selector + toggle + filter chips + session groups + player rows
- [ ] Header (DivisionSwitcher) stays visible during transition — skeleton only replaces the content area
- [ ] Skeleton disappears and real content appears once the page finishes rendering
- [ ] No skeleton flash on very fast transitions (minimum display time ~150ms)
- [ ] Tapping the already-active tab does nothing (no skeleton shown)
- [ ] Non-nav navigation (settings link, internal links, back button) does NOT trigger skeletons
- [ ] Skeleton colours match the dark mode palette (no jarring brightness changes)
- [ ] Build passes (`npm run build`)
- [ ] No lint errors (`npm run lint`)

## Playwright Test Plan

**Setup:** Log in as `testparent@test.com` / `testpass123`. Navigate to `/dashboard`. Ensure the dev server is running on port 3000.

### Test 1: Dashboard → Teams shows Teams skeleton
1. Navigate to `http://localhost:3000/dashboard`
2. Take a snapshot to confirm Dashboard is loaded
3. Click the "Teams" tab in the bottom nav
4. **Immediately** take a snapshot (within ~100ms)
5. **Verify:** Content area shows skeleton placeholders — toggle bar shape, filter chips, team header bars, and player row placeholders with shimmer animation. The DivisionSwitcher header remains visible above.

### Test 2: Teams → Sessions shows Sessions skeleton
1. From Teams page (wait for full load)
2. Click the "Sessions" tab in the bottom nav
3. Immediately take a snapshot
4. **Verify:** Content area shows Sessions skeleton — round selector bar, toggle, filter chips, session subheaders, and player row placeholders

### Test 3: Sessions → Home shows Dashboard skeleton
1. From Sessions page (wait for full load)
2. Click the "Home" tab in the bottom nav
3. Immediately take a snapshot
4. **Verify:** Content area shows Dashboard skeleton — hero card placeholders and favourite card placeholders

### Test 4: Home → Help shows Help skeleton
1. From Dashboard page (wait for full load)
2. Click the "Help" tab in the bottom nav
3. Immediately take a snapshot
4. **Verify:** Content area shows Help skeleton — section header + card placeholders with icon squares

### Test 5: Skeleton resolves to real content
1. From any page, click a different bottom nav tab
2. Wait for the page to fully load (wait for page-specific text to appear)
3. Take a snapshot
4. **Verify:** Skeleton is gone, real page content is displayed. No lingering skeleton elements visible.

### Test 6: Tapping active tab does NOT show skeleton
1. Navigate to `/dashboard`
2. Wait for full load
3. Click the "Home" tab (already active)
4. Take a snapshot
5. **Verify:** No skeleton appears, Dashboard content remains unchanged

### Test 7: Header stays visible during skeleton
1. Navigate to `/dashboard`
2. Note the header content (association badge, title, avatar)
3. Click the "Teams" tab
4. Immediately take a snapshot
5. **Verify:** DivisionSwitcher header is still fully visible and unchanged. Only the content below it shows the skeleton.

### Test 8: Settings link does NOT trigger skeleton
1. Navigate to `/dashboard`
2. Click the avatar/settings link in the header
3. **Verify:** No skeleton appears — the page transitions normally (old content → new content) without any skeleton overlay

### Test Mutations Log

| Test | What Changed | How to Revert |
|------|-------------|---------------|
| — | No mutations — all tests are read-only navigation | No revert needed |

## Files to Touch

1. `frontend/app/globals.css` — skeleton shimmer animation + all skeleton CSS classes
2. `frontend/components/shared/nav-loading-provider.tsx` — **CREATE** — context provider + skeleton switcher
3. `frontend/components/shared/skeleton-dashboard.tsx` — **CREATE** — Dashboard skeleton
4. `frontend/components/shared/skeleton-help.tsx` — **CREATE** — Help skeleton
5. `frontend/components/shared/skeleton-teams.tsx` — **CREATE** — Teams skeleton
6. `frontend/components/shared/skeleton-sessions.tsx` — **CREATE** — Sessions skeleton
7. `frontend/components/layout/bottom-nav.tsx` — **MODIFY** — add useTransition, provide context
8. `frontend/app/(app)/layout.tsx` — **MODIFY** — wrap content with NavLoadingProvider

## Implementation Checklist

After implementing the changes above, you MUST complete these steps in order before claiming the work is done:

1. **Build:** Run `cd frontend && npm run build` — fix any errors.
2. **Lint:** Run `cd frontend && npm run lint` — fix any errors.
3. **Start dev server:** Run `cd frontend && npm run dev` to start the local dev server on port 3000.
4. **Run every Playwright test above.** Open the browser, follow each test's steps exactly, and verify each expected result using browser snapshots. If a test fails, fix the code and re-run it.
5. **Do not skip any test.** Every test in the Playwright Test Plan must pass before this spec is considered complete.
6. **Revert all test mutations.** Check the Test Mutations Log and undo every data change made during testing (un-heart players, restore names, delete test records, etc.). Confirm with the user that all test data has been cleaned up.
