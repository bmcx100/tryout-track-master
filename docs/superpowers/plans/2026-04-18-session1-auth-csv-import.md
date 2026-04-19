# Session 1: Auth Fix + CSV Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the disabled auth flow so unauthenticated users are redirected to login, create seed data for development, and build the CSV import page so group admins can load player data into the database.

**Architecture:** Re-enable the commented-out auth redirect in `proxy.ts` and the auth check in `(app)/layout.tsx`. Create a new `admin/` route group with role-gated layout. Build CSV import as a client-side file reader + preview table + server action insert. No external CSV library needed — the format is simple (name, jersey, division, status, previous_team).

**Tech Stack:** Next.js 16.1.6, React 19, TypeScript 5, Supabase (`@supabase/ssr`), Tailwind CSS v4

**IMPORTANT:** Before modifying any auth or proxy code, read these reference docs:
- `/home/data/Documents/webapps/documentation/nextjs-16-proxy.md`
- `/home/data/Documents/webapps/documentation/supabase-auth-nextjs-examples.md`

**Coding standards (from CLAUDE.md):**
- No semicolons in TypeScript/JavaScript
- No more than 1 Tailwind class directly in JSX — extract multi-class styles to `globals.css` using `@apply`
- No hanging words (widows/orphans)
- Path alias: `@/*` maps to `frontend/` root
- Use `git switch -c` not `git checkout`

---

## File Structure

```
frontend/
├── lib/
│   ├── supabase/
│   │   └── admin.ts                    # CREATE: Service role client (bypasses RLS)
│   └── auth.ts                         # CREATE: Shared auth helpers (requireAuth, requireAssociation, requireAdmin)
├── app/
│   ├── (app)/
│   │   └── layout.tsx                  # MODIFY: Re-enable auth check
│   ├── admin/
│   │   ├── layout.tsx                  # CREATE: Admin layout with role check
│   │   └── import/
│   │       ├── page.tsx                # CREATE: CSV import page (server component)
│   │       └── actions.ts             # CREATE: Server action to insert players
│   └── globals.css                     # MODIFY: Add admin + import CSS classes
├── components/
│   └── import/
│       ├── csv-upload.tsx              # CREATE: File picker + CSV parser
│       └── import-preview.tsx          # CREATE: Preview table + confirm button
├── lib/
│   └── supabase/
│       └── proxy.ts                    # MODIFY: Re-enable auth redirect
backend/
└── supabase/
    └── seed.sql                        # CREATE: Dev seed data (association, teams, test user)
```

---

## Task 1: Re-enable Proxy Auth Redirect

**Files:**
- Modify: `frontend/lib/supabase/proxy.ts:36-48`

The auth redirect is commented out with a TODO. Re-enable it, allowing public paths through.

- [ ] **Step 1: Uncomment and fix the redirect block**

Replace the commented-out block in `frontend/lib/supabase/proxy.ts` (lines 36-48) with:

```typescript
  if (
    !user &&
    request.nextUrl.pathname !== "/" &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/signup") &&
    !request.nextUrl.pathname.startsWith("/auth")
  ) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }
```

The full file should now read:

```typescript
import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
          Object.entries(headers).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value)
          )
        },
      },
    }
  )

  // Do not run code between createServerClient and getClaims().
  const { data } = await supabase.auth.getClaims()

  const user = data?.claims

  if (
    !user &&
    request.nextUrl.pathname !== "/" &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/signup") &&
    !request.nextUrl.pathname.startsWith("/auth")
  ) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
```

- [ ] **Step 2: Verify — start dev server and test redirect**

```bash
cd frontend && npm run dev
```

1. Open `http://localhost:3000/dashboard` in an incognito window (no session)
2. Expected: redirected to `/login`
3. Open `http://localhost:3000/` — Expected: landing page loads (no redirect)
4. Open `http://localhost:3000/login` — Expected: login page loads (no redirect)

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/supabase/proxy.ts
git commit -m "fix: re-enable proxy auth redirect for unauthenticated users"
```

---

## Task 2: Re-enable App Layout Auth Check

**Files:**
- Modify: `frontend/app/(app)/layout.tsx`

The auth check is commented out with a TODO. Re-enable it so all `(app)` routes require a logged-in user.

- [ ] **Step 1: Uncomment and implement the auth check**

Replace the full contents of `frontend/app/(app)/layout.tsx` with:

```tsx
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { BottomNav } from "@/components/layout/bottom-nav"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  return (
    <div className="app-shell">
      {children}
      <BottomNav />
    </div>
  )
}
```

- [ ] **Step 2: Verify — auth check works**

1. In incognito, go to `http://localhost:3000/dashboard` — Expected: redirected to `/login`
2. Log in with valid credentials — Expected: reach `/dashboard`
3. Go to `http://localhost:3000/teams` — Expected: page loads (user is authenticated)

- [ ] **Step 3: Commit**

```bash
git add frontend/app/\(app\)/layout.tsx
git commit -m "fix: re-enable auth check in app layout"
```

---

## Task 3: Create Shared Auth Helpers

**Files:**
- Create: `frontend/lib/auth.ts`

Centralized functions that server components use to check auth and resolve the user's association. Avoids duplicating Supabase queries across every page.

- [ ] **Step 1: Create the auth helpers file**

Create `frontend/lib/auth.ts`:

```typescript
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export async function requireAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  return { supabase, user }
}

export async function requireAssociation() {
  const { supabase, user } = await requireAuth()

  const { data: memberships } = await supabase
    .from("user_associations")
    .select("association_id, role, associations(id, name, abbreviation)")
    .eq("user_id", user.id)

  if (!memberships || memberships.length === 0) {
    redirect("/join")
  }

  const active = memberships[0]

  return {
    supabase,
    user,
    associationId: active.association_id,
    role: active.role,
    association: active.associations as { id: string, name: string, abbreviation: string },
  }
}

export async function requireAdmin() {
  const result = await requireAssociation()

  if (result.role !== "group_admin" && result.role !== "admin") {
    redirect("/dashboard")
  }

  return result
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/lib/auth.ts
git commit -m "feat: add shared auth helper functions"
```

---

## Task 4: Create Development Seed Data

**Files:**
- Create: `backend/supabase/seed.sql`

Seed data creates one association with teams so the CSV import has somewhere to put players. **Note:** The test user's `auth.users` record is created by signing up through the app. The seed only creates the association and teams. After signup, you manually insert a `user_associations` row via the Supabase dashboard SQL editor to make yourself a group_admin.

- [ ] **Step 1: Create seed.sql**

Create `backend/supabase/seed.sql`:

```sql
-- ============================================================
-- Development Seed Data
-- Run via: cd backend && supabase db reset
-- ============================================================

-- Association: Oakville Rangers Minor Hockey
INSERT INTO associations (id, name, abbreviation, join_code, join_enabled)
VALUES (
  'a1000000-0000-0000-0000-000000000001',
  'Oakville Rangers Minor Hockey',
  'ORMH',
  'ORMH2026',
  true
);

-- Teams for U13 division
INSERT INTO teams (id, association_id, division, name, display_order, max_roster_size) VALUES
  ('t1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'U13', 'AA',  1, 17),
  ('t1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'U13', 'A',   2, 17),
  ('t1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 'U13', 'BB',  3, 17),
  ('t1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001', 'U13', 'B',   4, 17);

-- Teams for U11 division
INSERT INTO teams (id, association_id, division, name, display_order, max_roster_size) VALUES
  ('t1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000001', 'U11', 'AA',  1, 17),
  ('t1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000001', 'U11', 'A',   2, 17),
  ('t1000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000001', 'U11', 'BB',  3, 17),
  ('t1000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000001', 'U11', 'B',   4, 17);

-- Teams for U15 division
INSERT INTO teams (id, association_id, division, name, display_order, max_roster_size) VALUES
  ('t1000000-0000-0000-0000-000000000009', 'a1000000-0000-0000-0000-000000000001', 'U15', 'AA',  1, 17),
  ('t1000000-0000-0000-0000-000000000010', 'a1000000-0000-0000-0000-000000000001', 'U15', 'A',   2, 17);

-- ============================================================
-- After signup, run this in Supabase SQL editor to make yourself admin:
--
-- INSERT INTO user_associations (user_id, association_id, role)
-- VALUES ('<your-user-uuid>', 'a1000000-0000-0000-0000-000000000001', 'group_admin');
-- ============================================================
```

- [ ] **Step 2: Create a test CSV file for import testing**

Create `backend/test-data/sample-players.csv`:

```csv
name,jersey_number,division,status,previous_team
Noah Williams,7,U13,trying_out,U13AA
Liam Johnson,14,U13,trying_out,U13AA
Ethan Brown,19,U13,trying_out,U13AA
Mason Davis,4,U13,trying_out,U13AA
Lucas Wilson,22,U13,trying_out,U11AA
Oliver Taylor,9,U13,trying_out,U11AA
James Anderson,15,U13,trying_out,U13A
Benjamin Thomas,33,U13,trying_out,U13A
Alexander Jackson,11,U13,trying_out,
William White,8,U13,registered,
Henry Harris,27,U13,registered,
Sebastian Martin,3,U13,registered,U11A
Aiden Lewis,6,U11,trying_out,U9AA
Jackson Lee,17,U11,trying_out,U9AA
Logan Walker,23,U11,trying_out,U9A
Carter Hall,2,U11,registered,
Jayden Allen,29,U11,registered,
Dylan Young,13,U11,registered,
```

- [ ] **Step 3: Commit**

```bash
mkdir -p backend/test-data
git add backend/supabase/seed.sql backend/test-data/sample-players.csv
git commit -m "feat: add development seed data and test CSV"
```

---

## Task 5: Create Admin Layout with Role Check

**Files:**
- Create: `frontend/app/admin/layout.tsx`

The admin layout checks that the user has `group_admin` or `admin` role. Non-admins are redirected to `/dashboard`.

- [ ] **Step 1: Create the admin layout**

Create `frontend/app/admin/layout.tsx`:

```tsx
import { requireAdmin } from "@/lib/auth"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { association } = await requireAdmin()

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <span className="admin-header-label">{association.abbreviation} Admin</span>
      </header>
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Add admin CSS classes to globals.css**

Add these classes to the end of `frontend/app/globals.css` (before the closing of the file):

```css
/* ── Admin Shell ─────────────────────────────────────── */

.admin-shell {
  @apply min-h-screen;
  background: var(--dm-parchment);
  color: var(--dm-umber);
}

.admin-header {
  @apply flex items-center justify-between px-4 py-3;
  background: var(--dm-umber);
  color: var(--dm-parchment);
}

.admin-header-label {
  @apply text-sm tracking-wider uppercase;
  font-family: var(--font-ibm-plex-mono);
  color: var(--dm-gold);
}

/* ── CSV Import ──────────────────────────────────────── */

.import-page {
  @apply px-4 py-6;
}

.import-page-title {
  @apply text-xl font-semibold mb-1;
}

.import-page-desc {
  @apply text-sm mb-6;
  color: var(--dm-dust);
}

.csv-upload-zone {
  @apply flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-colors;
  border-color: var(--dm-dust);
}

.csv-upload-zone:hover {
  border-color: var(--dm-gold);
  background: var(--dm-dune);
}

.csv-upload-zone-active {
  border-color: var(--dm-gold);
  background: var(--dm-dune);
}

.csv-upload-icon {
  @apply mb-2;
  color: var(--dm-dust);
}

.csv-upload-label {
  @apply text-sm font-medium;
}

.csv-upload-hint {
  @apply text-xs mt-1;
  color: var(--dm-dust);
}

.import-preview-table {
  @apply w-full text-sm mt-6;
  border-collapse: collapse;
}

.import-preview-table th {
  @apply px-3 py-2 text-left text-xs uppercase tracking-wider;
  font-family: var(--font-ibm-plex-mono);
  color: var(--dm-dust);
  background: var(--dm-dune);
}

.import-preview-table td {
  @apply px-3 py-2;
  border-bottom: 1px solid var(--dm-dune);
}

.import-preview-table tr:hover td {
  background: var(--dm-dune);
}

.import-error-row td {
  background: oklch(0.95 0.05 25);
}

.import-summary {
  @apply flex items-center justify-between mt-4 px-1;
}

.import-summary-text {
  @apply text-sm;
  color: var(--dm-dust);
}

.import-error-text {
  @apply text-sm font-medium;
  color: var(--dm-cinnabar);
}

.import-actions {
  @apply flex gap-3 mt-4;
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/app/admin/layout.tsx frontend/app/globals.css
git commit -m "feat: add admin layout with role check and import CSS"
```

---

## Task 6: Build CSV Upload Component

**Files:**
- Create: `frontend/components/import/csv-upload.tsx`

Client component that renders a file drop zone, reads the CSV file, parses it into structured rows, and calls back with the parsed data. No external CSV library — uses native string parsing.

- [ ] **Step 1: Create the CSV upload component**

Create `frontend/components/import/csv-upload.tsx`:

```tsx
"use client"

import { useCallback, useRef, useState } from "react"
import { Upload } from "lucide-react"

export type ParsedPlayer = {
  name: string
  jersey_number: string
  division: string
  status: string
  previous_team: string
  error?: string
}

type CsvUploadProps = {
  onParsed: (rows: ParsedPlayer[]) => void
}

const VALID_STATUSES = [
  "registered",
  "trying_out",
  "cut",
  "made_team",
  "moved_up",
  "moved_down",
  "withdrew",
]

function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ",") {
        fields.push(current.trim())
        current = ""
      } else {
        current += char
      }
    }
  }
  fields.push(current.trim())
  return fields
}

function validateRow(row: ParsedPlayer): ParsedPlayer {
  const errors: string[] = []
  if (!row.name) errors.push("name is required")
  if (!row.jersey_number) errors.push("jersey_number is required")
  if (!row.division) errors.push("division is required")
  if (row.status && !VALID_STATUSES.includes(row.status)) {
    errors.push(`invalid status: ${row.status}`)
  }
  return {
    ...row,
    status: row.status || "registered",
    error: errors.length > 0 ? errors.join(", ") : undefined,
  }
}

export function CsvUpload({ onParsed }: CsvUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const lines = text.split(/\r?\n/).filter((l) => l.trim())
      if (lines.length < 2) return

      const headerFields = parseCsvLine(lines[0]).map((h) =>
        h.toLowerCase().replace(/\s+/g, "_")
      )

      const nameIdx = headerFields.indexOf("name")
      const jerseyIdx = headerFields.indexOf("jersey_number")
      const divIdx = headerFields.indexOf("division")
      const statusIdx = headerFields.indexOf("status")
      const prevIdx = headerFields.indexOf("previous_team")

      if (nameIdx === -1 || jerseyIdx === -1 || divIdx === -1) {
        onParsed([{
          name: "",
          jersey_number: "",
          division: "",
          status: "",
          previous_team: "",
          error: "CSV must have columns: name, jersey_number, division",
        }])
        return
      }

      const rows = lines.slice(1).map((line) => {
        const fields = parseCsvLine(line)
        return validateRow({
          name: fields[nameIdx] ?? "",
          jersey_number: fields[jerseyIdx] ?? "",
          division: fields[divIdx] ?? "",
          status: fields[statusIdx] ?? "",
          previous_team: fields[prevIdx] ?? "",
        })
      })

      onParsed(rows)
    }
    reader.readAsText(file)
  }, [onParsed])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files[0]
    if (file && file.name.endsWith(".csv")) handleFile(file)
  }, [handleFile])

  return (
    <div
      className={dragActive ? "csv-upload-zone csv-upload-zone-active" : "csv-upload-zone"}
      onClick={() => fileRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
    >
      <Upload size={32} className="csv-upload-icon" />
      <span className="csv-upload-label">
        Drop a CSV file here or click to&nbsp;browse
      </span>
      <span className="csv-upload-hint">
        Required columns: name, jersey_number, division
      </span>
      <input
        ref={fileRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
mkdir -p frontend/components/import
git add frontend/components/import/csv-upload.tsx
git commit -m "feat: add CSV upload component with parser"
```

---

## Task 7: Build Import Preview Component

**Files:**
- Create: `frontend/components/import/import-preview.tsx`

Shows parsed rows in a table. Highlights rows with errors. Displays a summary (total valid, total errors). Confirm button triggers the import.

- [ ] **Step 1: Create the import preview component**

Create `frontend/components/import/import-preview.tsx`:

```tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import type { ParsedPlayer } from "./csv-upload"

type ImportPreviewProps = {
  rows: ParsedPlayer[]
  onConfirm: (rows: ParsedPlayer[]) => Promise<{ count: number, error?: string }>
  onReset: () => void
}

export function ImportPreview({ rows, onConfirm, onReset }: ImportPreviewProps) {
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ count: number, error?: string } | null>(null)

  const validRows = rows.filter((r) => !r.error)
  const errorRows = rows.filter((r) => r.error)

  async function handleConfirm() {
    setImporting(true)
    const res = await onConfirm(validRows)
    setResult(res)
    setImporting(false)
  }

  if (result) {
    return (
      <div className="import-page">
        {result.error ? (
          <p className="import-error-text">{result.error}</p>
        ) : (
          <p className="import-summary-text">
            Successfully imported {result.count} players.
          </p>
        )}
        <div className="import-actions">
          <Button onClick={onReset}>Import More</Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="import-summary">
        <span className="import-summary-text">
          {validRows.length} valid rows
        </span>
        {errorRows.length > 0 && (
          <span className="import-error-text">
            {errorRows.length} with errors (will be&nbsp;skipped)
          </span>
        )}
      </div>

      <table className="import-preview-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Jersey</th>
            <th>Division</th>
            <th>Status</th>
            <th>Prev Team</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={row.error ? "import-error-row" : ""}>
              <td>{row.name || "—"}</td>
              <td>{row.jersey_number || "—"}</td>
              <td>{row.division || "—"}</td>
              <td>{row.status || "registered"}</td>
              <td>{row.previous_team || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="import-actions">
        <Button onClick={handleConfirm} disabled={importing || validRows.length === 0}>
          {importing ? "Importing..." : `Import ${validRows.length} Players`}
        </Button>
        <Button variant="outline" onClick={onReset}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/import/import-preview.tsx
git commit -m "feat: add import preview table component"
```

---

## Task 8: Build Import Server Action

**Files:**
- Create: `frontend/app/admin/import/actions.ts`

Server action that receives an array of parsed player rows and inserts them into `tryout_players`. Uses the regular server client (RLS allows group_admins to insert). Returns count of inserted rows.

- [ ] **Step 1: Create the server action**

Create `frontend/app/admin/import/actions.ts`:

```typescript
"use server"

import { createClient } from "@/lib/supabase/server"
import type { ParsedPlayer } from "@/components/import/csv-upload"

export async function importPlayers(
  associationId: string,
  rows: ParsedPlayer[]
): Promise<{ count: number, error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { count: 0, error: "Not authenticated" }

  // Verify user is admin for this association
  const { data: membership } = await supabase
    .from("user_associations")
    .select("role")
    .eq("user_id", user.id)
    .eq("association_id", associationId)
    .single()

  if (!membership || (membership.role !== "group_admin" && membership.role !== "admin")) {
    return { count: 0, error: "Not authorized" }
  }

  const insertRows = rows
    .filter((r) => !r.error && r.name && r.jersey_number && r.division)
    .map((r) => ({
      association_id: associationId,
      name: r.name,
      jersey_number: r.jersey_number,
      division: r.division,
      status: r.status as "registered" | "trying_out" | "cut" | "made_team" | "moved_up" | "moved_down" | "withdrew",
      previous_team: r.previous_team || null,
    }))

  if (insertRows.length === 0) {
    return { count: 0, error: "No valid rows to import" }
  }

  const { error } = await supabase
    .from("tryout_players")
    .insert(insertRows)

  if (error) {
    return { count: 0, error: error.message }
  }

  return { count: insertRows.length }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/admin/import/actions.ts
git commit -m "feat: add server action for CSV player import"
```

---

## Task 9: Build the Import Page

**Files:**
- Create: `frontend/app/admin/import/page.tsx`

Server component that resolves the admin's association, then renders the client-side upload/preview flow.

- [ ] **Step 1: Create the import page**

Create `frontend/app/admin/import/page.tsx`:

```tsx
import { requireAdmin } from "@/lib/auth"
import { ImportPageClient } from "./import-page-client"

export default async function ImportPage() {
  const { associationId, association } = await requireAdmin()

  return (
    <div className="import-page">
      <h1 className="import-page-title">Import Players</h1>
      <p className="import-page-desc">
        Upload a CSV file to add players to {association.name}
      </p>
      <ImportPageClient associationId={associationId} />
    </div>
  )
}
```

- [ ] **Step 2: Create the client wrapper**

Create `frontend/app/admin/import/import-page-client.tsx`:

```tsx
"use client"

import { useState } from "react"
import { CsvUpload, type ParsedPlayer } from "@/components/import/csv-upload"
import { ImportPreview } from "@/components/import/import-preview"
import { importPlayers } from "./actions"

type ImportPageClientProps = {
  associationId: string
}

export function ImportPageClient({ associationId }: ImportPageClientProps) {
  const [parsedRows, setParsedRows] = useState<ParsedPlayer[] | null>(null)

  function handleReset() {
    setParsedRows(null)
  }

  async function handleConfirm(rows: ParsedPlayer[]) {
    return await importPlayers(associationId, rows)
  }

  if (!parsedRows) {
    return <CsvUpload onParsed={setParsedRows} />
  }

  return (
    <ImportPreview
      rows={parsedRows}
      onConfirm={handleConfirm}
      onReset={handleReset}
    />
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/app/admin/import/page.tsx frontend/app/admin/import/import-page-client.tsx
git commit -m "feat: add CSV import page for admins"
```

---

## Task 10: End-to-End Verification

**No files to create. Manual testing only.**

- [ ] **Step 1: Reset the local database with seed data**

```bash
cd backend && supabase db reset
```

This applies all migrations and runs `seed.sql`.

- [ ] **Step 2: Sign up and assign yourself as group_admin**

1. Start the dev server: `cd frontend && npm run dev`
2. Go to `http://localhost:3000/signup`, create an account
3. Confirm the email (check Supabase dashboard > Auth > Users for the confirmation link, or use the Inbucket local email at `http://localhost:54324`)
4. Copy your user UUID from Supabase dashboard > Auth > Users
5. Run this SQL in Supabase dashboard > SQL Editor:

```sql
INSERT INTO user_associations (user_id, association_id, role)
VALUES ('<your-user-uuid>', 'a1000000-0000-0000-0000-000000000001', 'group_admin');
```

- [ ] **Step 3: Test the import flow**

1. Go to `http://localhost:3000/admin/import`
2. Expected: see the import page with file drop zone (if you see a redirect to /dashboard, the role check worked — re-check your user_associations insert)
3. Upload `backend/test-data/sample-players.csv`
4. Expected: preview table shows 18 parsed rows, all valid
5. Click "Import 18 Players"
6. Expected: success message — "Successfully imported 18 players"

- [ ] **Step 4: Verify data in Supabase**

In Supabase dashboard > Table Editor > tryout_players:
- Expected: 18 rows
- Each row has correct name, jersey_number, division, status, previous_team
- All rows have `association_id = 'a1000000-0000-0000-0000-000000000001'`

- [ ] **Step 5: Verify auth redirect for non-admins**

1. Open an incognito window
2. Sign up as a different user (different email)
3. Do NOT add this user to user_associations
4. Go to `http://localhost:3000/admin/import`
5. Expected: redirected to `/join` (because requireAdmin calls requireAssociation which redirects users with no memberships)

- [ ] **Step 6: Final commit if any adjustments were needed**

```bash
git add -A
git commit -m "fix: adjustments from end-to-end testing"
```

- [ ] **Step 7: Build check**

```bash
cd frontend && npm run build
```

Expected: build succeeds with no errors. Fix any type or lint issues if they arise.

---

## Summary

After completing Session 1, the app has:
- **Working auth**: unauthenticated users redirected to login, authenticated users can access app routes
- **Seed data**: one association (ORMH) with 10 teams across 3 divisions
- **CSV import**: group admins can upload CSV files to bulk-load players into the database
- **Role gating**: admin routes check for group_admin/admin role, non-admins redirected

This provides the data foundation for Session 2, which builds the parent-facing experience against real Supabase data.
