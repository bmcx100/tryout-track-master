# Project Architecture

**Description:** Enforces the architectural patterns and structural conventions for Track Master. Ensures consistent use of Server/Client Components, route groups, data-fetching strategies, Supabase client patterns, and monorepo directory layout.

**Trigger:** Use this skill when:
- Creating new pages or route handlers
- Adding or reorganizing components
- Choosing between Server Actions and API Routes
- Creating or modifying Supabase client utilities
- Restructuring files or directories

---

## Enforcement Rules

### 1. Server Components for Data Fetching, Client Components for Interactivity

Follow the React Server Components (RSC) pattern strictly. The boundary between server and client is intentional and must not be blurred.

**Server Components (default, no directive):**
- Page-level data fetching from Supabase
- Layout shells and static content rendering
- Auth checks and redirects
- Passing fetched data as props to client children

**Client Components (`"use client"` directive):**
- Interactive UI: search inputs, filter controls, forms
- State management: `useState`, `useReducer`, `useEffect`
- Browser APIs: `localStorage`, `window`, event listeners
- Third-party client-only libraries

**Correct:**
```tsx
// app/(app)/players/page.tsx -- Server Component
import { createClient } from "@/lib/supabase/server"
import { PlayerList } from "@/components/players/player-list"

export default async function PlayersPage() {
  const supabase = await createClient()
  const { data: players } = await supabase
    .from("tryout_players")
    .select("*")

  return <PlayerList players={players ?? []} />
}
```

```tsx
// components/players/player-list.tsx -- Client Component
"use client"

import { useState } from "react"

export function PlayerList({ players }: { players: Player[] }) {
  const [search, setSearch] = useState("")
  // Interactive filtering logic
}
```

**Incorrect:**
```tsx
// app/(app)/players/page.tsx -- WRONG: fetching data in a client component
"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export default function PlayersPage() {
  const [players, setPlayers] = useState([])
  useEffect(() => {
    // Client-side fetch creates a waterfall
    createClient().from("tryout_players").select("*").then(...)
  }, [])
}
```

---

### 2. Route Group Structure

The app uses three route groups to organize pages by access level. Every page must be placed in the correct group.

```
app/
  (public)/        # Unauthenticated pages (landing, login, signup)
    layout.tsx     # Minimal layout, no nav bar
  (app)/           # Authenticated pages for all users (parents + admins)
    layout.tsx     # App shell with header, nav, association context
  (admin)/         # Admin-only pages
    layout.tsx     # Admin layout with sidebar navigation
```

**Route group rules:**

| Group | Auth Required | Role Required | Layout |
|-------|--------------|---------------|--------|
| `(public)` | No | None | Minimal (no nav) |
| `(app)` | Yes | Any authenticated user | App shell (header, mobile nav, footer) |
| `(admin)` | Yes | `admin` or `group_admin` | Admin shell (sidebar + header) |

**Auth callback and logout** live outside route groups at `app/auth/` and `app/logout/`.

**Correct:**
```
app/(public)/login/page.tsx        # Public login page
app/(app)/players/page.tsx         # Authenticated player list
app/(admin)/admin/players/page.tsx # Admin player management
```

**Incorrect:**
```
app/login/page.tsx                 # Not in a route group
app/(admin)/players/page.tsx       # Parent-accessible page in admin group
app/(public)/admin/page.tsx        # Admin page in public group
```

---

### 3. Server Actions for CRUD, API Routes for Uploads/Scraping

Choose the right server-side pattern based on the operation type.

**Use Server Actions (`"use server"`) for:**
- Standard CRUD operations (create, read, update, delete players/teams/corrections)
- Form submissions (login, signup, correction submission)
- Role changes and association management
- Any operation that is a direct database mutation triggered by a form or button

**Use API Routes (`app/api/*/route.ts`) for:**
- File uploads (CSV import) that need streaming or `FormData`
- Web scraping operations that may be long-running
- Operations that return non-HTML responses (JSON previews, file downloads)
- Webhook endpoints

**Correct:**
```ts
// app/(admin)/admin/players/actions.ts
"use server"

export async function createPlayer(formData: FormData) {
  const supabase = await createClient()
  // Insert player into database
}
```

```ts
// app/api/scrape/route.ts
export async function POST(request: Request) {
  // Long-running scraping operation
  // Returns JSON preview data
}
```

**Incorrect:**
```ts
// app/api/players/create/route.ts -- WRONG: simple CRUD belongs in Server Actions
export async function POST(request: Request) {
  const body = await request.json()
  // This should be a Server Action, not an API route
}
```

---

### 4. Supabase Client Patterns

The project uses four distinct Supabase client factories. Each has a specific use case. Never mix them.

| Client | File | Use Case | Cookie API |
|--------|------|----------|------------|
| **Browser** | `lib/supabase/client.ts` | Client Components | Automatic (browser cookies) |
| **Server** | `lib/supabase/server.ts` | Server Components, Server Actions | `getAll()`/`setAll()` via `cookies()` |
| **Proxy** | `lib/supabase/proxy.ts` | `proxy.ts` session refresh | `getAll()`/`setAll()` via request/response |
| **Admin** | `lib/supabase/admin.ts` | Service-role operations (scraping, imports) | None (uses `SUPABASE_SERVICE_ROLE_KEY`) |

**Correct usage by context:**

```ts
// Client Component
"use client"
import { createClient } from "@/lib/supabase/client"
const supabase = createClient()

// Server Component or Server Action
import { createClient } from "@/lib/supabase/server"
const supabase = await createClient()

// proxy.ts
import { updateSession } from "@/lib/supabase/proxy"
export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

// API Route doing admin operations
import { createAdminClient } from "@/lib/supabase/admin"
const supabase = createAdminClient()
```

**Incorrect:**
```ts
// Server Component using browser client -- WRONG
import { createClient } from "@/lib/supabase/client"

// Client Component using server client -- WRONG (can't access cookies())
import { createClient } from "@/lib/supabase/server"

// proxy.ts using server client -- WRONG (different cookie handling)
import { createClient } from "@/lib/supabase/server"
```

---

### 5. Component Organization by Domain

Components are organized by feature domain under `components/`. Shared/generic components go in `components/shared/`. Auto-generated shadcn/ui components stay in `components/ui/`.

```
components/
  ui/               # shadcn/ui auto-generated (do not manually edit)
  layout/           # App shell components (header, sidebar, footer, nav)
  players/          # Player-related components
  teams/            # Team-related components
  corrections/      # Correction workflow components
  scraper/          # Scraper configuration and preview components
  import/           # CSV import components
  dashboard/        # Dashboard widgets
  auth/             # Login, signup, OAuth, consent components
  shared/           # Reusable generic components (empty states, errors, dialogs)
```

**Rules:**
- A component belongs to the domain it primarily serves
- If a component is used by two or more domains, move it to `shared/`
- Never create a `components/pages/` directory -- page-level components live in `app/`
- Name component files with kebab-case: `player-card.tsx`, not `PlayerCard.tsx`

---

### 6. Monorepo Directory Structure

The project uses a monorepo layout with three top-level directories.

```
track-master/
  frontend/          # Next.js application (app/, components/, lib/, public/)
  backend/           # Supabase configuration (migrations, seed, edge functions)
  infrastructure/    # CI/CD workflows, Vercel config
  docs/              # Project documentation
  CLAUDE.md          # Claude Code instructions
```

**Rules:**
- All Next.js code (pages, components, libs, API routes) lives under `frontend/`
- All SQL migrations live under `backend/supabase/migrations/`
- Supabase Edge Functions live under `backend/supabase/functions/`
- GitHub Actions workflows live under `infrastructure/.github/workflows/`
- The `@/*` path alias maps to `frontend/` in `tsconfig.json`
- Environment variables are documented in `backend/.env.local.example`
- Never place backend code (SQL, Edge Functions) inside `frontend/`
- Never place frontend code (React components, pages) inside `backend/`

---

## Architecture Decision Quick Reference

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Rendering | RSC-first with client islands | Minimize JS bundle, faster initial load |
| Auth session | proxy.ts with getClaims() | Next.js 16 pattern, replaces deprecated middleware.ts |
| Data fetching | Server Components + Supabase queries | No client-side waterfalls, RLS enforced |
| Mutations | Server Actions (CRUD), API Routes (files/scraping) | Server Actions colocate with forms, API routes for non-form operations |
| State management | React state + URL params | No external state library needed at MVP scale |
| Styling | Tailwind CSS v4 with @apply extraction | Per coding standards, maintainable class management |
| Component library | shadcn/ui (New York) | Accessible Radix primitives, RSC-compatible |
| Multi-tenancy | association_id FK + RLS | Database-level isolation, no application-level filtering needed |
