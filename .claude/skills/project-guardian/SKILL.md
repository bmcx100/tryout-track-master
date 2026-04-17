# Project Guardian

**Description:** Enforces project-wide coding standards, security rules, and architectural constraints for Track Master. Run this skill after making changes to validate compliance.

**Trigger:** Use this skill when:
- Reviewing or writing new TypeScript/JavaScript code
- Adding or modifying Tailwind CSS styles
- Creating or altering database tables or migrations
- Working with Supabase auth or client code
- Adding images or static assets to the project

---

## Enforcement Rules

### 1. No Semicolons in JS/TS

All JavaScript and TypeScript files must omit semicolons.

**Correct:**
```ts
const name = "Track Master"
export default function Home() {
  return <h1>Welcome</h1>
}
```

**Incorrect:**
```ts
const name = "Track Master";
export default function Home() {
  return <h1>Welcome</h1>;
}
```

**How to check:** Scan all `.ts`, `.tsx`, `.js`, `.jsx` files for lines ending with `;`. Exclude `node_modules/`, `.next/`, and third-party generated files. Lines inside template literals or comments are exceptions only if the semicolon is part of the content (e.g., SQL strings, CSS-in-JS strings).

---

### 2. Tailwind @apply for Multi-Class Styling

Never apply more than one Tailwind utility class directly in a JSX element's `className`. If an element needs two or more Tailwind classes, extract them into a custom class using the `@apply` directive in CSS.

**Correct:**
```tsx
// component.tsx
<div className="player-card">...</div>
```
```css
/* globals.css or component-specific CSS */
.player-card {
  @apply flex items-center gap-4 rounded-lg border p-4;
}
```

**Also correct (single class is allowed inline):**
```tsx
<div className="container">...</div>
```

**Incorrect:**
```tsx
<div className="flex items-center gap-4 rounded-lg border p-4">...</div>
```

**Exception:** The `cn()` utility from `lib/utils.ts` may combine custom classes or a single Tailwind class with conditional classes. The rule applies to raw Tailwind utility strings, not to `cn()` calls that merge custom classes.

---

### 3. Images in public/images/ with Subfolders

All image files (png, jpg, jpeg, svg, gif, webp, ico, avif) must be stored under `public/images/` with category-based subfolders. Never place images in the project root or directly in `public/`.

**Correct:**
```
public/images/branding/logo.svg
public/images/branding/og-image.png
public/images/homepage/hero-bg.webp
```

**Incorrect:**
```
public/logo.svg
logo.svg
public/images/logo.svg  (no subfolder)
```

**Rule:** When more than 15 images exist, organize into subfolders by category (e.g., `branding/`, `homepage/`, `icons/`).

---

### 4. All Tables Must Have RLS Enabled

Every PostgreSQL table containing user or association data must have Row-Level Security enabled with appropriate policies. No table should be accessible without authentication.

**Correct:**
```sql
CREATE TABLE teams (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  association_id uuid REFERENCES associations(id) NOT NULL,
  name text NOT NULL
)

ALTER TABLE teams ENABLE ROW LEVEL SECURITY

CREATE POLICY "Users can view teams in their association"
  ON teams FOR SELECT
  USING (
    association_id IN (
      SELECT association_id FROM user_associations
      WHERE user_id = auth.uid()
    )
  )
```

**Incorrect:**
```sql
CREATE TABLE teams (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  association_id uuid REFERENCES associations(id) NOT NULL,
  name text NOT NULL
)
-- No RLS enabled, no policies defined
```

**How to check:** Every `CREATE TABLE` migration must be followed by `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and at least one `CREATE POLICY` statement.

---

### 5. association_id FK on All Tenant-Scoped Tables

Every table that contains data scoped to an association must include an `association_id` foreign key column referencing `associations(id)`. This is the foundation of multi-tenant isolation.

**Tables that MUST have association_id:**
- `teams`
- `tryout_players`
- `corrections`
- `scraper_configs`
- `audit_log`
- `user_associations`

**Tables that do NOT need association_id:**
- `associations` (it is the tenant table itself)
- Auth tables managed by Supabase (`auth.users`)

**Correct:**
```sql
CREATE TABLE tryout_players (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  association_id uuid REFERENCES associations(id) NOT NULL,
  name text NOT NULL,
  jersey_number integer,
  status player_status DEFAULT 'registered'
)
```

**Incorrect:**
```sql
CREATE TABLE tryout_players (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  jersey_number integer,
  status player_status DEFAULT 'registered'
  -- Missing association_id -- data cannot be tenant-isolated
)
```

---

### 6. No Deprecated @supabase/auth-helpers-nextjs

Never use the deprecated `@supabase/auth-helpers-nextjs` package. Use `@supabase/ssr` exclusively for all Supabase auth integration.

**Correct:**
```ts
import { createBrowserClient } from "@supabase/ssr"
import { createServerClient } from "@supabase/ssr"
```

**Incorrect:**
```ts
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
```

**How to check:** Search for any import from `@supabase/auth-helpers-nextjs` across the codebase. There should be zero matches. Also verify `package.json` does not list this package as a dependency.

---

### 7. Use getClaims() Not getUser() in Proxy

In the proxy layer (`proxy.ts`), always use `supabase.auth.getClaims()` to validate and refresh JWT tokens. Never use `supabase.auth.getUser()` or `supabase.auth.getSession()` in the proxy because they make additional network calls to the Supabase Auth server, adding latency to every request.

**Correct:**
```ts
// lib/supabase/proxy.ts
const { data: { claims }, error } = await supabase.auth.getClaims()
```

**Incorrect:**
```ts
// lib/supabase/proxy.ts
const { data: { user }, error } = await supabase.auth.getUser()
const { data: { session }, error } = await supabase.auth.getSession()
```

**Note:** `getUser()` is acceptable in Server Components and Server Actions where you need the full user object. The restriction applies only to the proxy layer.

---

### 8. Use getAll()/setAll() Cookie API Only

When creating Supabase server or proxy clients, always use the `getAll()`/`setAll()` cookie API. Never use the deprecated single-cookie `get()`/`set()`/`remove()` API.

**Correct:**
```ts
const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        )
      },
    },
  }
)
```

**Incorrect:**
```ts
const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    cookies: {
      get(name) {
        return cookieStore.get(name)?.value
      },
      set(name, value, options) {
        cookieStore.set(name, value, options)
      },
      remove(name, options) {
        cookieStore.set(name, "", options)
      },
    },
  }
)
```

---

### 9. Three-Tier Role System

The application uses three roles. All role checks must reference these exact values:

| Role | Scope | Description |
|------|-------|-------------|
| `admin` | Site-level | Full system access. Can manage all associations. |
| `group_admin` | Association-level | Full access within their association. Stored in `user_associations.role`. |
| `member` | Association-level | Read access plus correction submission. The default role for parents. |

**Correct:**
```ts
type AppRole = "admin" | "group_admin" | "member"
```

**Incorrect:**
```ts
type AppRole = "admin" | "parent"  // Missing group_admin, uses "parent" instead of "member"
type AppRole = "superadmin" | "admin" | "user"  // Wrong role names
```

**Note:** The database enum `app_role` must match these three values. RLS policies and proxy-level checks must enforce role boundaries.

---

## Validation Checklist

When reviewing code, verify all of the following:

- [ ] No semicolons at the end of statements in JS/TS files
- [ ] No multi-class Tailwind strings in JSX `className` attributes (use `@apply`)
- [ ] All images are in `public/images/<subfolder>/`
- [ ] All new database tables have RLS enabled with policies
- [ ] All tenant-scoped tables have `association_id` FK
- [ ] No imports from `@supabase/auth-helpers-nextjs`
- [ ] Proxy uses `getClaims()`, not `getUser()` or `getSession()`
- [ ] Supabase clients use `getAll()`/`setAll()` cookie API
- [ ] Role references use `admin`, `group_admin`, `member` only
