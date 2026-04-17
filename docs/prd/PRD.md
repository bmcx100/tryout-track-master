# Track Master -- Product Requirements Document

**Version:** 1.0
**Date:** 2026-04-17
**Status:** Approved
**Author:** PRD Writer Agent
**Approved Modification:** Three-tier role system (Admin, Group Admin, Member)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Overview](#2-product-overview)
3. [User Personas](#3-user-personas)
4. [Functional Requirements](#4-functional-requirements)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [User Stories](#6-user-stories)
7. [Information Architecture](#7-information-architecture)
8. [Data Model](#8-data-model)
9. [Integration Points](#9-integration-points)
10. [Privacy and Compliance](#10-privacy-and-compliance)
11. [Constraints and Assumptions](#11-constraints-and-assumptions)
12. [Feature Prioritization](#12-feature-prioritization)
13. [Glossary](#13-glossary)

---

## 1. Executive Summary

### Product Vision

Track Master is a hockey tryout tracker for parents who want to stay informed about their friends' kids' tryout progress across Ontario hockey associations. It provides a centralized, up-to-date view of player statuses, team projections, and roster movements during the tryout season -- replacing the fragmented mix of group texts, word-of-mouth, and manually maintained spreadsheets that parents currently rely on.

### Target Users

Track Master serves three distinct user types:

- **Members** (parents) -- the primary consumers of tryout data, using the app on their phones at the rink to check statuses, search for specific players, and submit corrections when they notice inaccurate information.
- **Group Admins** (association managers) -- the data stewards who import player rosters, configure web scrapers, review correction requests, and manage the association's presence on the platform.
- **Admins** (platform administrators) -- site-level operators who manage all associations, resolve platform-wide issues, and maintain system health.

### Problem Statement

During hockey tryout season in Ontario, parents have no reliable, centralized source for tracking which players have been cut, which have made a team, and which are still trying out. Information spreads informally through social networks, leading to inaccuracies, delays, and anxiety. Association websites update sporadically, and the data is often buried in PDFs or poorly structured HTML pages. Track Master solves this by aggregating tryout data into a searchable, filterable, mobile-friendly application that any parent can access with a simple join code.

### Scale and Timeline

- **Launch target:** 2-3 Ontario hockey associations, approximately 200 users
- **MVP timeline:** Less than 4 weeks
- **Monetization:** Freemium model with no payments in MVP
- **Stack:** Next.js 16 + Supabase + Vercel (all free/hobby tier)

---

## 2. Product Overview

### 2.1 Vision and Mission

**Vision:** To be the go-to source of truth for hockey tryout results in Ontario, trusted by parents and association managers alike.

**Mission:** Provide a fast, mobile-friendly, privacy-conscious platform that lets parents track their community's tryout progress in real time, while giving association managers simple tools to keep data accurate and current.

### 2.2 Target Audience

| Segment | Description | Size (Launch) | Primary Device |
|---------|-------------|---------------|----------------|
| **Members (Parents)** | Parents of children in hockey tryouts who want to follow results for their friends' kids across the association. Tech-savvy enough to use a web app but expect a frictionless, mobile-first experience. | ~180 users | Mobile (iPhone/Android browser) |
| **Group Admins** | Volunteer managers or board members of hockey associations who are responsible for publishing tryout results. Comfortable with spreadsheets and basic web tools. | ~10-15 users | Desktop (Chrome/Edge) |
| **Admins** | Platform operators with site-level access. Manage all associations, troubleshoot issues, and ensure system integrity. | 1-2 users | Desktop |

### 2.3 Success Metrics (KPIs)

| Metric | Target (MVP) | Measurement Method |
|--------|-------------|-------------------|
| **User signups** | 200 within first tryout season | Supabase Auth user count |
| **Association onboarding** | 2-3 associations configured with data | Database association count |
| **Weekly active users** | 60% of registered users during tryout season | Analytics / Supabase auth activity |
| **Time to first value** | Under 2 minutes from signup to viewing player data | User testing |
| **Data freshness** | Player statuses updated within 24 hours of real-world changes | Admin-reported or scraper timestamps |
| **Correction turnaround** | 90% of corrections reviewed within 48 hours | Database query on correction timestamps |
| **Page load performance** | LCP under 2.5 seconds on 4G mobile | Vercel Analytics / Lighthouse |
| **User satisfaction** | Positive qualitative feedback from 5+ parents | Direct outreach / feedback form |

### 2.4 Known Gaps

All requirements blocks were completed during the planning phase. There are no known gaps in the functional or non-functional requirements at this time.

---

## 3. User Personas

### 3.1 The Member (Parent Persona)

**Name:** Sarah Chen
**Role:** Member
**Age:** 42
**Tech Comfort:** Moderate (uses iPhone daily, comfortable with web apps)
**Context:** Sarah has two kids in hockey -- one in U13, one in U15 -- at the Oakville Rangers minor hockey association. During tryout season, she is constantly checking with other parents to find out who made which team, who got cut, and where the remaining players might land.

**Goals:**
- Quickly check the tryout status of specific players (her kids' friends, teammates from last season)
- See projected team rosters to understand where her children might end up
- Get accurate, up-to-date information without relying on the rumor mill
- Submit corrections when she notices wrong information (e.g., a player marked as "Cut" who is actually still trying out)

**Frustrations:**
- Association websites are slow to update and hard to navigate on her phone
- Group chat information is often wrong or outdated
- She has to juggle two associations (one per child) and there is no single place to see both

**Usage Pattern:** Checks the app 3-5 times per day during tryout season, primarily on her iPhone at the rink or during downtime at work. Sessions are short (1-3 minutes).

### 3.2 The Group Admin Persona

**Name:** Mike Thompson
**Role:** Group Admin
**Age:** 50
**Tech Comfort:** High (manages association spreadsheets, comfortable with CSV files and basic web administration)
**Context:** Mike is a volunteer board member for the Burlington Eagles hockey association. He is responsible for publishing tryout results after each round of cuts. Currently, he updates a spreadsheet and emails it to parents, which is time-consuming and error-prone.

**Goals:**
- Import player rosters from CSV files at the start of tryout season
- Update player statuses in bulk after each tryout round
- Configure a web scraper to pull results directly from the association's website
- Review and approve corrections submitted by parents
- Share a simple join code with parents so they can access the data

**Frustrations:**
- Manually maintaining spreadsheets is tedious and error-prone
- Parents constantly message him asking for updates
- He has to communicate results through multiple channels (email, group chat, website)

**Usage Pattern:** Uses the app on his desktop 2-3 times per week during tryout season. Sessions are longer (15-30 minutes) when importing data or reviewing corrections.

### 3.3 The Admin Persona

**Name:** Dave Patel
**Role:** Admin (Platform Administrator)
**Age:** 35
**Tech Comfort:** Very high (software developer who built and maintains the platform)
**Context:** Dave is the creator and operator of Track Master. He manages the platform at the site level, ensuring all associations are running smoothly, troubleshooting issues, and monitoring system health.

**Goals:**
- Oversee all associations on the platform from a single administrative view
- Resolve platform-wide issues (e.g., broken scraper configs, data anomalies)
- Promote or demote users across any association when needed
- Monitor system usage, performance, and costs to stay within free-tier limits

**Frustrations:**
- Limited time to manage the platform (this is a side project)
- Needs to trust Group Admins to manage their own associations without constant oversight
- Must keep infrastructure costs near zero during the MVP phase

**Usage Pattern:** Checks the platform 1-2 times per week. Responds to issues as they arise. Sessions vary from quick checks (5 minutes) to deeper investigations (30+ minutes).

---

## 4. Functional Requirements

### 4.1 Authentication and User Management

| ID | Description | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-001 | The system shall allow users to sign up and sign in using email and password. | Must Have | User can register with email/password, receive a confirmation email, verify their account, and log in successfully. Session persists across page reloads. |
| FR-002 | The system shall allow users to sign in using Google OAuth. | Must Have | User can click "Sign in with Google," authenticate via Google's consent screen, and be redirected back to the app in an authenticated state. |
| FR-003 | The system shall allow users to sign out. | Must Have | User can sign out from any authenticated page. Session is destroyed on both client and server. User is redirected to the landing/login page. |
| FR-004 | The system shall allow users to reset their password via email. | Should Have | User receives a password reset email with a secure link. Clicking the link allows them to set a new password. The old password is invalidated. |
| FR-005 | The system shall maintain authenticated sessions across requests using Supabase session refresh in the Next.js 16 proxy layer. | Must Have | Sessions are refreshed transparently via proxy.ts using `getClaims()`. Users are not randomly logged out. Expired sessions redirect to the login page. |

### 4.2 Association Management

| ID | Description | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-006 | The system shall support multiple hockey associations as separate tenants. | Must Have | Each association has its own set of players, teams, and tryout data. Data from one association is never visible to users of another association (unless a user belongs to both). |
| FR-007 | The system shall allow users to join one or more associations by entering a join code or accepting an invitation. | Must Have | A user can enter a join code on a "Join Association" screen and be added as a member of that association. The join code is provided out-of-band by the group admin. |
| FR-008 | The system shall allow a group admin to create and configure a new association. | Must Have | A group admin can create an association with a name, abbreviation, and optional logo URL. A unique join code is generated automatically. |
| FR-009 | The system shall allow a group admin to manage the join code (regenerate or disable). | Should Have | Group admin can regenerate the join code (invalidating the old one) or disable joining entirely. |

### 4.3 Player Status Tracking

| ID | Description | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-010 | The system shall display a list of all players currently in tryouts for a given association, grouped by age division. | Must Have | Members see a filterable, searchable list of players showing: name, jersey number, age division, current tryout status, and last-updated timestamp. |
| FR-011 | The system shall track each player's tryout status with the following values: Registered, Trying Out, Cut, Made Team, Moved Up, Moved Down, Withdrew. | Must Have | Each player has exactly one status at any given time. Status transitions are recorded with a timestamp. The UI clearly distinguishes between active (Trying Out) and terminal (Cut, Made Team, Withdrew) statuses. |
| FR-012 | The system shall allow filtering players by status, age division, and team. | Must Have | Users can apply one or more filters simultaneously. The player list updates immediately. Filter state persists during the session. |
| FR-013 | The system shall allow searching players by name or jersey number. | Must Have | Search is case-insensitive and returns partial matches. Results update as the user types (debounced, not on every keystroke). |
| FR-014 | The system shall display a "last updated" timestamp on both the overall tryout data and each individual player record. | Should Have | Timestamps display in the user's local timezone. A relative format (e.g., "2 hours ago") is used alongside the absolute timestamp. |

### 4.4 Team Projection and Sorting

| ID | Description | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-015 | The system shall display projected team rosters based on the remaining players and available team slots. | Must Have | After cuts are applied, the system shows which teams still have open spots and which players are likely candidates. Projections are displayed per age division. |
| FR-016 | The system shall allow the group admin to define teams within an age division (e.g., U13 AA, U13 A, U13 BB). | Must Have | Group admin can create, rename, reorder, and archive teams. Each team has a name, a division, and a maximum roster size. |
| FR-017 | The system shall allow the group admin to assign or move players between projected teams. | Must Have | Group admin can drag-and-drop or select-and-assign players to teams. The system warns if a team would exceed its roster limit. |
| FR-018 | The system shall show a summary dashboard with counts of players by status per division and team. | Should Have | Dashboard shows total players, number trying out, number cut, number who made a team, and number of open spots per team -- all at a glance. |

### 4.5 Role System and Controls

| ID | Description | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-019 | The system shall support three roles: Admin (site-level), Group Admin (association-level), and Member (regular user). | Must Have | Admins have full read/write access to all associations and platform-level operations. Group Admins have full read/write access to their association's data. Members have read access plus the ability to submit corrections. Role is assigned per association for Group Admin and Member (a user can be a group admin in one association and a member in another). Admin is a site-level role. |
| FR-020 | The system shall allow group admins to import players via CSV upload. | Must Have | Group admin uploads a CSV file with columns: name, jersey number, age division, and optionally team/status. The system validates the file, shows a preview of rows to be imported, and reports any errors before committing. Duplicate detection is based on name + jersey number within the same division. |
| FR-021 | The system shall allow group admins to manually add, edit, and remove individual player records. | Must Have | Group admin can create a new player with name, jersey number, division, and initial status. Group admin can edit any field. Group admin can delete a player (soft delete with audit trail). |
| FR-022 | The system shall allow group admins to bulk-update player statuses (e.g., mark multiple players as Cut after a tryout round). | Should Have | Group admin selects multiple players via checkboxes, chooses a new status, and confirms. All selected players are updated atomically. |
| FR-023 | The system shall allow group admins to promote a member to group admin or demote a group admin to member within the association. Admins can manage roles across all associations. | Should Have | The last remaining group admin in an association cannot be demoted. Role changes take effect immediately. |
| FR-024 | The system shall log all group admin and admin actions (imports, edits, status changes, role changes) in an audit trail. | Should Have | Audit log records the user, action type, affected record(s), old/new values, and timestamp. The log is viewable by group admins (for their association) and admins (for all associations). |

### 4.6 User-Submitted Corrections

| ID | Description | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-025 | The system shall allow members to submit a correction request for any player record they believe is inaccurate. | Must Have | Member selects a player, indicates which field is wrong (status, team, jersey number), provides the corrected value and an optional note. The correction enters a "Pending" state. |
| FR-026 | The system shall display pending corrections to group admins in a review queue. | Must Have | Group admins see a badge/count of pending corrections. The queue shows the original value, proposed value, submitting user, and timestamp. Group admins can approve or reject each correction. |
| FR-027 | The system shall automatically apply approved corrections to the player record. | Must Have | When a group admin approves a correction, the player record is updated to the new value via a database trigger. The correction status changes to "Approved" and the change appears in the audit log. |
| FR-028 | The system shall notify the submitting user of the outcome of their correction (approved or rejected). | Nice to Have | The user sees a notification (in-app) indicating their correction was approved or rejected. If rejected, the group admin's reason (if provided) is shown. |
| FR-029 | The system shall prevent duplicate correction submissions for the same field on the same player while a correction is already pending. | Should Have | If a pending correction already exists for the same player and field, the system informs the user and prevents submission. |

### 4.7 Web Scraping Import

| ID | Description | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-030 | The system shall allow group admins to configure a web scraping source for their association's tryout results page. | Must Have | Group admin provides the URL and selects or configures CSS selectors for the data fields (player name, number, status). The configuration is saved and can be tested before running a full import. |
| FR-031 | The system shall support scraping static HTML pages using Cheerio (fetch + parse). | Must Have | The scraper can extract player data from standard HTML tables and lists on association websites. It handles common variations in markup structure. |
| FR-032 | The system shall support scraping JavaScript-rendered pages as a fallback using a headless browser. | Nice to Have | For sites that require JavaScript execution to render data, the system uses Puppeteer-core with @sparticuz/chromium-min in a serverless function. |
| FR-033 | The system shall allow group admins to run a scrape on demand and preview the results before importing. | Must Have | Group admin clicks "Scrape Now," the system fetches and parses the page, and displays a preview showing new players, status changes, and any parsing warnings. Group admin confirms before data is written. |
| FR-034 | The system shall detect and highlight changes between the scraped data and existing records. | Should Have | The preview differentiates between new players (not in the system), updated players (status changed), and unchanged players. Only changes are imported on confirmation. |
| FR-035 | The system shall store scraper configurations (selectors, URL patterns) in the database, keyed by association. | Must Have | Each association can have one or more scraper configs. Configs include: URL, CSS selectors for name/number/status/team, and a label. Configs are editable by group admins. |

### 4.8 Navigation and UI

| ID | Description | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-036 | The system shall provide a mobile-first responsive layout for member-facing screens. | Must Have | All member-facing pages (player list, team projections, correction submission) are fully usable on a 375px-wide screen. Touch targets meet minimum 44x44px. |
| FR-037 | The system shall provide a desktop-optimized layout for group admin and admin dashboard screens. | Must Have | Group admin and admin screens (player management, import, corrections queue, scraper config) use a wider layout with side navigation. They remain functional on mobile but are designed for desktop use. |
| FR-038 | The system shall provide a landing page that explains the product and directs users to sign up or log in. | Must Have | Landing page is publicly accessible. It describes the value proposition, shows a call to action, and links to login/signup. It is the default route for unauthenticated users. |
| FR-039 | The system shall provide an association selector for users who belong to multiple associations. | Should Have | After login, if a user belongs to multiple associations, they see a selector. The chosen association is persisted in the session/URL. Users can switch associations from the main navigation. |

---

## 5. Non-Functional Requirements

### 5.1 Performance

| ID | Description | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| NFR-001 | Pages shall achieve a Largest Contentful Paint (LCP) of under 2.5 seconds on a 4G mobile connection. | Must Have | Measured via Lighthouse or Web Vitals in the field. Server-side rendering and static generation are used where appropriate. |
| NFR-002 | The player list shall render up to 500 players without perceptible lag or jank. | Must Have | List renders within 200ms on a mid-range mobile device. Virtualized scrolling is used if the list exceeds the viewport. |
| NFR-003 | Search and filter operations shall return results within 300ms. | Must Have | Filtering is performed client-side on cached data for lists under 500 players. Server-side filtering is available as a fallback. |
| NFR-004 | Web scraping operations shall complete within 60 seconds for static HTML sites. | Should Have | A timeout is enforced. If the scrape exceeds the timeout, the user is informed and can retry. Progress indication is shown during the operation. |
| NFR-005 | API response times for standard CRUD operations shall be under 500ms at the 95th percentile. | Should Have | Measured via Supabase dashboard or application logging. |

### 5.2 Security

| ID | Description | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| NFR-006 | All data access shall be controlled by Supabase Row-Level Security (RLS) policies. | Must Have | No table is accessible without an RLS policy. Policies enforce that users can only access data for associations they belong to. Direct database access without authentication returns zero rows. |
| NFR-007 | Group-admin-only and admin-only operations shall be enforced at the database level, not just the UI. | Must Have | RLS policies and/or SECURITY DEFINER functions verify the user's role before allowing write operations. Bypassing the UI (e.g., direct API calls) does not grant unauthorized access. |
| NFR-008 | Authentication tokens shall be stored in secure, HttpOnly cookies managed by @supabase/ssr. | Must Have | No auth tokens are stored in localStorage or exposed to client-side JavaScript. Cookie attributes include Secure, SameSite=Lax, and appropriate Path/Domain. |
| NFR-009 | The system shall use PKCE (Proof Key for Code Exchange) flow for all OAuth authentication. | Must Have | Verified by inspecting the Supabase auth configuration. PKCE is the default for SSR in @supabase/ssr. |
| NFR-010 | All user inputs shall be sanitized to prevent XSS and SQL injection attacks. | Must Have | Parameterized queries are used for all database operations (Supabase client handles this). React's built-in XSS protection is relied upon for rendering. Any raw HTML rendering (if needed for scraped content preview) uses a sanitization library. |
| NFR-011 | The system shall enforce HTTPS for all connections. | Must Have | Vercel enforces HTTPS by default. HTTP requests are redirected to HTTPS. |

### 5.3 Privacy and Compliance

| ID | Description | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| NFR-012 | The system shall display a privacy notice explaining what data is collected, why, and how it is used. | Must Have | Privacy notice is accessible from the signup page and the footer of every page. It is written in plain language. |
| NFR-013 | The system shall implement a parental consent mechanism before collecting or displaying data about minor players. | Must Have | Upon first access to player data, the user must acknowledge that they consent to the collection and display of minors' names, jersey numbers, and tryout statuses. Consent is recorded with a timestamp. |
| NFR-014 | The system shall practice data minimization by collecting only name, jersey number, age division, team, and tryout status for players. | Must Have | No additional personal information (date of birth, address, parent contact info, photos) is collected or stored for players. |
| NFR-015 | The system shall automatically purge player data 90 days after the end of the tryout season. | Must Have | A scheduled process (Supabase cron or Edge Function) deletes or anonymizes player data 90 days after the group admin marks the season as complete. Group admins receive a warning 30 days before purge. Users are informed of the retention policy in the privacy notice. |
| NFR-016 | The system shall allow any user to request deletion of their account and associated data. | Should Have | Users can initiate account deletion from their profile settings. The system removes their user record, role assignments, and correction submissions within 30 days. |

### 5.4 Scalability

| ID | Description | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| NFR-017 | The system shall support up to 200 concurrent users at launch without degradation. | Must Have | Load tested with 200 simulated users performing typical read operations. P95 response time remains under 1 second. |
| NFR-018 | The system shall support scaling to a few thousand users within 12 months without architectural changes. | Should Have | The multi-tenant data model, RLS policies, and Supabase infrastructure can handle 5,000 users across 20 associations. Indexes are in place for common query patterns. |
| NFR-019 | The database schema shall support adding new associations without schema changes. | Must Have | All tenant-specific data is isolated via association_id foreign keys. No hardcoded association references exist in the schema. |

### 5.5 Availability

| ID | Description | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| NFR-020 | The system shall target 99.5% uptime, measured monthly. | Must Have | Uptime is dependent on Vercel and Supabase SLAs. Monitoring is configured to alert on downtime (e.g., via Vercel's built-in monitoring or a free uptime checker). |
| NFR-021 | The system shall handle Supabase or Vercel outages gracefully with user-facing error messages. | Should Have | When backend services are unavailable, users see a friendly error page rather than a blank screen or stack trace. Cached data is displayed where possible. |

### 5.6 Usability

| ID | Description | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| NFR-022 | The system shall be accessible to WCAG 2.1 Level AA standards. | Should Have | All interactive elements are keyboard-navigable. Color contrast ratios meet AA thresholds. Screen reader users can navigate the player list and submit corrections. shadcn/ui components (built on Radix primitives) provide baseline accessibility. |
| NFR-023 | The system shall support light and dark modes. | Nice to Have | Theme respects the user's OS preference by default. Users can override the theme manually. Theme preference is persisted. |
| NFR-024 | The system shall provide clear loading states and error messages for all asynchronous operations. | Must Have | Skeleton loaders or spinners are shown during data fetching. Error states display actionable messages (e.g., "Failed to load players. Tap to retry."). Empty states explain why no data is shown (e.g., "No players have been added yet."). |
| NFR-025 | A new member shall be able to sign up, join an association, and view the player list within 2 minutes. | Should Have | Measured by user testing. The onboarding flow has no more than 3 screens between signup and viewing data. |

---

## 6. User Stories

### 6.1 Member (Parent)

| ID | User Story | Related FRs |
|----|-----------|-------------|
| US-001 | As a member, I want to sign up with my Google account, so that I can get started quickly without creating a new password. | FR-002, FR-005 |
| US-002 | As a member, I want to join my child's hockey association using a code shared by the group admin, so that I can see tryout results for that association. | FR-007 |
| US-003 | As a member, I want to see a list of all players in tryouts for my association, so that I can find out who is still trying out and who has been cut. | FR-010, FR-011 |
| US-004 | As a member, I want to search for a specific player by name or jersey number, so that I can quickly check on my friends' kids without scrolling through the entire list. | FR-013 |
| US-005 | As a member, I want to filter players by tryout status (e.g., show only "Cut" or "Made Team"), so that I can focus on the information most relevant to me. | FR-012 |
| US-006 | As a member, I want to see projected team rosters, so that I can get a sense of which team my child will likely end up on and who their teammates might be. | FR-015 |
| US-007 | As a member, I want to submit a correction if I notice incorrect information about a player, so that the data stays accurate for everyone. | FR-025 |
| US-008 | As a member, I want to know when my correction has been reviewed, so that I can see if the information was updated or understand why it was rejected. | FR-028 |
| US-009 | As a member, I want to see when the tryout data was last updated, so that I know how current the information is. | FR-014 |
| US-010 | As a member, I want to use the app comfortably on my phone while at the rink, so that I don't need to bring a laptop or squint at a tiny desktop layout. | FR-036 |
| US-011 | As a member, I want to belong to multiple associations (e.g., one for each of my children), so that I can track tryouts across organizations from a single account. | FR-006, FR-039 |

### 6.2 Group Admin

| ID | User Story | Related FRs |
|----|-----------|-------------|
| US-012 | As a group admin, I want to create a new association and get a join code, so that I can invite members from my hockey community. | FR-008 |
| US-013 | As a group admin, I want to import a CSV of players with their names, numbers, and divisions, so that I can quickly populate the system at the start of tryouts. | FR-020 |
| US-014 | As a group admin, I want to configure a web scraper for my association's tryout results page, so that I can pull results directly from the source instead of entering them manually. | FR-030, FR-035 |
| US-015 | As a group admin, I want to run a scrape on demand and preview the changes before importing, so that I can verify the data is correct and avoid overwriting good information with bad parses. | FR-033, FR-034 |
| US-016 | As a group admin, I want to update player statuses in bulk after a tryout round, so that I can efficiently process a batch of cuts or team assignments. | FR-022 |
| US-017 | As a group admin, I want to define the teams in each age division and their roster limits, so that team projections are accurate. | FR-016 |
| US-018 | As a group admin, I want to assign players to projected teams, so that members can see where the remaining players are likely to land. | FR-017 |
| US-019 | As a group admin, I want to review and approve or reject corrections submitted by members, so that I maintain control over data accuracy while benefiting from community input. | FR-026, FR-027 |
| US-020 | As a group admin, I want to see an audit trail of all data changes, so that I can track who changed what and when, and revert mistakes if needed. | FR-024 |
| US-021 | As a group admin, I want to manage the association's join code, so that I can control who has access and regenerate it if it's shared too widely. | FR-009 |
| US-022 | As a group admin, I want a dashboard showing player counts by status and division, so that I can get a quick overview of where tryouts stand. | FR-018 |
| US-023 | As a group admin, I want to use the admin dashboard on my desktop with a spacious layout, so that I can manage large data sets efficiently. | FR-037 |

### 6.3 Admin (Platform Administrator)

| ID | User Story | Related FRs |
|----|-----------|-------------|
| US-028 | As an admin, I want to view and manage all associations on the platform, so that I can ensure system-wide health and resolve issues. | FR-006, FR-019 |
| US-029 | As an admin, I want to promote or demote users across any association, so that I can intervene when a group admin is unavailable or unresponsive. | FR-023 |
| US-030 | As an admin, I want to view audit logs across all associations, so that I can investigate platform-wide issues and data anomalies. | FR-024 |

### 6.4 System

| ID | User Story | Related FRs/NFRs |
|----|-----------|-----------------|
| US-024 | As the system, I want to automatically apply approved corrections via a database trigger, so that the group admin approval workflow is seamless and atomic. | FR-027 |
| US-025 | As the system, I want to purge player data 90 days after season end, so that we comply with data minimization principles and PIPEDA best practices. | NFR-015 |
| US-026 | As the system, I want to enforce data access boundaries via RLS policies, so that a user in Association A can never see data from Association B. | NFR-006, NFR-007 |
| US-027 | As the system, I want to refresh user sessions transparently in the proxy layer, so that users are not randomly logged out during normal usage. | FR-005 |

---

## 7. Information Architecture

### 7.1 Sitemap

```
Track Master
|
|-- / (Landing Page) [Public]
|-- /login [Public]
|-- /signup [Public]
|-- /auth/callback [Public, Route Handler]
|-- /auth/auth-code-error [Public]
|
|-- /dashboard [Authenticated - All Roles]
|-- /players [Authenticated - All Roles]
|   |-- /players/[playerId] [Authenticated - All Roles]
|-- /teams [Authenticated - All Roles]
|-- /corrections [Authenticated - All Roles] (My Corrections)
|-- /join [Authenticated - All Roles]
|-- /settings [Authenticated - All Roles]
|-- /logout [Authenticated - Server Component]
|
|-- /admin [Group Admin + Admin]
|   |-- /admin/players [Group Admin + Admin]
|   |   |-- /admin/players/import [Group Admin + Admin]
|   |-- /admin/teams [Group Admin + Admin]
|   |-- /admin/corrections [Group Admin + Admin]
|   |-- /admin/scraper [Group Admin + Admin]
|   |-- /admin/members [Group Admin + Admin]
|   |-- /admin/audit [Group Admin + Admin]
|   |-- /admin/association [Group Admin + Admin]
|
|-- /platform [Admin Only]
|   |-- /platform/associations [Admin Only]
|   |-- /platform/users [Admin Only]
|   |-- /platform/audit [Admin Only]
```

### 7.2 Navigation Structure

**Member Navigation (Mobile-First):**
- Bottom navigation bar with 4 tabs: Dashboard, Players, Teams, More
- "More" expands to: My Corrections, Join Association, Settings, Sign Out
- Association switcher in the header (if user belongs to multiple associations)

**Group Admin Navigation (Desktop-Optimized):**
- Left sidebar with sections:
  - Overview: Dashboard
  - Data: Players, Teams, Import, Scraper
  - Review: Corrections Queue, Audit Log
  - Settings: Members, Association, Join Code
- Same member-facing pages accessible via top navigation

**Admin Navigation (Desktop-Optimized):**
- All Group Admin navigation plus a "Platform" section:
  - Platform: All Associations, All Users, Platform Audit Log

### 7.3 Page Access Matrix

| Page | Member | Group Admin | Admin |
|------|--------|-------------|-------|
| Landing / Login / Signup | Yes | Yes | Yes |
| Dashboard | Yes (own association) | Yes (own association) | Yes (any association) |
| Player List | Read | Read + Write | Read + Write |
| Player Detail | Read + Submit Correction | Read + Edit | Read + Edit |
| Team Projections | Read | Read + Manage | Read + Manage |
| My Corrections | Own corrections | Own corrections | Own corrections |
| Admin Dashboard | No | Yes | Yes |
| Player Management | No | Yes (own association) | Yes (any association) |
| CSV Import | No | Yes | Yes |
| Correction Queue | No | Yes (own association) | Yes (any association) |
| Scraper Config | No | Yes (own association) | Yes (any association) |
| Member Management | No | Yes (own association) | Yes (any association) |
| Audit Log | No | Yes (own association) | Yes (all associations) |
| Association Settings | No | Yes (own association) | Yes (any association) |
| Platform Management | No | No | Yes |

---

## 8. Data Model

### 8.1 Entity-Relationship Overview

The data model is multi-tenant, with `association_id` as the primary isolation boundary. All data tables reference an association, and Row-Level Security policies enforce that users can only access data for associations they belong to.

The full entity-relationship diagram is maintained in a separate document: [ER.md](./ER.md).

### 8.2 Key Entities

| Entity | Description | Key Fields |
|--------|-------------|------------|
| **auth.users** | Supabase-managed user accounts. Stores email, display name, and authentication metadata. | `id` (uuid), `email` |
| **associations** | Hockey associations (tenants). Each association has its own players, teams, and configuration. | `id`, `name`, `abbreviation`, `logo_url`, `join_code`, `join_enabled`, `season_end_date`, `data_purge_date` |
| **user_associations** | Many-to-many join between users and associations. Stores the user's role within each association. | `user_id` (FK), `association_id` (FK), `role` (app_role), `joined_at`, `consent_given_at` |
| **teams** | Teams within an age division of an association (e.g., U13 AA, U13 A). | `id`, `association_id` (FK), `division`, `name`, `display_order`, `max_roster_size`, `is_archived` |
| **tryout_players** | Individual players in the tryout process. The core data entity. | `id`, `association_id` (FK), `name`, `jersey_number`, `division`, `team_id` (FK, nullable), `status` (player_status), `status_updated_at`, `deleted_at` (soft delete) |
| **corrections** | Change requests submitted by members to fix inaccurate player data. | `id`, `player_id` (FK), `user_id` (FK), `association_id` (FK), `field_name`, `old_value`, `new_value`, `note`, `status` (correction_status), `reviewed_by` (FK), `reviewed_at` |
| **scraper_configs** | Per-association web scraper configurations (URL, CSS selectors, status mappings). | `id`, `association_id` (FK), `label`, `url`, `selectors` (JSONB), `last_scraped_at` |
| **audit_log** | Immutable log of all data-changing operations. Written by database triggers. | `id`, `association_id` (FK), `user_id` (FK), `action`, `target_table`, `target_id`, `old_values` (JSONB), `new_values` (JSONB), `created_at` |

### 8.3 PostgreSQL Enums

```sql
-- Player tryout status progression
CREATE TYPE player_status AS ENUM (
  'registered',
  'trying_out',
  'cut',
  'made_team',
  'moved_up',
  'moved_down',
  'withdrew'
)

-- Three-tier role system
CREATE TYPE app_role AS ENUM (
  'admin',        -- Site-level platform administrator
  'group_admin',  -- Association-level manager
  'member'        -- Regular user (parent)
)

-- Correction request lifecycle
CREATE TYPE correction_status AS ENUM (
  'pending',
  'approved',
  'rejected'
)
```

### 8.4 Role System Details

The `app_role` enum defines three tiers of access:

| Role | Scope | Capabilities |
|------|-------|-------------|
| **admin** | Platform-wide (site-level) | Full access to all associations. Can manage all users, view all audit logs, resolve platform-wide issues. Not tied to a specific association -- operates across the entire platform. |
| **group_admin** | Single association | Full read/write access to their association's data: import players, manage teams, review corrections, configure scrapers, manage members, view audit logs. Can promote members to group_admin or demote group_admins to member within their association. |
| **member** | Single association | Read access to player lists and team projections. Can submit corrections. Can view their own correction history. Cannot access admin screens or modify data directly. |

A single user can hold different roles in different associations. For example, a user could be a `group_admin` for the Oakville Rangers and a `member` for the Burlington Eagles. The `admin` role is special: it grants site-level access regardless of individual association memberships.

### 8.5 Data Retention Policies

| Data Type | Retention Period | Purge Mechanism |
|-----------|-----------------|-----------------|
| Player records (tryout_players) | Until 90 days after season end date | Supabase cron job or Edge Function runs daily, deletes records where `association.data_purge_date <= NOW()`. A warning notification is sent to group admins 30 days before purge. |
| Corrections | Purged with associated player records | Cascade delete on player_id FK. |
| Audit log | Purged with association season data | Deleted alongside player records at purge time. |
| User accounts | Until user requests deletion | Manual process or self-service deletion from profile settings. Account data removed within 30 days of request. |
| Scraper configs | Persistent (not season-specific) | Retained across seasons. Group admin can delete manually. |
| Association records | Persistent | Retained indefinitely. Only the seasonal player data is purged. |

---

## 9. Integration Points

### 9.1 Supabase

| Component | Usage |
|-----------|-------|
| **PostgreSQL** | Primary database. Hosts all application tables with RLS enabled. |
| **Auth** | User authentication via email/password and Google OAuth. PKCE flow. Session management via JWT. |
| **Row-Level Security** | Multi-tenant data isolation. SECURITY DEFINER helper functions for role checks. |
| **Edge Functions** | Scheduled data purge (90-day retention) and purge warning notifications. |
| **Cron (pg_cron)** | Triggers Edge Functions on a daily schedule. |
| **Client Libraries** | `@supabase/ssr` for server/proxy/browser client creation. `@supabase/supabase-js` as the underlying client. |

### 9.2 Vercel

| Component | Usage |
|-----------|-------|
| **Hosting** | Serves the Next.js 16 application. Hobby tier. |
| **Serverless Functions** | API routes for scraping (`/api/scrape`) and CSV import (`/api/import`). 300-second timeout. |
| **Edge Network** | CDN for static assets. Automatic HTTPS. Gzip/Brotli compression. |
| **Preview Deployments** | Auto-deploy from pull request branches for testing. |
| **Analytics** | Built-in Web Vitals monitoring (LCP, CLS, FID/INP). |

### 9.3 Web Scraping

| Component | Usage |
|-----------|-------|
| **Cheerio** | Primary scraping engine. Fetches and parses static HTML pages using configured CSS selectors. Lightweight (~200KB). |
| **Puppeteer-core + @sparticuz/chromium-min** | Fallback (Nice to Have) for JavaScript-rendered sites. Serverless-compatible headless browser. |
| **Scraper Configs** | Per-association configuration stored in the database: URL, CSS selectors for player data fields, status text mapping. |
| **Diff Engine** | Compares scraped data against existing database records. Categorizes results as new, changed, or unchanged. |

### 9.4 Google OAuth

| Component | Usage |
|-----------|-------|
| **Provider** | Google is the sole OAuth provider. Configured in the Supabase Auth dashboard. |
| **Flow** | PKCE flow via `@supabase/ssr`. Redirect URI: `/auth/callback`. |
| **Scope** | Default scopes (email, profile). No additional Google API access required. |
| **Prompt** | `select_account` -- forces account selection even if only one Google account is signed in. |

### 9.5 Authentication Flows

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

---

## 10. Privacy and Compliance

### 10.1 PIPEDA Considerations

Track Master collects and displays personal information about minors (player names, jersey numbers, tryout statuses) in the context of community hockey organizations in Ontario, Canada. The application must comply with the Personal Information Protection and Electronic Documents Act (PIPEDA).

**Key principles applied:**

| PIPEDA Principle | Application in Track Master |
|-----------------|---------------------------|
| **Accountability** | A designated individual (the platform admin) is responsible for the organization's compliance. Privacy notice identifies the responsible party. |
| **Identifying Purposes** | The privacy notice clearly states that player data is collected to provide tryout status tracking to community members. |
| **Consent** | Users must acknowledge a consent dialog before accessing player data. Consent is recorded with a timestamp per user per association. |
| **Limiting Collection** | Only name, jersey number, division, team, and status are collected. No dates of birth, addresses, photos, or contact information. |
| **Limiting Use, Disclosure, and Retention** | Data is used solely for tryout tracking. Data is automatically purged 90 days after season end. No data is shared with third parties. |
| **Accuracy** | The correction workflow allows community members to flag inaccurate data. Group admins review and approve corrections. |
| **Safeguards** | RLS policies, HTTPS, HttpOnly cookies, parameterized queries, and role-based access controls protect the data. |
| **Openness** | The privacy notice is accessible from every page via the footer. It is written in plain language. |
| **Individual Access** | Users can view their own data (corrections, membership). Account deletion is available via settings. |
| **Challenging Compliance** | Users can contact the platform admin with privacy concerns. Contact information is provided in the privacy notice. |

### 10.2 Data Minimization

Player records intentionally contain only the minimum data necessary for the application's purpose:

- **Collected:** Name, jersey number, age division, team assignment, tryout status
- **Not collected:** Date of birth, home address, parent/guardian contact information, photographs, school information, medical information

Players are minors. No direct relationship between a player record and a user account exists. Parents do not "claim" their own children in the system. This is an intentional design choice for data minimization -- the system does not know or store which parent is related to which player.

### 10.3 Consent Mechanism

- Upon first access to player data within an association, the user must acknowledge a consent dialog.
- The consent dialog explains that the system displays minors' names, jersey numbers, and tryout statuses.
- Consent is recorded in the `user_associations.consent_given_at` field with a timestamp.
- Users who do not consent cannot view player data.
- The consent dialog links to the full privacy notice.

### 10.4 Data Purge Policy

- Group admins set a `season_end_date` for their association.
- The system computes `data_purge_date` as `season_end_date + 90 days`.
- A daily cron job (Supabase Edge Function) checks for associations where `data_purge_date <= NOW()`.
- 30 days before the purge date, group admins receive an in-app warning.
- On the purge date, all player records, associated corrections, and audit logs for that season are permanently deleted.
- Association records and scraper configurations are retained across seasons.

### 10.5 User Account Deletion

- Users can request account deletion from their profile settings (FR-016).
- Upon request, the system removes the user's account, all role assignments, and all correction submissions within 30 days.
- Audit log entries referencing the deleted user are retained but anonymized (user_id set to null or a placeholder).

---

## 11. Constraints and Assumptions

### 11.1 Technical Constraints

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

### 11.2 Business Constraints

| ID | Constraint |
|----|-----------|
| BC-001 | **Solo developer.** One developer building and maintaining the entire system. Architecture and tooling choices must minimize complexity and operational burden. |
| BC-002 | **Less than 4-week MVP timeline.** The MVP must be functional within 4 weeks. Feature scope must be aggressively managed. "Nice to Have" features are explicitly deferred. |
| BC-003 | **Budget under $500/month.** Infrastructure costs must stay within hobby/free tier limits. No paid third-party services unless absolutely necessary. |
| BC-004 | **Freemium model with no payments in MVP.** There is no paywall, subscription, or payment processing in the MVP. All features are free. Monetization strategy is deferred. |
| BC-005 | **Ontario, Canada is the launch market.** Initial associations are in Ontario. The app must work for Canadian users but does not need to support internationalization or localization beyond English. |

### 11.3 Key Assumptions

| ID | Assumption | Risk if Invalid |
|----|-----------|-----------------|
| KA-001 | Hockey association websites publish tryout results as static HTML pages that can be parsed with Cheerio. | If sites are heavily JavaScript-rendered or use anti-scraping measures, the Puppeteer fallback (Nice to Have) becomes a Must Have, adding complexity and cost. |
| KA-002 | Group admins will actively manage the system (importing players, reviewing corrections, configuring scrapers). | If group admins are not engaged, data becomes stale, and members lose trust in the platform. Mitigation: make group admin workflows as frictionless as possible. |
| KA-003 | A join code is a sufficient access control mechanism for MVP. | If join codes are shared publicly, unauthorized users could view minor player data. Mitigation: codes can be regenerated; consider adding email-domain restrictions post-MVP. |
| KA-004 | 200 users at launch will not exceed Supabase or Vercel free tier limits. | If usage spikes unexpectedly (viral growth in a hockey community), the system may hit rate limits. Mitigation: monitor usage dashboards; upgrade to paid tier if needed. |
| KA-005 | Collecting player names and jersey numbers is acceptable under PIPEDA for a community-use application, provided consent and privacy notices are in place. | If a privacy complaint is filed, additional safeguards (e.g., anonymization, stricter access controls) may be required. Mitigation: consult with a privacy professional before public launch. |
| KA-006 | Parents will organically adopt the app if one or two "connector" parents in each association share the join code. | If adoption is low, the network effect doesn't materialize and the app provides little value over group texts. Mitigation: make the app useful even for a single user tracking their own child's tryout journey. |
| KA-007 | The @supabase/ssr package and Next.js 16 proxy pattern are stable and production-ready. | If breaking changes are introduced in either dependency, auth flows may break. Mitigation: pin dependency versions; monitor changelogs. |
| KA-008 | Supabase Realtime subscriptions are not required for MVP. Event-driven updates (user refreshes the page or pulls to refresh) are sufficient. | If parents expect live-updating data without refreshing, satisfaction may be lower. Mitigation: add Realtime subscriptions as a fast-follow post-MVP enhancement. |

---

## 12. Feature Prioritization

### 12.1 Must Have (MVP Core)

These features are required for the MVP to be functional and valuable. All must be completed within the 4-week timeline.

| Category | Features | Count |
|----------|----------|-------|
| **Authentication** | Email/password signup and login, Google OAuth, session management via proxy.ts, sign out | 4 |
| **Association Management** | Multi-tenant support, join via code, association creation | 3 |
| **Player Tracking** | Player list with search/filter, status tracking (7 statuses), grouped by division | 3 |
| **Team Projections** | Projected rosters, team definition, player-to-team assignment | 3 |
| **Role System** | Three-tier roles (admin, group_admin, member), role-based access control | 2 |
| **Data Management** | CSV import with preview, manual CRUD for players | 2 |
| **Corrections** | Submit corrections (member), review queue (group admin), auto-apply on approval | 3 |
| **Web Scraping** | Scraper config, Cheerio-based scraping, scrape preview before import, config storage | 4 |
| **UI/UX** | Mobile-first member layout, desktop-optimized group admin layout, landing page | 3 |
| **Security** | RLS on all tables, database-level role enforcement, HttpOnly cookies, PKCE, input sanitization, HTTPS | 6 |
| **Privacy** | Privacy notice, parental consent mechanism, data minimization, 90-day purge | 4 |
| **Performance** | LCP under 2.5s, 500-player list rendering, sub-300ms search, loading states | 4 |
| **Scalability** | 200 concurrent users, schema-independent association scaling | 2 |
| **Availability** | 99.5% uptime target | 1 |
| | | **Total: 44** |

### 12.2 Should Have

Important features that enhance the MVP but are not blockers for launch. Implement as time permits within the 4-week timeline.

| Feature | ID | Rationale |
|---------|----|-----------|
| Password reset via email | FR-004 | Users will forget passwords. Low effort. |
| Join code management (regenerate/disable) | FR-009 | Security hygiene for group admins. |
| Last-updated timestamps (relative + absolute) | FR-014 | Builds trust in data freshness. |
| Dashboard summary (counts by status/division) | FR-018 | Quick overview for group admins. |
| Bulk status updates | FR-022 | Major time-saver after tryout rounds. |
| Role promotion/demotion within association | FR-023 | Group admin succession planning. |
| Audit trail | FR-024 | Accountability and debugging. |
| Duplicate correction prevention | FR-029 | Prevents queue noise. |
| Scrape diff highlighting | FR-034 | Prevents bad data imports. |
| Association selector (multi-association users) | FR-039 | Essential for users with multiple children. |
| Account deletion | NFR-016 | PIPEDA compliance enhancement. |
| Graceful outage handling | NFR-021 | User experience during downtime. |
| WCAG 2.1 AA accessibility | NFR-022 | Inclusivity. |
| Two-minute onboarding target | NFR-025 | Adoption metric. |

### 12.3 Nice to Have

Features that would be good to have but are explicitly deferred unless time permits after all Must Have and Should Have items are complete.

| Feature | ID | Rationale |
|---------|----|-----------|
| Correction outcome notifications (in-app) | FR-028 | Enhances member experience but not critical for MVP data flow. |
| JavaScript-rendered site scraping (Puppeteer) | FR-032 | Fallback for edge cases. Most Ontario hockey sites are static HTML. |
| Light/dark mode toggle | NFR-023 | Polish feature. OS preference respected by default via Tailwind. |

### 12.4 Post-MVP Features (Explicitly Out of Scope)

The following features are acknowledged as valuable but are intentionally excluded from the MVP to meet the 4-week timeline and solo developer constraint.

- Push notifications (mobile web push)
- Email notifications when results are updated
- Historical data from past seasons
- Native mobile app (iOS and Android)
- Chat/messaging between parents
- Scheduled/automatic scraping (cron-based)
- Payment processing and premium tiers
- Multi-language support (French, etc.)
- Supabase Realtime subscriptions for live data updates
- PWA (Progressive Web App) service worker and offline support
- Player statistics and analytics
- Integration with hockey registration systems (e.g., HCR)

---

## 13. Glossary

| Term | Definition |
|------|-----------|
| **Admin** | A site-level platform administrator with access to all associations and system-wide management capabilities. The `admin` value in the `app_role` enum. |
| **Association** | A hockey organization (e.g., a minor hockey association) that runs tryouts. The top-level tenant in the system. Each association has its own players, teams, and configuration. |
| **Correction** | A change request submitted by a member to fix inaccurate player data. Corrections enter a "Pending" state and must be approved or rejected by a group admin. |
| **Division** | An age-based grouping of players (e.g., U11, U13, U15). Divisions are properties of players and teams, not standalone entities. |
| **Group Admin** | An association-level manager who has full read/write access to their association's data. Responsible for importing players, reviewing corrections, configuring scrapers, and managing members. The `group_admin` value in the `app_role` enum. |
| **Join Code** | A short, unique code that members use to join an association within Track Master. Shared out-of-band by the group admin (e.g., via email or group chat). |
| **Member** | A regular user (typically a parent) who has read access to player data and can submit corrections. The `member` value in the `app_role` enum. |
| **PIPEDA** | Personal Information Protection and Electronic Documents Act. Canada's federal privacy law governing the collection, use, and disclosure of personal information in the course of commercial activity. |
| **Player Status** | The current state of a player in the tryout process. One of: Registered, Trying Out, Cut, Made Team, Moved Up, Moved Down, Withdrew. |
| **Proxy** | The Next.js 16 replacement for middleware. A server-side function (`proxy.ts`) that runs before route rendering, used here for session refresh via `getClaims()`. |
| **RLS** | Row-Level Security. A PostgreSQL feature used by Supabase to enforce data access rules at the database level. Ensures users can only access data for associations they belong to. |
| **RSC** | React Server Components. Components that render on the server and send HTML to the client. Used for data fetching and layout rendering. |
| **Scraper Config** | A saved configuration of CSS selectors, URL, and status text mappings for extracting player data from an association's website. Stored in the `scraper_configs` table. |
| **Team** | A specific team within a division (e.g., U13 AA, U13 A). Teams have names, roster limits, and display order. |
| **Tryout Status** | See "Player Status." |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-04-17 | PRD Writer Agent | Initial PRD. Three-tier role system (admin, group_admin, member) applied throughout. Consolidated from requirements.md and architecture.md. |
