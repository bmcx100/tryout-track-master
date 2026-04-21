# Spec 013: Onboarding Tooltips & Help Page

**PRD Reference:** NFR-024, NFR-025
**Priority:** Should Have
**Depends on:** None

## What This Feature Does

New parents see two small, sequential tooltip messages on their first login
that point them to the division switcher and the Sessions tab. Once dismissed,
they never return. A permanent Help page (accessible from the bottom nav)
shows the old dashboard-style card layout describing every feature in the app.

## Current State

- **No onboarding exists.** New users land on the dashboard with no guidance.
- **No help content anywhere.** No tooltips, coach marks, help page, or FAQ.
- **Division switcher** is in the app header (`frontend/components/layout/division-switcher.tsx`).
  It renders a `<button className="division-badge">` at the top-left of the header.
- **Bottom nav** is in `frontend/components/layout/bottom-nav.tsx`. It has three tabs:
  Home (`/dashboard`), Teams (`/teams`), Sessions (`/continuations`).
- **Old dashboard** (pre-spec-009) used a card layout with icon + title + description
  linking to each page. The component and styles were removed in commit `5329622` but
  are recoverable from git history. The styles used classes like `dashboard-link-card`,
  `dashboard-link-card-icon`, `dashboard-link-card-title`, `dashboard-link-card-desc`.
- **App layout** is in `frontend/app/(app)/layout.tsx`. It renders `<DivisionSwitcher>`
  at the top and `<BottomNav />` at the bottom inside a `div.app-shell`.

## Changes Required

### Database

No database changes needed. Tooltip dismissed state is stored in `localStorage`.

### Server Actions / API Routes

No new server actions needed.

### Pages

**New: `/help` page**
- `frontend/app/(app)/help/page.tsx` — Server Component, renders `<HelpPageClient />`.
- This is a static page with no data fetching. Lives inside the `(app)` route group
  so it has the app shell (header + bottom nav).

### Components

**New: `frontend/components/shared/onboarding-tooltip.tsx`**

A small tooltip component that appears anchored to a target element.

Props:
- `targetSelector: string` — CSS selector for the element to point at (e.g., `".division-badge"`, `".bottom-nav-item:nth-child(3)"`)
- `message: string` — the tooltip text
- `position: "below" | "above"` — whether the tooltip appears below or above the target
- `onDismiss: () => void` — called when user taps "Got it" or X

Behavior:
- Renders a small card with the message text and a "Got it" button.
- An animated arrow (CSS triangle + pulse animation) points at the target element.
- Uses a semi-transparent backdrop overlay to draw attention. The target element
  is visually "punched out" of the overlay (higher z-index or clip-path) so it
  remains visible and tappable.
- The tooltip positions itself relative to the target element using
  `getBoundingClientRect()` on mount.
- Tapping "Got it" or the X calls `onDismiss`.

**New: `frontend/components/shared/onboarding-manager.tsx`**

Client component that orchestrates the two-tooltip sequence.

Behavior:
- On mount, reads `localStorage` key `"onboarding-dismissed"` (JSON object).
- If `"division-switcher"` is not dismissed, show tooltip 1 pointing at
  `.division-badge` with message: **"Tap here to switch between age groups"**,
  positioned below the header.
- When tooltip 1 is dismissed, write `{ "division-switcher": true }` to
  localStorage. Then show tooltip 2 pointing at the Sessions tab
  (`.bottom-nav a[href="/continuations"]`) with message:
  **"Tap here for the latest tryout results"**, positioned above the bottom nav.
- When tooltip 2 is dismissed, write `{ "division-switcher": true, "sessions-tab": true }`
  to localStorage. No more tooltips.
- If both are already dismissed on mount, render nothing.

**Modified: `frontend/app/(app)/layout.tsx`**

Add `<OnboardingManager />` inside the `app-shell` div, after `<BottomNav />`.

**New: `frontend/components/help/help-page-client.tsx`**

Client component that renders the help page. Uses the old dashboard card layout
pattern (icon + title + description) with updated content. Each card is a
visual description — not a navigation link (unlike the old dashboard where
cards were `<Link>` elements). Cards should still be tappable and navigate to
the relevant page so parents can jump straight to a feature after reading
about it.

Cards in order:

1. **Association & Division Picker** — Icon: the association abbreviation text
   (like the old dashboard). Title: "Association & Division". Description:
   "Tap the badge at the top-left to switch between associations
   and&nbsp;age&nbsp;groups."

2. **Sessions** — Icon: `ListChecks`. Title: "Tryout Sessions". Description:
   "See who's continuing and who's been cut after each tryout round.
   Check&nbsp;back&nbsp;regularly." Links to `/continuations`.

3. **Hearting Players** — Icon: `Heart`. Title: "Heart Players". Description:
   "Heart your child and other players on the Teams page to track their
   status on&nbsp;your&nbsp;dashboard." Links to `/teams`.

4. **Dashboard** — Icon: `Home`. Title: "Dashboard". Description:
   "Your hearted players' statuses appear here automatically. See who's
   continuing, cut, or&nbsp;made&nbsp;a&nbsp;team." Links to `/dashboard`.

5. **Teams & Previous Teams** — Icon: `Users`. Title: "Teams". Description:
   "View current rosters and where players were last year. Useful context
   for tracking and&nbsp;sorting." Links to `/teams`.

6. **Position Filter** — Icon: `Filter`. Title: "Position Filter".
   Description: "Filter by Forward, Defence, or Goalie on the
   Teams&nbsp;page." Links to `/teams`.

7. **Predictions** — Icon: `ArrowUpDown`. Title: "Predictions". Description:
   "Drag players between teams to predict where they'll land. Your
   predictions are private. Completed teams appear here
   as&nbsp;they're&nbsp;announced." Links to `/teams`.

8. **Player Details & Corrections** — Icon: `FileText`. Title: "Player
   Details". Description: "Long-press any player for details, private notes,
   and to suggest corrections if a name or jersey number
   is&nbsp;wrong." No specific link (feature is accessible everywhere).

**Modified: `frontend/components/layout/bottom-nav.tsx`**

Add a 4th tab: Help (`/help`) with the `HelpCircle` icon from Lucide.

### Styles

Add to `frontend/app/globals.css`:

**Onboarding tooltip styles:**
- `.onboarding-overlay` — fixed full-screen semi-transparent backdrop
  (`z-index: 9998`)
- `.onboarding-tooltip` — the tooltip card (rounded, background `var(--dm-dune)`,
  border, shadow, `z-index: 9999`)
- `.onboarding-tooltip-message` — text inside the tooltip
- `.onboarding-tooltip-dismiss` — "Got it" button, styled like a small pill
  button with `var(--dm-gold)` text
- `.onboarding-tooltip-arrow` — CSS triangle pointing at the target, with a
  subtle pulse animation
- `.onboarding-pulse` — keyframe animation for the arrow (gentle scale pulse)

**Help page styles:**
Restore the old `dashboard-link-card` family of styles from the pre-spec-009
codebase (commit `5329622~1`), renamed to `help-*` to avoid collision:
- `.help-page` — page container with padding, matching `dashboard-page`
- `.help-header` — section header style
- `.help-card` — the card (flex row, icon + text, rounded, `var(--dm-dune)` bg,
  border)
- `.help-card-icon` — 40x40 icon container with gold icon on amber background
- `.help-card-icon-text` — text variant for the association abbreviation icon
- `.help-card-title` — semibold 14px title
- `.help-card-desc` — 12px muted description text
- `.help-card + .help-card` — spacing between cards (margin-top)

## Key Implementation Details

**Tooltip positioning:** Use `getBoundingClientRect()` on the target element
to position the tooltip. The division badge is at the top-left of the header,
so tooltip 1 goes below it. The Sessions tab is in the bottom nav, so
tooltip 2 goes above it. Recalculate on window resize.

**Tooltip sequence is strict:** Tooltip 2 MUST NOT appear until tooltip 1
is dismissed. This ensures the parent acknowledges the division switcher
first, since picking the right division is a prerequisite for seeing relevant
data in Sessions.

**localStorage key structure:**
```
"onboarding-dismissed": { "division-switcher": true, "sessions-tab": true }
```

**Overlay punch-through:** The overlay should dim the screen but leave the
target element visually prominent. Simplest approach: use a fixed overlay
with `pointer-events: none` on the overlay itself, and ensure the target
element has a higher z-index. The tooltip and its dismiss button need
`pointer-events: auto`.

**Help page is inside `(app)` route group:** This means the parent must be
authenticated to see it. The help page gets the full app shell (header +
bottom nav) like every other app page.

**Bottom nav with 4 tabs:** The existing 3 tabs (Home, Teams, Sessions) are
evenly spaced. Adding Help as a 4th tab changes the layout to 4 even
columns. Use `HelpCircle` from Lucide for the icon. Keep the same active
state styling pattern.

**No-semicolons and @apply rules:** Follow the project's existing patterns.
No semicolons in TS/JS. Multi-class styles go in globals.css with `@apply`.

## Acceptance Criteria

- [ ] First-time user sees tooltip pointing at division badge on first app load
- [ ] Dismissing tooltip 1 immediately shows tooltip 2 pointing at Sessions tab
- [ ] Dismissing tooltip 2 ends the sequence — no more tooltips on future visits
- [ ] Tooltips do not reappear after being dismissed (localStorage persistence)
- [ ] Clearing localStorage resets the tooltips (for testing)
- [ ] Help page is accessible at `/help` and shows feature cards
- [ ] Help page cards match the agreed content and order (8 cards)
- [ ] Help page cards are tappable and navigate to the relevant page
- [ ] Bottom nav has 4 tabs: Home, Teams, Sessions, Help
- [ ] Help tab shows active state when on `/help`
- [ ] Tooltips have a semi-transparent overlay that highlights the target element
- [ ] Tooltip arrow has a subtle animation to draw attention
- [ ] Build passes (`npm run build`)
- [ ] No lint errors (`npm run lint`)

## Playwright Test Plan

**Setup:** Log in as `testparent@test.com` / `testpass123`. Before testing,
clear the `onboarding-dismissed` key from localStorage to reset tooltip state.

### Test 1: Tooltip 1 appears on first load
1. Clear localStorage key `onboarding-dismissed`
2. Navigate to `/dashboard`
3. **Verify:** A tooltip appears near the division badge with text containing
   "switch between age groups"
4. **Verify:** A semi-transparent overlay is visible behind the tooltip
5. **Verify:** A "Got it" button is visible on the tooltip

### Test 2: Tooltip 1 dismissal triggers tooltip 2
1. (Continue from Test 1)
2. Click "Got it" on tooltip 1
3. **Verify:** Tooltip 1 disappears
4. **Verify:** Tooltip 2 appears near the Sessions tab in the bottom nav
5. **Verify:** Text contains "latest tryout results"

### Test 3: Tooltip 2 dismissal ends the sequence
1. (Continue from Test 2)
2. Click "Got it" on tooltip 2
3. **Verify:** Tooltip 2 disappears
4. **Verify:** No tooltips are visible on the page

### Test 4: Tooltips do not reappear after dismissal
1. (Continue from Test 3 — both tooltips dismissed)
2. Navigate to `/teams` then back to `/dashboard`
3. **Verify:** No tooltips appear

### Test 5: Tooltips reset when localStorage is cleared
1. Clear localStorage key `onboarding-dismissed`
2. Reload the page
3. **Verify:** Tooltip 1 appears again

### Test 6: Help page renders with all cards
1. Navigate to `/help`
2. **Verify:** Page title or header indicates this is the Help page
3. **Verify:** 8 cards are visible in order: Association & Division,
   Tryout Sessions, Heart Players, Dashboard, Teams, Position Filter,
   Predictions, Player Details
4. **Verify:** Each card has an icon, title, and description

### Test 7: Help page cards navigate to correct pages
1. Navigate to `/help`
2. Click the "Tryout Sessions" card
3. **Verify:** Navigated to `/continuations`
4. Navigate back to `/help`
5. Click the "Teams" card
6. **Verify:** Navigated to `/teams`

### Test 8: Bottom nav shows Help tab
1. Navigate to `/dashboard`
2. **Verify:** Bottom nav has 4 tabs: Home, Teams, Sessions, Help
3. Click the Help tab
4. **Verify:** Navigated to `/help`
5. **Verify:** Help tab shows active state (highlighted)

### Test 9: Help page accessible from any app page
1. Navigate to `/teams`
2. Click Help in bottom nav
3. **Verify:** Navigated to `/help`
4. Navigate to `/continuations`
5. Click Help in bottom nav
6. **Verify:** Navigated to `/help`

### Test Mutations Log

| Test | What Changed | How to Revert |
|------|-------------|---------------|
| Tests 1-5 | localStorage `onboarding-dismissed` key modified | Clear via browser console: `localStorage.removeItem("onboarding-dismissed")` |

No database mutations. All test state is in localStorage.

## Files to Touch

1. **Create** `frontend/components/shared/onboarding-tooltip.tsx` — tooltip UI component
2. **Create** `frontend/components/shared/onboarding-manager.tsx` — tooltip sequence orchestrator
3. **Create** `frontend/app/(app)/help/page.tsx` — help page server component
4. **Create** `frontend/components/help/help-page-client.tsx` — help page card layout
5. **Modify** `frontend/app/(app)/layout.tsx` — add `<OnboardingManager />`
6. **Modify** `frontend/components/layout/bottom-nav.tsx` — add Help tab
7. **Modify** `frontend/app/globals.css` — add onboarding tooltip styles and help page card styles

## Implementation Checklist

After implementing the changes above, you MUST complete these steps
in order before claiming the work is done:

1. **Build:** Run `cd frontend && npm run build` — fix any errors.
2. **Lint:** Run `cd frontend && npm run lint` — fix any errors.
3. **Start dev server:** Run `cd frontend && npm run dev` to start
   the local dev server on port 3000.
4. **Run every Playwright test above.** Open the browser, follow
   each test's steps exactly, and verify each expected result using
   browser snapshots. If a test fails, fix the code and re-run it.
5. **Do not skip any test.** Every test in the Playwright Test Plan
   must pass before this spec is considered complete.
6. **Revert all test mutations.** Check the Test Mutations Log and
   undo every data change made during testing. Confirm with the
   user that all test data has been cleaned up.
