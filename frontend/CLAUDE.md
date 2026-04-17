# Frontend CLAUDE.md

Guidance for Claude Code when working in the `frontend/` directory of Track Master.

## Commands

```bash
npm run dev          # Start dev server on port 3000
npm run build        # Production build
npm start            # Start production server
npm run lint         # ESLint (Next.js TypeScript + core web vitals)
npx tsc --noEmit     # Type check without emitting
```

All commands run from this directory (`frontend/`).

## Component Organization

Components are organized by domain, not by type:

```
components/
|-- ui/              # shadcn/ui primitives (auto-generated, do not edit manually)
|-- layout/          # App shell: header, sidebar, mobile nav, footer, association switcher
|-- players/         # Player list, card, filters, search, status badge, form, bulk toolbar
|-- teams/           # Team projection, card, form, roster list
|-- corrections/     # Correction form (parent), review queue (admin), card
|-- scraper/         # Scraper config form, preview, progress indicator
|-- import/          # CSV upload, import preview table
|-- dashboard/       # Stats cards, division summary
|-- auth/            # Login form, signup form, OAuth buttons, consent dialog
|-- shared/          # Empty state, error message, loading skeleton, confirm dialog, timestamp
```

When creating a new component, place it in the appropriate domain folder. Create a new domain folder only if the component does not fit any existing category.

## Server vs Client Component Guidelines

| Use Server Component (RSC) when... | Use Client Component (`'use client'`) when... |
|-------------------------------------|-----------------------------------------------|
| Fetching data from Supabase | Handling user input (forms, search, filters) |
| Rendering static page content | Using `useState`, `useEffect`, or browser APIs |
| Checking auth/role on the server | Drag-and-drop interactions |
| Displaying dashboard statistics | File uploads |
| Reading from cookies or headers | Real-time UI updates |

**Pattern:** Fetch data in a Server Component page, pass it as props to Client Component children. This avoids client-side waterfalls.

```typescript
// app/(app)/players/page.tsx -- Server Component (no directive needed)
import { createClient } from "@/lib/supabase/server"
import { PlayerList } from "@/components/players/player-list"

export default async function PlayersPage() {
  const supabase = await createClient()
  const { data: players } = await supabase
    .from("tryout_players")
    .select("*")
    .is("deleted_at", null)

  return <PlayerList players={players ?? []} />
}
```

```typescript
// components/players/player-list.tsx -- Client Component
"use client"

import { useState } from "react"
import type { TryoutPlayer } from "@/types"

export function PlayerList({ players }: { players: TryoutPlayer[] }) {
  const [search, setSearch] = useState("")
  // ... interactive filtering logic
}
```

## shadcn/ui Usage

Add components:
```bash
npx shadcn@latest add button card dialog table select
```

Components land in `components/ui/`. They use:
- `class-variance-authority` for variant props
- `radix-ui` for accessible primitives
- `cn()` from `@/lib/utils` for class merging

Do not manually edit files in `components/ui/` unless customizing behavior. Prefer wrapping over modifying.

## Supabase Client Patterns

Four client factories in `lib/supabase/`:

| File | Use In | Purpose |
|------|--------|---------|
| `client.ts` | Client Components | `createBrowserClient()` -- reads cookies for session |
| `server.ts` | Server Components, Server Actions, Route Handlers | `createServerClient()` with async `cookies()` |
| `proxy.ts` | `proxy.ts` only | `updateSession()` -- session refresh via `getClaims()` |
| `admin.ts` | API Routes (scraping, imports) | Service role client -- bypasses RLS, NEVER expose to client |

**Rules:**
- Never import `@supabase/supabase-js` `createClient` directly. Always use the wrappers.
- Server client requires `await cookies()` (Next.js 16 async cookies).
- Service role client (`admin.ts`) is for server-side operations that need to bypass RLS (e.g., scraping imports). Never use in components.

## Auth Flow Implementation

### proxy.ts (root of frontend/)

```typescript
import { updateSession } from "@/lib/supabase/proxy"
import type { NextRequest } from "next/server"

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images/).*)",
  ],
}
```

### getClaims() Usage

In `lib/supabase/proxy.ts`, use `getClaims()` for JWT validation. Never use `getUser()` or `getSession()` in the proxy -- they make network calls on every request.

### Server Actions for Mutations

```typescript
"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidateTag } from "next/cache"

export async function updatePlayerStatus(playerId: string, status: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("tryout_players")
    .update({ status, status_updated_at: new Date().toISOString() })
    .eq("id", playerId)

  if (error) throw new Error(error.message)
  revalidateTag("players")
}
```

## Route Groups

```
app/
|-- (public)/     # Unauthenticated: landing, login, signup (no nav shell)
|-- (app)/        # Authenticated parents: dashboard, players, teams, corrections, join, settings
|-- (admin)/      # Admin-only: player CRUD, imports, scraper, corrections queue, audit, members
|-- auth/         # Auth callback and error routes
|-- api/          # REST endpoints for scraping and CSV import
```

- `(public)/layout.tsx` -- Minimal layout, no nav
- `(app)/layout.tsx` -- App shell with header, association context, mobile nav
- `(admin)/layout.tsx` -- Admin shell with sidebar nav. Checks admin role on server, redirects non-admins to `/dashboard`

## Form Handling

Use Server Actions for standard CRUD mutations. Use API Routes (`app/api/`) only for:
- Multipart form data (CSV upload)
- Long-running processes (scraping)
- Operations that return preview data before committing

For form validation, use Zod schemas defined in `lib/validators.ts`.

## Tailwind @apply Convention

Never apply more than one Tailwind class directly in JSX. Extract multi-class styles:

```css
/* In the component's CSS or globals.css */
.player-card {
  @apply rounded-lg border bg-card p-4 shadow-sm;
}

.status-badge {
  @apply inline-flex items-center rounded-full px-2 py-1 text-xs font-medium;
}
```

```tsx
/* In JSX -- single class or custom class only */
<div className="player-card">
  <span className="status-badge">Trying Out</span>
</div>
```

## Coding Standards

- **No semicolons** in TypeScript or JavaScript files.
- **No hanging words.** Use `text-wrap: balance`, `&nbsp;`, or manual `<br />` to prevent widows/orphans.
- **Images** go in `public/images/` with subfolders by category (e.g., `public/images/branding/`).
- **Path alias:** `@/*` maps to the `frontend/` root.
- **Git branching:** Use `git switch -c branch-name`, not `git checkout -b`.
- **Minimal dependencies.** Avoid adding packages when native APIs or existing deps suffice.

## Reference

- Read `docs/architecture.md` for the full component hierarchy, ER diagram, and ADRs.
- Read `docs/requirements.md` for user stories and acceptance criteria.
- Consult `/home/data/Documents/webapps/documentation/nextjs-16-proxy.md` before changing proxy or auth code.
- Consult `/home/data/Documents/webapps/documentation/supabase-auth-nextjs-examples.md` before changing Supabase auth flows.
