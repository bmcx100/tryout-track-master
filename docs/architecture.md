# Track Master -- Architecture Overview

[Back to documentation hub](./index.md)

> **Full document:** For the complete architecture specification including
> detailed diagrams, ER models, RLS policies, deployment configuration,
> and all ADRs, see [docs/prd/ARCHITECTURE.md](./prd/ARCHITECTURE.md).

---

## System Architecture Summary

Track Master is a server-rendered Next.js 16 application backed by
Supabase (PostgreSQL with Row-Level Security). The application is
deployed on Vercel with auto-deploy from the `main` branch. Supabase
provides the database, authentication, Edge Functions, and
cron&nbsp;scheduling.

```
Clients (Mobile / Desktop browsers)
        |
        v
Vercel Edge Network
   proxy.ts (session refresh via getClaims)
        |
        v
Next.js 16 App Router
   Server Components (data fetching)
   Client Components (interactivity)
   API Routes (/api/scrape, /api/import)
        |
        v
Supabase
   PostgreSQL (RLS on all tables)
   Auth (Google OAuth, email/password, PKCE)
   Edge Functions (data purge cron)
        ^
        | (scraping only)
External Hockey Association Websites
```

---

## Data Flow Paths

| Path | Flow |
|------|------|
| **Read (member)** | Browser --> proxy.ts (session refresh) --> RSC page --> Supabase query (RLS filtered) --> streamed HTML |
| **Write (group admin)** | Browser --> Client Component form --> Server Action or API Route --> Supabase mutation (RLS + role check) --> audit trigger --> response |
| **Scrape** | Group admin triggers --> `/api/scrape` --> fetch external URL --> Cheerio parse --> diff preview --> group admin confirms --> upsert to DB |
| **Auth** | Browser --> Supabase OAuth/email --> `/auth/callback` --> `exchangeCodeForSession()` --> session cookie set --> proxy.ts refreshes on subsequent requests |

---

## Multi-Tenant Isolation

Every data table has an `association_id` foreign key. RLS policies use
SECURITY DEFINER helper functions to verify that the authenticated user
has a `user_associations` record for the requested association. Direct
database access without authentication returns&nbsp;zero&nbsp;rows.

Key helper functions:

- `user_belongs_to_association(assoc_id)` -- membership check
- `user_is_group_admin(assoc_id)` -- association-level admin check
- `user_is_group_admin_or_admin(assoc_id)` -- combined check
- `user_is_admin()` -- site-level admin check

---

## Authentication Architecture

| Aspect | Implementation |
|--------|---------------|
| Token storage | HttpOnly, Secure, SameSite=Lax cookies via `@supabase/ssr` |
| Token refresh | Automatic in `proxy.ts` via `getClaims()` (local JWT validation, no network call) |
| Session creation | `exchangeCodeForSession()` in `/auth/callback` for OAuth and email confirmation |
| Session destruction | `signOut()` in the `/logout` server component |
| Client access | `createBrowserClient()` from `@supabase/ssr` |
| Server access | `createServerClient()` with async `cookies()` (Next.js 16 requirement) |

---

## Role Enforcement Layers

| Layer | Mechanism | Purpose |
|-------|-----------|---------|
| Database (RLS) | SECURITY DEFINER helper functions in RLS policies | Ground truth; cannot be bypassed |
| Proxy (proxy.ts) | Session validation via `getClaims()` | Gate unauthenticated requests |
| Server Components | Query `user_associations` to determine role | UX-level conditional rendering |
| Route Group Layouts | `(admin)/layout.tsx` checks role, redirects members | Navigation guard backed by RLS |
| API Routes | Session + role check before executing logic | Defense in depth |

---

## Key Architectural Decisions

| ADR | Decision |
|-----|----------|
| ADR-001 | Server Components for data fetching, Client Components for interactivity |
| ADR-002 | `proxy.ts` with `getClaims()` for session management (replaces middleware.ts) |
| ADR-003 | Multi-tenant isolation via `association_id` and RLS |
| ADR-004 | Cheerio for web scraping with configurable CSS selectors per association |
| ADR-005 | Server Actions for CRUD mutations, API Routes for file uploads and scraping |
| ADR-006 | Client-side filtering with server-fetched data for player lists (up to 500 players) |
| ADR-007 | Monorepo with logical separation (frontend / backend / infrastructure) |
| ADR-008 | Three-tier role system (Admin, Group Admin, Member) replacing original two-tier model |

For full rationale and consequences, see the
[ADR section in ARCHITECTURE.md](./prd/ARCHITECTURE.md#9-architectural-decision-records-adrs).

---

## Performance Strategy

| Metric | Target |
|--------|--------|
| LCP | Under 2.5s on 4G mobile |
| FID / INP | Under 200ms |
| CLS | Under 0.1 |
| Client JS bundle | Under 150KB gzipped |
| Player list render (500 items) | Under 200ms |
| Search result update | Under 300ms |
| API response (P95) | Under 500ms |

Caching uses Vercel Edge Cache for static assets, Next.js Data Cache with
`cacheTag()` for dynamic data, and client-side React state for filtered
player lists. Cache invalidation is triggered by `revalidateTag()` on
mutations with tags like `players-{associationId}`
and&nbsp;`teams-{associationId}`.
