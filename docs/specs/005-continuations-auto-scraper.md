# Spec 005: Continuations Auto-Scraper

**PRD Reference:** FR-030 (scraper), extended for continuations
**Priority:** Must Have
**Depends on:** 003 (Continuations tracker — Done)

## What This Feature Does

Admins can scrape their association's continuations web pages to automatically parse tryout round data (continuing players, final teams, or "everyone continues" announcements). Scraped data saves as a **draft** that admins preview and confirm before it becomes visible to parents. This replaces manual data entry of jersey numbers from external websites.

## Current State

### Continuations system (complete)
- `continuation_rounds` table stores rounds per team level with jersey numbers, IP players, and session splits
- `frontend/app/(app)/continuations/page.tsx` — server component fetches rounds for active division
- `frontend/components/continuations/round-section.tsx` — renders rounds with expanding sections, including a **collapsible round summary** below the session info line. The summary is collapsed by default and shows: continuing count (with IP breakdown), cuts from previous round, new players not in the previous round, and session date/times. It resets to collapsed when switching rounds via the dropdown. All stats are computed client-side by diffing `jersey_numbers` between current and previous round — no extra DB fields needed.
- `frontend/app/(app)/continuations/actions.ts` — `getLatestRounds()`, `getAllRoundsForTeam()`, `lockFinalTeam()`
- Parents see rounds on the Sessions tab; admins can write via RLS

### Scraper infrastructure (schema only, no UI)
- `scraper_configs` table exists (`backend/supabase/migrations/20260417000007_create_scraper_configs.sql`) with `association_id`, `label`, `url`, `selectors` (jsonb), `last_scraped_at`
- RLS allows group_admin/admin to CRUD
- No frontend components or API routes exist yet

### Settings page (placeholder)
- `frontend/app/(app)/settings/page.tsx` — shows "Profile and preferences coming soon"
- Avatar in header links to `/settings` via `<Link href="/settings">` in `frontend/components/layout/division-switcher.tsx`

### Admin layout
- `frontend/app/admin/layout.tsx` — uses `requireAdmin()`, shows admin header
- Pattern: server component checks role, client component handles interaction

## Changes Required

### Database

**Migration: `20260420000004_add_draft_status_and_scraper_urls.sql`**

1. Add `status` column to `continuation_rounds`:
   - `status text NOT NULL DEFAULT 'published'` — values: `'draft'`, `'published'`
   - Default `'published'` so existing rows are unaffected

2. Add `source_url` and `scraped_at` columns to `continuation_rounds`:
   - `source_url text` — nullable, stores the URL the data was scraped from
   - `scraped_at timestamptz` — nullable, when the scrape happened

3. Create `continuations_urls` config table:
   ```
   continuations_urls (
     id uuid PK,
     association_id uuid FK → associations,
     division text NOT NULL,
     url text NOT NULL,
     created_at timestamptz,
     updated_at timestamptz,
     UNIQUE (association_id, division)
   )
   ```
   - RLS: group_admin/admin can CRUD, members can SELECT
   - Seed with NGHA URLs:
     - U13: `http://www.gowildcats.ca/content/U13-Continuations`
     - U15: `http://www.gowildcats.ca/content/U15-Continuations`
     - U18: `http://www.gowildcats.ca/content/U18-Continuations`

4. Update the `getLatestRounds()` query filter: only return rows WHERE `status = 'published'` so drafts are invisible to parents.

### Server Actions

**New file: `frontend/app/(app)/continuations/scraper-actions.ts`**

All actions use `"use server"` and the standard `createClient()` from `@/lib/supabase/server`.

1. `scrapeContinuationsPage(associationId: string, division: string)`
   - Fetches the URL from `continuations_urls` for the given association+division
   - Uses `fetch()` to get the HTML (no Cheerio needed — the pages are simple text)
   - Parses the response to extract:
     - **Page type**: continuation / final team / everyone continues / no data
     - **Team level**: from text like "U13AA skate" → team_level "AA"
     - **Jersey numbers**: all numeric values (3-4 digit patterns)
     - **IP players**: numbers followed by "IP" suffix
     - **Reporting date**: from text like "report on Tuesday April 21st"
   - Returns a `ScrapeResult` object (not saved yet):
     ```typescript
     type ScrapeResult = {
       pageType: "continuation" | "final_team" | "everyone_continues" | "no_data"
       teamLevel: string | null
       jerseyNumbers: string[]
       ipPlayers: string[]
       reportingDate: string | null
       sourceUrl: string
       rawText: string  // for debugging
       error?: string
     }
     ```

2. `saveDraftRound(associationId: string, division: string, scrapeResult: ScrapeResult)`
   - Determines next `round_number` by querying max existing round for that team level
   - For "everyone_continues": copies jersey list from the latest published round
   - Inserts into `continuation_rounds` with `status: 'draft'`
   - Sets `source_url` and `scraped_at`
   - Sessions: single session with the reporting date if available, otherwise empty
   - Returns `{ draftId: string, error?: string }`

3. `confirmDraft(roundId: string)`
   - Updates `status` from `'draft'` to `'published'`
   - Returns `{ error?: string }`

4. `discardDraft(roundId: string)`
   - Deletes the draft row
   - Returns `{ error?: string }`

5. `getDraftRounds(associationId: string, division: string)`
   - Returns all draft rounds for the division (for showing pending drafts)
   - Returns `ContinuationRound[]`

6. `getContinuationsUrl(associationId: string, division: string)`
   - Returns `{ url: string | null }` — checks if a URL is configured

### Pages

**Modify: `frontend/app/(app)/settings/page.tsx`**

Convert from placeholder to a real settings page. This is a server component that:
- Calls `requireAssociation()` to get user info and role
- Passes `role`, `associationId`, `initials`, `email` to a new client component
- The client component renders a settings menu with user info and admin actions

**New component: `frontend/components/settings/settings-page-client.tsx`**

Client component that renders the settings page:
- Shows user info section (email, initials avatar, association name)
- Shows a "Sign Out" button (links to `/logout`)
- If user role is `group_admin` or `admin`, shows an **Admin Actions** section with:
  - "Scrape Continuations" button → navigates to `/settings/scrape`
  - Future admin actions can be added here

**New page: `frontend/app/(app)/settings/scrape/page.tsx`**

Server component that:
- Calls `requireAdmin()` (redirects non-admins)
- Gets active division from `getActiveDivision()`
- Fetches existing draft rounds for that division via `getDraftRounds()`
- Gets the configured URL for this division via `getContinuationsUrl()`
- Passes data to `ScrapePageClient`

**New component: `frontend/components/settings/scrape-page-client.tsx`**

Client component — the main scraper UI. Three states:

**State 1 — Ready to scrape:**
- Shows the source URL (linked, opens in new tab) or "No URL configured" message
- Shows current division badge (read-only, matches the active division from Sessions tab)
- "Scrape Now" button (disabled if no URL configured)
- If existing drafts, shows them below with Confirm/Discard buttons

**State 2 — Scraping (loading):**
- Spinner on the "Scrape Now" button
- "Fetching continuations page..." text

**State 3 — Preview (after scrape completes):**
- **Source link** at top (tappable, opens source page in new tab for verification)
- **Summary card:**
  - Type detected (e.g., "Continuation", "Final Team", "Everyone Continues")
  - Team level (e.g., "U13 AA")
  - Player count (e.g., "31 players")
  - IP players count (e.g., "1 IP")
  - Reporting date if found
- **Jersey numbers** listed below the card (all numbers, with IP flagged)
- **Confirm** button (gold, primary) — saves as draft then publishes
- **Discard** button (muted, secondary) — cancels without saving

**Error handling:**
- If URL fetch fails: show error message with retry button
- If page type is "no_data": show "No continuations data found on this page"
- If classification is uncertain: show the raw text excerpt and let admin decide

### Components

No new shared components needed. The scraper UI is self-contained in the settings/scrape route.

### Styles

Add to `frontend/app/globals.css`:

- `.settings-page` — page container
- `.settings-section` — section grouping (user info, admin actions)
- `.settings-section-title` — section header (mono font, uppercase, dust color)
- `.settings-user-info` — user info row (avatar + email)
- `.settings-action-btn` — action button style (like division options)
- `.scrape-page` — scraper page container
- `.scrape-source-link` — source URL display (linked, gold color)
- `.scrape-summary-card` — preview summary card (dark bg, bordered)
- `.scrape-summary-row` — key-value row in summary card
- `.scrape-summary-label` — label (dust color, mono)
- `.scrape-summary-value` — value (gold color)
- `.scrape-jersey-list` — jersey number list container
- `.scrape-jersey-chip` — individual jersey number chip
- `.scrape-jersey-chip-ip` — IP-flagged variant
- `.scrape-actions` — confirm/discard button row
- `.scrape-confirm-btn` — gold primary button
- `.scrape-discard-btn` — muted secondary button
- `.scrape-loading` — loading state text
- `.scrape-error` — error message styling

## Key Implementation Details

### HTML Parsing Logic

The NGHA continuations pages are simple text-based pages. No Cheerio needed — `fetch()` + regex/string parsing is sufficient. The classifier should check for these patterns in order:

1. **No data**: Page has no jersey numbers at all → `"no_data"`
2. **Everyone continues**: Text contains "no releases" or "all players" + "attend" → `"everyone_continues"`
3. **Final team**: Text contains "final team" or "final roster" → `"final_team"`
4. **Continuation** (default): Has jersey numbers + text like "report" or "invited" or "following players" → `"continuation"`

Jersey number extraction: find all 1-4 digit numbers that appear as standalone tokens (not part of dates, times, or addresses). Pattern: `/\b(\d{1,4})\s*(IP)?\b/g` applied to the main content area.

Team level extraction: look for patterns like `U13AA`, `U15 AA`, `U13A`, `U18BB` in the text. Normalize to uppercase tier (AA, A, BB, B, C).

### Draft visibility

The critical change is in `getLatestRounds()` in `frontend/app/(app)/continuations/actions.ts`. Add `.eq("status", "published")` to the query so drafts are invisible to all users (including admins) on the public Sessions page. Drafts only appear on the `/settings/scrape` page.

### Round number auto-increment

When saving a draft, query `MAX(round_number)` for that association+division+team_level from ALL rounds (including drafts) to determine the next number. This prevents collisions.

### "Everyone continues" handling

When the page says "no releases tonight, all players attend":
- Copy the jersey_numbers and ip_players from the latest published round for the same team level
- Increment round_number
- Save with empty sessions (no specific session data available)
- The preview should clearly say "Everyone continues — roster copied from Round N"

### RLS considerations

All operations go through the authenticated Supabase client (not service role). The existing RLS policies on `continuation_rounds` already restrict INSERT/UPDATE/DELETE to group_admin/admin. No admin client bypass needed.

### No new dependencies

The pages are simple enough that `fetch()` + string parsing handles everything. Do not add Cheerio.

## Acceptance Criteria

- [ ] `continuation_rounds` table has `status`, `source_url`, `scraped_at` columns
- [ ] `continuations_urls` config table exists with NGHA seed data
- [ ] Parent-facing Sessions page only shows `status = 'published'` rounds
- [ ] Existing rounds (already published) are unaffected by migration
- [ ] Settings page shows user info, sign out, and admin actions (for admins)
- [ ] Non-admins see settings but NOT the "Scrape Continuations" action
- [ ] Scrape button fetches the configured URL for the active division
- [ ] Page classifier correctly identifies: continuation, everyone continues, no data
- [ ] Jersey numbers and IP players are correctly extracted
- [ ] Preview shows summary card + all jersey numbers + source link
- [ ] Confirm publishes the draft (visible on Sessions page)
- [ ] Discard deletes the draft
- [ ] "Everyone continues" copies previous round's roster
- [ ] No URL configured shows appropriate message (not an error)
- [ ] Build passes (`npm run build`)
- [ ] No lint errors (`npm run lint`)

## Playwright Test Plan

**Setup:** Log in as the group_admin user. Navigate to the app. The active division should be U15 (has the most players). NGHA continuations URLs should be seeded in the database.

### Test 1: Settings page shows admin actions for admin user
1. Navigate to `/settings`
2. Take a snapshot
3. **Verify:** Page shows user email, sign out button, and "Admin Actions" section with "Scrape Continuations" button

### Test 2: Settings page hides admin actions for parent user
1. Log in as a parent (non-admin) user
2. Navigate to `/settings`
3. Take a snapshot
4. **Verify:** Page shows user email and sign out, but NO "Admin Actions" section

### Test 3: Scrape page loads with configured URL
1. From settings, click "Scrape Continuations"
2. Take a snapshot
3. **Verify:** Page shows the source URL for the active division, "Scrape Now" button is enabled

### Test 4: Scrape executes and shows preview
1. On `/settings/scrape`, click "Scrape Now"
2. Wait for loading to complete
3. Take a snapshot
4. **Verify:** Preview shows: type detected, team level, player count, IP count, and list of jersey numbers. Source link is visible at top.

### Test 5: Confirm publishes the round
1. After scraping, click "Confirm"
2. Navigate to `/continuations`
3. Take a snapshot
4. **Verify:** The newly scraped round appears in the Sessions page for the correct team level

### Test 6: Discard removes the draft
1. Scrape again (or navigate to scrape page with existing draft)
2. Click "Discard"
3. Navigate to `/continuations`
4. **Verify:** No new round appeared on the Sessions page

### Test 7: Draft is invisible on Sessions page
1. Scrape but do NOT confirm (leave as draft)
2. Navigate to `/continuations`
3. **Verify:** The draft round does NOT appear in the Sessions list

### Test 8: No URL configured shows message
1. Switch to a division that has no URL configured (e.g., U11 if not seeded)
2. Navigate to `/settings/scrape`
3. **Verify:** Shows "No continuations URL configured for this division" and Scrape button is disabled

### Test 9: Everyone continues detection
1. Switch to U18 division (current page says "no releases tonight")
2. Navigate to `/settings/scrape` and click "Scrape Now"
3. **Verify:** Preview shows type "Everyone Continues" with roster copied from previous round

### Test 10: Non-admin cannot access scrape page
1. Log in as parent user
2. Navigate directly to `/settings/scrape`
3. **Verify:** Redirected to `/dashboard` (requireAdmin guard)

## Files to Touch

**New files:**
1. `backend/supabase/migrations/20260420000004_add_draft_status_and_scraper_urls.sql`
2. `frontend/app/(app)/continuations/scraper-actions.ts`
3. `frontend/app/(app)/settings/scrape/page.tsx`
4. `frontend/components/settings/settings-page-client.tsx`
5. `frontend/components/settings/scrape-page-client.tsx`

**Modified files:**
6. `frontend/app/(app)/settings/page.tsx` — replace placeholder with real settings page
7. `frontend/app/(app)/continuations/actions.ts` — add `status = 'published'` filter to `getLatestRounds()`
8. `frontend/types/database.ts` — regenerate after migration (or manually add new columns/table types)
9. `frontend/app/globals.css` — add settings and scraper styles

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
