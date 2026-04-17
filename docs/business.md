# Track Master -- Business Context

[Back to documentation hub](./index.md)

---

## Product Overview

Track Master is a hockey tryout tracker for parents who want to stay
informed about their friends' kids' tryout progress across Ontario hockey
associations. It replaces the fragmented mix of group texts, word-of-mouth,
and manually maintained spreadsheets that parents currently&nbsp;rely&nbsp;on.

The platform aggregates tryout data into a searchable, filterable,
mobile-friendly application that any parent can access with a
simple join&nbsp;code.

**Launch target:** 2-3 Ontario hockey associations, approximately
200 concurrent users.

**MVP timeline:** Under 4 weeks.

**Monetization:** Freemium model with no payments in the MVP phase. All
features are free at&nbsp;launch.

---

## Target Market

| Segment | Description | Size (Launch) | Primary Device |
|---------|-------------|---------------|----------------|
| Members (parents) | Parents following tryout results for their community | ~180 users | Mobile browser |
| Group Admins | Volunteer managers who publish tryout results | ~10-15 users | Desktop browser |
| Admins | Platform operators with site-level access | 1-2 users | Desktop browser |

The initial market is Ontario minor hockey associations. Parents access the
app at the rink on their phones. Group admins manage data on desktop
during longer administrative&nbsp;sessions.

---

## Three-Tier Role System

Roles are scoped per association via the `user_associations` table. A
single user can hold different roles in different associations (for
example, group admin in one and member&nbsp;in&nbsp;another).

| Role | Scope | Permissions |
|------|-------|-------------|
| **Admin** | Site-level | Full access to all associations. Can create associations, manage all users, view all audit logs, resolve platform-wide issues. |
| **Group Admin** | Association-level | Full read/write within their association: player CRUD, CSV imports, scraper configuration, correction review, member management, audit log viewing. |
| **Member** | Association-level | Read access to players and teams within their association. Can submit corrections. Can view their own correction history. |

Role enforcement operates at three layers:

1. **Database (RLS)** -- ground truth, enforced via `user_is_admin()` and
   `user_belongs_to_association()` SECURITY DEFINER helpers.
2. **Server layouts** -- `(admin)/layout.tsx` checks the role and redirects
   non-admins to the dashboard.
3. **proxy.ts** -- validates session only (not roles) and redirects
   unauthenticated users to&nbsp;the&nbsp;login.

---

## Key Workflows

### Player Status Tracking

The core workflow. Members view a filterable, searchable list of players
grouped by age division. Each player has exactly one status at any time.
Status changes are timestamped and appear in the&nbsp;audit&nbsp;log.

### Corrections

Members submit change requests when they notice inaccurate player data.
Corrections enter a "Pending" state and appear in the group admin's
review queue. On approval, a database trigger automatically applies the
correction to the player record. The correction status changes to
"Approved" and the change is logged in&nbsp;the&nbsp;audit.

### Web Scraping Import

Group admins configure CSS selectors and a target URL for their
association's tryout results page. The system fetches the HTML, parses it
with Cheerio, and presents a diff preview showing new players, changed
statuses, and unchanged records. The group admin reviews and confirms
before any data is&nbsp;written.

### CSV Import

Group admins upload a CSV file with columns for name, jersey number, age
division, and optionally team and status. The system validates the file,
detects duplicates by name + jersey number within the same division, and
shows a preview before committing. Errors are reported per&nbsp;row.

### Association Onboarding

A group admin creates an association, receives a unique join code, and
shares it with parents out-of-band. Parents enter the code on the "Join
Association" screen to gain member access. The join code can be
regenerated or disabled by&nbsp;the&nbsp;group&nbsp;admin.

---

## Player Status Lifecycle

Players progress through these statuses during the tryout season:

```
registered --> trying_out --> made_team
                  |
                  +--> cut
                  |
                  +--> moved_up
                  |
                  +--> moved_down
                  |
                  +--> withdrew
```

| Status | Description |
|--------|-------------|
| `registered` | Player is registered for tryouts but has not yet attended |
| `trying_out` | Player is actively participating in tryouts |
| `cut` | Player has been released from tryouts |
| `made_team` | Player has been assigned to a team roster |
| `moved_up` | Player moved to a higher division team |
| `moved_down` | Player moved to a lower division team |
| `withdrew` | Player voluntarily withdrew from tryouts |

---

## Association Model

Each association is a top-level tenant in the system. All data tables
reference an `association_id` foreign key for multi-tenant isolation.
Row-Level Security policies ensure that users can only access data for
associations they&nbsp;belong&nbsp;to.

Key attributes of an association:

- **Name and abbreviation** -- display identity
- **Join code** -- unique code for parent onboarding (can be regenerated)
- **Season end date** -- triggers the data purge countdown
- **Data purge date** -- computed as season end date + 90 days

---

## Privacy and PIPEDA Summary

Track Master collects and displays personal information about minors
(player names, jersey numbers, tryout statuses). The application must
comply with the Personal Information Protection and Electronic Documents
Act (PIPEDA) as it operates in Ontario,&nbsp;Canada.

### Data Minimization

Only the minimum data necessary is collected:

- **Collected:** name, jersey number, age division, team assignment,
  tryout status
- **Not collected:** date of birth, home address, parent contact
  information, photographs, school or medical information

No direct relationship between a player record and a user account exists.
Parents do not "claim" their children in the system. This is an
intentional design choice for&nbsp;data&nbsp;minimization.

### Consent Mechanism

Upon first access to player data within an association, the user must
acknowledge a consent dialog explaining that the system displays minors'
names, jersey numbers, and tryout statuses. Consent is recorded with a
timestamp in the `user_associations.consent_given_at` field. Users who do
not consent cannot view&nbsp;player&nbsp;data.

### Data Retention

- Player records are automatically purged 90 days after the group admin
  sets the season end date.
- A warning notification is sent to group admins 30 days before purge.
- Corrections and audit logs are cascade-deleted with player records.
- Association records and scraper configurations persist across seasons.
- Users can request account deletion from profile settings; data is
  removed within 30&nbsp;days.

### PIPEDA Principles Applied

| Principle | Implementation |
|-----------|---------------|
| Accountability | Platform admin is the designated responsible party |
| Identifying Purposes | Privacy notice states data is collected for tryout tracking |
| Consent | Consent dialog before accessing player data, recorded with timestamp |
| Limiting Collection | Only name, jersey number, division, team, status collected |
| Retention Limits | Automatic 90-day purge after season end |
| Safeguards | RLS, HTTPS, HttpOnly cookies, parameterized queries |
| Openness | Privacy notice accessible from every page via footer |
| Individual Access | Users can view their data and request account deletion |

---

## Domain Terminology

| Term | Definition |
|------|-----------|
| **Association** | A hockey organization that runs tryouts. Top-level tenant in the system. |
| **Division** | Age-based grouping (e.g., U11, U13, U15). |
| **Team** | A specific team within a division (e.g., U13 AA, U13 A). |
| **Tryout Status** | Player state: Registered, Trying Out, Cut, Made Team, Moved Up, Moved Down, Withdrew. |
| **Correction** | A change request from a parent, requiring group admin approval. |
| **Scraper Config** | Saved CSS selectors and URL for extracting player data from association websites. |
| **Join Code** | Short unique code parents use to join an association. |

For the complete product requirements, see the full
[PRD](./prd/PRD.md).
