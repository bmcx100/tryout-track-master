# Track Master -- Product Requirements Document

**Version:** 1.0
**Date:** 2026-04-17
**Status:** Draft
**Author:** Requirements Analysis Agent

---

## Table of Contents

1. [Functional Requirements](#1-functional-requirements)
2. [Non-Functional Requirements](#2-non-functional-requirements)
3. [User Stories](#3-user-stories)
4. [Data Requirements](#4-data-requirements)
5. [Integration Requirements](#5-integration-requirements)
6. [Constraints and Assumptions](#6-constraints-and-assumptions)

---

## 1. Functional Requirements

### 1.1 Authentication and User Management

| ID | Description | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-001 | The system shall allow users to sign up and sign in using email and password. | Must Have | User can register with email/password, receive a confirmation email, verify their account, and log in successfully. Session persists across page reloads. |
| FR-002 | The system shall allow users to sign in using Google OAuth. | Must Have | User can click "Sign in with Google," authenticate via Google's consent screen, and be redirected back to the app in an authenticated state. |
| FR-003 | The system shall allow users to sign out. | Must Have | User can sign out from any authenticated page. Session is destroyed on both client and server. User is redirected to the landing/login page. |
| FR-004 | The system shall allow users to reset their password via email. | Should Have | User receives a password reset email with a secure link. Clicking the link allows them to set a new password. The old password is invalidated. |
| FR-005 | The system shall maintain authenticated sessions across requests using Supabase session refresh in the Next.js 16 proxy layer. | Must Have | Sessions are refreshed transparently via proxy.ts using `getClaims()`. Users are not randomly logged out. Expired sessions redirect to the login page. |

### 1.2 Association Management

| ID | Description | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-006 | The system shall support multiple hockey associations as separate tenants. | Must Have | Each association has its own set of players, teams, and tryout data. Data from one association is never visible to users of another association (unless a user belongs to both). |
| FR-007 | The system shall allow users to join one or more associations by entering a join code or accepting an invitation. | Must Have | A user can enter a join code on a "Join Association" screen and be added as a member (parent role) of that association. The join code is provided out-of-band by the association admin. |
| FR-008 | The system shall allow an association admin to create and configure a new association. | Must Have | An admin can create an association with a name, abbreviation, and optional logo URL. A unique join code is generated automatically. |
| FR-009 | The system shall allow an association admin to manage the join code (regenerate or disable). | Should Have | Admin can regenerate the join code (invalidating the old one) or disable joining entirely. |

### 1.3 Player Status Tracking

| ID | Description | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-010 | The system shall display a list of all players currently in tryouts for a given association, grouped by age division. | Must Have | Parents see a filterable, searchable list of players showing: name, jersey number, age division, current tryout status, and last-updated timestamp. |
| FR-011 | The system shall track each player's tryout status with the following values: Registered, Trying Out, Cut, Made Team, Moved Up, Moved Down, Withdrew. | Must Have | Each player has exactly one status at any given time. Status transitions are recorded with a timestamp. The UI clearly distinguishes between active (Trying Out) and terminal (Cut, Made Team, Withdrew) statuses. |
| FR-012 | The system shall allow filtering players by status, age division, and team. | Must Have | Users can apply one or more filters simultaneously. The player list updates immediately. Filter state persists during the session. |
| FR-013 | The system shall allow searching players by name or jersey number. | Must Have | Search is case-insensitive and returns partial matches. Results update as the user types (debounced, not on every keystroke). |
| FR-014 | The system shall display a "last updated" timestamp on both the overall tryout data and each individual player record. | Should Have | Timestamps display in the user's local timezone. A relative format (e.g., "2 hours ago") is used alongside the absolute timestamp. |

### 1.4 Team Projection and Sorting

| ID | Description | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-015 | The system shall display projected team rosters based on the remaining players and available team slots. | Must Have | After cuts are applied, the system shows which teams still have open spots and which players are likely candidates. Projections are displayed per age division. |
| FR-016 | The system shall allow the admin to define teams within an age division (e.g., U13 AA, U13 A, U13 BB). | Must Have | Admin can create, rename, reorder, and archive teams. Each team has a name, a division, and a maximum roster size. |
| FR-017 | The system shall allow the admin to assign or move players between projected teams. | Must Have | Admin can drag-and-drop or select-and-assign players to teams. The system warns if a team would exceed its roster limit. |
| FR-018 | The system shall show a summary dashboard with counts of players by status per division and team. | Should Have | Dashboard shows total players, number trying out, number cut, number who made a team, and number of open spots per team -- all at a glance. |

### 1.5 Admin/Manager Role and Controls

| ID | Description | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-019 | The system shall support two roles per association: Admin and Parent. | Must Have | Admins have full read/write access to association data. Parents have read access plus the ability to submit corrections. Role is assigned per association (a user can be an admin in one association and a parent in another). |
| FR-020 | The system shall allow admins to import players via CSV upload. | Must Have | Admin uploads a CSV file with columns: name, jersey number, age division, and optionally team/status. The system validates the file, shows a preview of rows to be imported, and reports any errors before committing. Duplicate detection is based on name + jersey number within the same division. |
| FR-021 | The system shall allow admins to manually add, edit, and remove individual player records. | Must Have | Admin can create a new player with name, jersey number, division, and initial status. Admin can edit any field. Admin can delete a player (soft delete with audit trail). |
| FR-022 | The system shall allow admins to bulk-update player statuses (e.g., mark multiple players as Cut after a tryout round). | Should Have | Admin selects multiple players via checkboxes, chooses a new status, and confirms. All selected players are updated atomically. |
| FR-023 | The system shall allow admins to promote another user to admin or demote an admin to parent within the association. | Should Have | The last remaining admin cannot be demoted. Role changes take effect immediately. |
| FR-024 | The system shall log all admin actions (imports, edits, status changes, role changes) in an audit trail. | Should Have | Audit log records the admin user, action type, affected record(s), old/new values, and timestamp. The log is viewable by admins only. |

### 1.6 User-Submitted Corrections

| ID | Description | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-025 | The system shall allow parents to submit a correction request for any player record they believe is inaccurate. | Must Have | Parent selects a player, indicates which field is wrong (status, team, jersey number), provides the corrected value and an optional note. The correction enters a "Pending" state. |
| FR-026 | The system shall display pending corrections to association admins in a review queue. | Must Have | Admins see a badge/count of pending corrections. The queue shows the original value, proposed value, submitting user, and timestamp. Admins can approve or reject each correction. |
| FR-027 | The system shall automatically apply approved corrections to the player record. | Must Have | When an admin approves a correction, the player record is updated to the new value via a database trigger. The correction status changes to "Approved" and the change appears in the audit log. |
| FR-028 | The system shall notify the submitting user of the outcome of their correction (approved or rejected). | Nice to Have | The user sees a notification (in-app) indicating their correction was approved or rejected. If rejected, the admin's reason (if provided) is shown. |
| FR-029 | The system shall prevent duplicate correction submissions for the same field on the same player while a correction is already pending. | Should Have | If a pending correction already exists for the same player and field, the system informs the user and prevents submission. |

### 1.7 Web Scraping Import

| ID | Description | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-030 | The system shall allow admins to configure a web scraping source for their association's tryout results page. | Must Have | Admin provides the URL and selects or configures CSS selectors for the data fields (player name, number, status). The configuration is saved and can be tested before running a full import. |
| FR-031 | The system shall support scraping static HTML pages using Cheerio (fetch + parse). | Must Have | The scraper can extract player data from standard HTML tables and lists on association websites. It handles common variations in markup structure. |
| FR-032 | The system shall support scraping JavaScript-rendered pages as a fallback using a headless browser. | Nice to Have | For sites that require JavaScript execution to render data, the system uses Puppeteer-core with @sparticuz/chromium-min in a serverless function. |
| FR-033 | The system shall allow admins to run a scrape on demand and preview the results before importing. | Must Have | Admin clicks "Scrape Now," the system fetches and parses the page, and displays a preview showing new players, status changes, and any parsing warnings. Admin confirms before data is written. |
| FR-034 | The system shall detect and highlight changes between the scraped data and existing records. | Should Have | The preview differentiates between new players (not in the system), updated players (status changed), and unchanged players. Only changes are imported on confirmation. |
| FR-035 | The system shall store scraper configurations (selectors, URL patterns) in the database, keyed by association. | Must Have | Each association can have one or more scraper configs. Configs include: URL, CSS selectors for name/number/status/team, and a label. Configs are editable by admins. |

### 1.8 Navigation and UI

| ID | Description | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-036 | The system shall provide a mobile-first responsive layout for parent-facing screens. | Must Have | All parent-facing pages (player list, team projections, correction submission) are fully usable on a 375px-wide screen. Touch targets meet minimum 44x44px. |
| FR-037 | The system shall provide a desktop-optimized layout for admin dashboard screens. | Must Have | Admin screens (player management, import, corrections queue, scraper config) use a wider layout with side navigation. They remain functional on mobile but are designed for desktop use. |
| FR-038 | The system shall provide a landing page that explains the product and directs users to sign up or log in. | Must Have | Landing page is publicly accessible. It describes the value proposition, shows a call to action, and links to login/signup. It is the default route for unauthenticated users. |
| FR-039 | The system shall provide an association selector for users who belong to multiple associations. | Should Have | After login, if a user belongs to multiple associations, they see a selector. The chosen association is persisted in the session/URL. Users can switch associations from the main navigation. |

---

## 2. Non-Functional Requirements

### 2.1 Performance

| ID | Description | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| NFR-001 | Pages shall achieve a Largest Contentful Paint (LCP) of under 2.5 seconds on a 4G mobile connection. | Must Have | Measured via Lighthouse or Web Vitals in the field. Server-side rendering and static generation are used where appropriate. |
| NFR-002 | The player list shall render up to 500 players without perceptible lag or jank. | Must Have | List renders within 200ms on a mid-range mobile device. Virtualized scrolling is used if the list exceeds the viewport. |
| NFR-003 | Search and filter operations shall return results within 300ms. | Must Have | Filtering is performed client-side on cached data for lists under 500 players. Server-side filtering is available as a fallback. |
| NFR-004 | Web scraping operations shall complete within 60 seconds for static HTML sites. | Should Have | A timeout is enforced. If the scrape exceeds the timeout, the user is informed and can retry. Progress indication is shown during the operation. |
| NFR-005 | API response times for standard CRUD operations shall be under 500ms at the 95th percentile. | Should Have | Measured via Supabase dashboard or application logging. |

### 2.2 Security

| ID | Description | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| NFR-006 | All data access shall be controlled by Supabase Row-Level Security (RLS) policies. | Must Have | No table is accessible without an RLS policy. Policies enforce that users can only access data for associations they belong to. Direct database access without authentication returns zero rows. |
| NFR-007 | Admin-only operations shall be enforced at the database level, not just the UI. | Must Have | RLS policies and/or SECURITY DEFINER functions verify the user's role before allowing write operations. Bypassing the UI (e.g., direct API calls) does not grant unauthorized access. |
| NFR-008 | Authentication tokens shall be stored in secure, HttpOnly cookies managed by @supabase/ssr. | Must Have | No auth tokens are stored in localStorage or exposed to client-side JavaScript. Cookie attributes include Secure, SameSite=Lax, and appropriate Path/Domain. |
| NFR-009 | The system shall use PKCE (Proof Key for Code Exchange) flow for all OAuth authentication. | Must Have | Verified by inspecting the Supabase auth configuration. PKCE is the default for SSR in @supabase/ssr. |
| NFR-010 | All user inputs shall be sanitized to prevent XSS and SQL injection attacks. | Must Have | Parameterized queries are used for all database operations (Supabase client handles this). React's built-in XSS protection is relied upon for rendering. Any raw HTML rendering (if needed for scraped content preview) uses a sanitization library. |
| NFR-011 | The system shall enforce HTTPS for all connections. | Must Have | Vercel enforces HTTPS by default. HTTP requests are redirected to HTTPS. |

### 2.3 Privacy and Compliance

| ID | Description | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| NFR-012 | The system shall display a privacy notice explaining what data is collected, why, and how it is used. | Must Have | Privacy notice is accessible from the signup page and the footer of every page. It is written in plain language. |
| NFR-013 | The system shall implement a parental consent mechanism before collecting or displaying data about minor players. | Must Have | Upon first access to player data, the user must acknowledge that they consent to the collection and display of minors' names, jersey numbers, and tryout statuses. Consent is recorded with a timestamp. |
| NFR-014 | The system shall practice data minimization by collecting only name, jersey number, age division, team, and tryout status for players. | Must Have | No additional personal information (date of birth, address, parent contact info, photos) is collected or stored for players. |
| NFR-015 | The system shall automatically purge player data 90 days after the end of the tryout season. | Must Have | A scheduled process (Supabase cron or Edge Function) deletes or anonymizes player data 90 days after the association admin marks the season as complete. Admins receive a warning 30 days before purge. Users are informed of the retention policy in the privacy notice. |
| NFR-016 | The system shall allow any user to request deletion of their account and associated data. | Should Have | Users can initiate account deletion from their profile settings. The system removes their user record, role assignments, and correction submissions within 30 days. |

### 2.4 Scalability

| ID | Description | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| NFR-017 | The system shall support up to 200 concurrent users at launch without degradation. | Must Have | Load tested with 200 simulated users performing typical read operations. P95 response time remains under 1 second. |
| NFR-018 | The system shall support scaling to a few thousand users within 12 months without architectural changes. | Should Have | The multi-tenant data model, RLS policies, and Supabase infrastructure can handle 5,000 users across 20 associations. Indexes are in place for common query patterns. |
| NFR-019 | The database schema shall support adding new associations without schema changes. | Must Have | All tenant-specific data is isolated via association_id foreign keys. No hardcoded association references exist in the schema. |

### 2.5 Availability

| ID | Description | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| NFR-020 | The system shall target 99.5% uptime, measured monthly. | Must Have | Uptime is dependent on Vercel and Supabase SLAs. Monitoring is configured to alert on downtime (e.g., via Vercel's built-in monitoring or a free uptime checker). |
| NFR-021 | The system shall handle Supabase or Vercel outages gracefully with user-facing error messages. | Should Have | When backend services are unavailable, users see a friendly error page rather than a blank screen or stack trace. Cached data is displayed where possible. |

### 2.6 Usability

| ID | Description | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| NFR-022 | The system shall be accessible to WCAG 2.1 Level AA standards. | Should Have | All interactive elements are keyboard-navigable. Color contrast ratios meet AA thresholds. Screen reader users can navigate the player list and submit corrections. shadcn/ui components (built on Radix primitives) provide baseline accessibility. |
| NFR-023 | The system shall support light and dark modes. | Nice to Have | Theme respects the user's OS preference by default. Users can override the theme manually. Theme preference is persisted. |
| NFR-024 | The system shall provide clear loading states and error messages for all asynchronous operations. | Must Have | Skeleton loaders or spinners are shown during data fetching. Error states display actionable messages (e.g., "Failed to load players. Tap to retry."). Empty states explain why no data is shown (e.g., "No players have been added yet."). |
| NFR-025 | A new parent user shall be able to sign up, join an association, and view the player list within 2 minutes. | Should Have | Measured by user testing. The onboarding flow has no more than 3 screens between signup and viewing data. |

---

## 3. User Stories

### 3.1 Parent (Regular User)

| ID | User Story | Related FRs |
|----|-----------|-------------|
| US-001 | As a parent, I want to sign up with my Google account, so that I can get started quickly without creating a new password. | FR-002, FR-005 |
| US-002 | As a parent, I want to join my child's hockey association using a code shared by the team manager, so that I can see tryout results for that association. | FR-007 |
| US-003 | As a parent, I want to see a list of all players in tryouts for my association, so that I can find out who is still trying out and who has been cut. | FR-010, FR-011 |
| US-004 | As a parent, I want to search for a specific player by name or jersey number, so that I can quickly check on my friends' kids without scrolling through the entire list. | FR-013 |
| US-005 | As a parent, I want to filter players by tryout status (e.g., show only "Cut" or "Made Team"), so that I can focus on the information most relevant to me. | FR-012 |
| US-006 | As a parent, I want to see projected team rosters, so that I can get a sense of which team my child will likely end up on and who their teammates might be. | FR-015 |
| US-007 | As a parent, I want to submit a correction if I notice incorrect information about a player, so that the data stays accurate for everyone. | FR-025 |
| US-008 | As a parent, I want to know when my correction has been reviewed, so that I can see if the information was updated or understand why it was rejected. | FR-028 |
| US-009 | As a parent, I want to see when the tryout data was last updated, so that I know how current the information is. | FR-014 |
| US-010 | As a parent, I want to use the app comfortably on my phone while at the rink, so that I don't need to bring a laptop or squint at a tiny desktop layout. | FR-036 |
| US-011 | As a parent, I want to belong to multiple associations (e.g., one for each of my children), so that I can track tryouts across organizations from a single account. | FR-006, FR-039 |

### 3.2 Association Admin

| ID | User Story | Related FRs |
|----|-----------|-------------|
| US-012 | As an admin, I want to create a new association and get a join code, so that I can invite parents from my hockey community. | FR-008 |
| US-013 | As an admin, I want to import a CSV of players with their names, numbers, and divisions, so that I can quickly populate the system at the start of tryouts. | FR-020 |
| US-014 | As an admin, I want to configure a web scraper for my association's tryout results page, so that I can pull results directly from the source instead of entering them manually. | FR-030, FR-035 |
| US-015 | As an admin, I want to run a scrape on demand and preview the changes before importing, so that I can verify the data is correct and avoid overwriting good information with bad parses. | FR-033, FR-034 |
| US-016 | As an admin, I want to update player statuses in bulk after a tryout round, so that I can efficiently process a batch of cuts or team assignments. | FR-022 |
| US-017 | As an admin, I want to define the teams in each age division and their roster limits, so that team projections are accurate. | FR-016 |
| US-018 | As an admin, I want to assign players to projected teams, so that parents can see where the remaining players are likely to land. | FR-017 |
| US-019 | As an admin, I want to review and approve or reject corrections submitted by parents, so that I maintain control over data accuracy while benefiting from community input. | FR-026, FR-027 |
| US-020 | As an admin, I want to see an audit trail of all data changes, so that I can track who changed what and when, and revert mistakes if needed. | FR-024 |
| US-021 | As an admin, I want to manage the association's join code, so that I can control who has access and regenerate it if it's shared too widely. | FR-009 |
| US-022 | As an admin, I want a dashboard showing player counts by status and division, so that I can get a quick overview of where tryouts stand. | FR-018 |
| US-023 | As an admin, I want to use the admin dashboard on my desktop with a spacious layout, so that I can manage large data sets efficiently. | FR-037 |

### 3.3 System

| ID | User Story | Related FRs/NFRs |
|----|-----------|-----------------|
| US-024 | As the system, I want to automatically apply approved corrections via a database trigger, so that the admin approval workflow is seamless and atomic. | FR-027 |
| US-025 | As the system, I want to purge player data 90 days after season end, so that we comply with data minimization principles and PIPEDA best practices. | NFR-015 |
| US-026 | As the system, I want to enforce data access boundaries via RLS policies, so that a user in Association A can never see data from Association B. | NFR-006, NFR-007 |
| US-027 | As the system, I want to refresh user sessions transparently in the proxy layer, so that users are not randomly logged out during normal usage. | FR-005 |

---

## 4. Data Requirements

### 4.1 Key Entities and Relationships

```
users (Supabase auth.users)
  |
  |-- user_associations (many-to-many)
  |     - user_id (FK -> auth.users)
  |     - association_id (FK -> associations)
  |     - role (enum: admin, parent)
  |     - joined_at
  |     - consent_given_at
  |
  |-- corrections (submitted by users)
        - id
        - player_id (FK -> tryout_players)
        - user_id (FK -> auth.users)
        - association_id (FK -> associations)
        - field_name
        - old_value
        - new_value
        - note (optional)
        - status (enum: pending, approved, rejected)
        - reviewed_by (FK -> auth.users, nullable)
        - reviewed_at (nullable)
        - created_at

associations
  |
  |-- teams
  |     - id
  |     - association_id (FK)
  |     - division (e.g., "U13")
  |     - name (e.g., "AA")
  |     - display_order
  |     - max_roster_size
  |     - is_archived (boolean)
  |
  |-- tryout_players
  |     - id
  |     - association_id (FK)
  |     - name
  |     - jersey_number
  |     - division
  |     - team_id (FK -> teams, nullable)
  |     - status (enum: registered, trying_out, cut,
  |              made_team, moved_up, moved_down, withdrew)
  |     - status_updated_at
  |     - created_at
  |     - updated_at
  |     - deleted_at (nullable, soft delete)
  |
  |-- scraper_configs
  |     - id
  |     - association_id (FK)
  |     - label
  |     - url
  |     - selectors (JSONB: name, number, status, team)
  |     - last_scraped_at (nullable)
  |     - created_at
  |     - updated_at
  |
  |-- audit_log
        - id
        - association_id (FK)
        - user_id (FK -> auth.users)
        - action (e.g., "player.create", "player.status_change",
                  "import.csv", "correction.approve")
        - target_table
        - target_id
        - old_values (JSONB, nullable)
        - new_values (JSONB, nullable)
        - created_at

associations (detail)
  - id
  - name
  - abbreviation
  - logo_url (nullable)
  - join_code (unique)
  - join_enabled (boolean, default true)
  - season_end_date (nullable)
  - data_purge_date (nullable, computed: season_end_date + 90 days)
  - created_at
  - updated_at
```

### 4.2 PostgreSQL Enums

- **player_status:** `registered`, `trying_out`, `cut`, `made_team`, `moved_up`, `moved_down`, `withdrew`
- **app_role:** `admin`, `parent`
- **correction_status:** `pending`, `approved`, `rejected`

### 4.3 Data Retention Policies

| Data Type | Retention Period | Purge Mechanism |
|-----------|-----------------|-----------------|
| Player records (tryout_players) | Until 90 days after season end date | Supabase cron job or Edge Function runs daily, deletes records where `association.data_purge_date <= NOW()`. A warning notification is sent to admins 30 days before purge. |
| Corrections | Purged with associated player records | Cascade delete on player_id FK. |
| Audit log | Purged with association season data | Deleted alongside player records at purge time. |
| User accounts | Until user requests deletion | Manual process or self-service deletion from profile settings. Account data removed within 30 days of request. |
| Scraper configs | Persistent (not season-specific) | Retained across seasons. Admin can delete manually. |
| Association records | Persistent | Retained indefinitely. Only the seasonal player data is purged. |

### 4.4 Privacy Constraints

- Player records contain only: name, jersey number, division, team assignment, and tryout status. No additional PII is collected.
- Players are minors. No direct relationship between a player record and a user account exists (parents do not "claim" their own children in the system). This is intentional for data minimization.
- User accounts store only: email, display name, and authentication metadata (managed by Supabase Auth).
- All player data is scoped to an association. Cross-association data leakage is prevented by RLS.
- Consent for viewing minor data is recorded per user per association with a timestamp.
- A privacy notice is displayed at signup and is accessible from every page.

---

## 5. Integration Requirements

### 5.1 External System Integrations

| Integration | Type | Details |
|-------------|------|---------|
| Supabase | Backend-as-a-Service | PostgreSQL database, authentication, RLS, Realtime subscriptions, Edge Functions, scheduled cron jobs. Accessed via `@supabase/ssr` and `@supabase/supabase-js`. |
| Vercel | Hosting and Serverless | Hosts the Next.js 16 application. Serverless functions handle API routes and scraping. Free/hobby tier. |
| Hockey Association Websites | Web Scraping (read-only) | Static HTML pages scraped via Cheerio. No API contracts exist. Site structures vary and are handled via per-association CSS selector configurations stored in the database. |
| Google OAuth | Authentication Provider | Configured in Supabase Auth dashboard. Uses PKCE flow via `@supabase/ssr`. Redirect URI: `/auth/callback`. |

### 5.2 Authentication Flows

**Email/Password Signup:**
1. User submits email and password on `/signup`.
2. Client calls `supabase.auth.signUp()` with `emailRedirectTo: '{origin}/auth/callback'`.
3. Supabase sends a confirmation email.
4. User clicks the confirmation link, which redirects to `/auth/callback?code=xxx`.
5. The callback route handler exchanges the code for a session via `exchangeCodeForSession(code)`.
6. User is redirected to the authenticated home page.

**Google OAuth:**
1. User clicks "Sign in with Google."
2. Client calls `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: '{origin}/auth/callback', queryParams: { prompt: 'select_account' } } })`.
3. User authenticates on Google's consent screen.
4. Google redirects to Supabase, which redirects to `/auth/callback?code=xxx`.
5. The callback route handler exchanges the code for a session.
6. User is redirected to the authenticated home page.

**Session Refresh (Proxy Layer):**
1. Every request matching the proxy matcher passes through `proxy.ts`.
2. The proxy calls `updateSession(request)` from `@/lib/supabase/proxy`.
3. `updateSession` creates a server client and calls `supabase.auth.getClaims()` to validate/refresh the JWT.
4. If the token was refreshed, updated cookies and cache-busting headers are applied to the response.
5. If no valid session exists and the route is protected, the user is redirected to `/login`.

**Logout:**
1. User navigates to `/logout` (a server component page).
2. The server component calls `supabase.auth.signOut()`.
3. User is redirected to `/`.

### 5.3 Scraping Architecture

```
Admin triggers scrape
        |
        v
  Next.js API Route (/api/scrape)
        |
        |--> Reads scraper_config from Supabase for the association
        |
        |--> Fetches the target URL
        |      |
        |      |--> Static HTML? --> Cheerio parses HTML with configured selectors
        |      |
        |      |--> JS-rendered? --> Puppeteer-core + @sparticuz/chromium-min
        |                            (fallback, Nice to Have)
        |
        |--> Extracts player data (name, number, status, team)
        |
        |--> Diffs against existing tryout_players records
        |      |
        |      |--> New players (not in DB)
        |      |--> Changed players (status or team differs)
        |      |--> Unchanged players (no diff)
        |
        |--> Returns preview to admin (does NOT write to DB yet)
        |
        v
  Admin reviews preview
        |
        |--> Confirms import
        |
        v
  Next.js API Route (/api/scrape/confirm)
        |
        |--> Upserts new/changed players into tryout_players
        |--> Creates audit_log entries
        |--> Updates scraper_config.last_scraped_at
        |
        v
  Admin sees updated player list
```

**Constraints:**
- Vercel serverless functions have a maximum execution duration of 300 seconds on the hobby tier and a 250MB bundle size limit.
- Puppeteer-core + @sparticuz/chromium-min is the only viable headless browser option within Vercel's constraints.
- Scraping must be initiated manually by an admin (no automatic/scheduled scraping in MVP).
- Legal: association permission should be obtained before scraping their website. This is the admin's responsibility, as they are typically affiliated with the association.

---

## 6. Constraints and Assumptions

### 6.1 Technical Constraints

| ID | Constraint |
|----|-----------|
| TC-001 | **Next.js 16 with App Router.** The project uses Next.js 16.1.6. Proxy.ts replaces middleware.ts. All auth session refresh must go through proxy.ts using `getClaims()`, not `getUser()` or `getSession()`. |
| TC-002 | **Supabase free/hobby tier.** Database size is limited to 500MB. Edge Function invocations are limited. Realtime connections are limited to 200 concurrent. These limits are sufficient for MVP scale but must be monitored. |
| TC-003 | **Vercel hobby tier.** Serverless function execution is limited to 300 seconds. Bundle size is limited to 250MB. Bandwidth is limited to 100GB/month. No cron jobs on Vercel free tier (use Supabase cron instead). |
| TC-004 | **No semicolons in TypeScript/JavaScript.** Project coding standard per CLAUDE.md. |
| TC-005 | **Tailwind classes must use @apply.** Per CLAUDE.md, no more than one Tailwind utility class is applied directly in JSX. Multi-class styling must be extracted into custom classes via `@apply`. |
| TC-006 | **Mobile web only for MVP.** No native mobile app. No PWA service worker. The application is a responsive web app accessed via mobile browsers. |
| TC-007 | **Monorepo structure.** All code (frontend, API routes, scraping logic, database types) lives in a single repository. |
| TC-008 | **Supabase RLS is mandatory.** Every table containing user or association data must have RLS enabled with appropriate policies. No table should be accessible without authentication. |

### 6.2 Business Constraints

| ID | Constraint |
|----|-----------|
| BC-001 | **Solo developer.** One developer building and maintaining the entire system. Architecture and tooling choices must minimize complexity and operational burden. |
| BC-002 | **Less than 4-week MVP timeline.** The MVP must be functional within 4 weeks. Feature scope must be aggressively managed. "Nice to Have" features are explicitly deferred. |
| BC-003 | **Budget under $500/month.** Infrastructure costs must stay within hobby/free tier limits. No paid third-party services unless absolutely necessary. |
| BC-004 | **Freemium model with no payments in MVP.** There is no paywall, subscription, or payment processing in the MVP. All features are free. Monetization strategy is deferred. |
| BC-005 | **Ontario, Canada is the launch market.** Initial associations are in Ontario. The app must work for Canadian users but does not need to support internationalization or localization beyond English. |

### 6.3 Key Assumptions

| ID | Assumption | Risk if Invalid |
|----|-----------|-----------------|
| KA-001 | Hockey association websites publish tryout results as static HTML pages that can be parsed with Cheerio. | If sites are heavily JavaScript-rendered or use anti-scraping measures, the Puppeteer fallback (Nice to Have) becomes a Must Have, adding complexity and cost. |
| KA-002 | Association admins will actively manage the system (importing players, reviewing corrections, configuring scrapers). | If admins are not engaged, data becomes stale, and parents lose trust in the platform. Mitigation: make admin workflows as frictionless as possible. |
| KA-003 | A join code is a sufficient access control mechanism for MVP. | If join codes are shared publicly, unauthorized users could view minor player data. Mitigation: codes can be regenerated; consider adding email-domain restrictions post-MVP. |
| KA-004 | 200 users at launch will not exceed Supabase or Vercel free tier limits. | If usage spikes unexpectedly (viral growth in a hockey community), the system may hit rate limits. Mitigation: monitor usage dashboards; upgrade to paid tier if needed. |
| KA-005 | Collecting player names and jersey numbers is acceptable under PIPEDA for a community-use application, provided consent and privacy notices are in place. | If a privacy complaint is filed, additional safeguards (e.g., anonymization, stricter access controls) may be required. Mitigation: consult with a privacy professional before public launch. |
| KA-006 | Parents will organically adopt the app if one or two "connector" parents in each association share the join code. | If adoption is low, the network effect doesn't materialize and the app provides little value over group texts. Mitigation: make the app useful even for a single user tracking their own child's tryout journey. |
| KA-007 | The @supabase/ssr package and Next.js 16 proxy pattern are stable and production-ready. | If breaking changes are introduced in either dependency, auth flows may break. Mitigation: pin dependency versions; monitor changelogs. |
| KA-008 | Supabase Realtime subscriptions are not required for MVP. Event-driven updates (user refreshes the page or pulls to refresh) are sufficient. | If parents expect live-updating data without refreshing, satisfaction may be lower. Mitigation: add Realtime subscriptions as a fast-follow post-MVP enhancement. |

---

## Appendix A: Feature Prioritization Summary

| Priority | Count | Features |
|----------|-------|----------|
| **Must Have** | 27 | Core auth, player tracking, team projections, admin CRUD, CSV import, corrections workflow, basic scraping, mobile-first UI |
| **Should Have** | 14 | Password reset, join code management, bulk status updates, admin promotion, audit trail, duplicate correction prevention, scrape diffing, dashboard summary, association selector |
| **Nice to Have** | 3 | Correction outcome notifications, JS-rendered site scraping, dark mode toggle |

### Post-MVP Features (Explicitly Out of Scope)

- Push notifications
- Historical data from past seasons
- Native mobile app (iOS and Android)
- Chat messaging between parents
- Email notifications when results are updated
- Scheduled/automatic scraping
- Payment processing and premium tiers
- Multi-language support

---

## Appendix B: Glossary

| Term | Definition |
|------|-----------|
| **Association** | A hockey organization (e.g., a minor hockey association) that runs tryouts. The top-level tenant in the system. |
| **Division** | An age-based grouping of players (e.g., U11, U13, U15). |
| **Team** | A specific team within a division (e.g., U13 AA, U13 A). |
| **Tryout Status** | The current state of a player in the tryout process (Registered, Trying Out, Cut, Made Team, Moved Up, Moved Down, Withdrew). |
| **Correction** | A change request submitted by a parent to fix inaccurate player data. Must be approved by an admin. |
| **Scraper Config** | A saved configuration of CSS selectors and URL for extracting player data from an association's website. |
| **Join Code** | A short, unique code that parents use to join an association within Track Master. Shared out-of-band by the admin. |
| **RLS** | Row-Level Security. A PostgreSQL feature used by Supabase to enforce data access rules at the database level. |
| **PIPEDA** | Personal Information Protection and Electronic Documents Act. Canada's federal privacy law. |
| **Proxy** | The Next.js 16 replacement for middleware. A server-side function that runs before route rendering, used here for session refresh. |
