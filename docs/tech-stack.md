# Track Master -- Tech Stack

[Back to documentation hub](./index.md)

---

## Stack Summary

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Framework | Next.js (App Router) | 16.1.6 | Server-rendered React with RSC, `proxy.ts` auth layer |
| UI Library | React | 19.2.3 | Component model, Server Components, `use()` hook |
| Language | TypeScript | 5.x | Static type safety (strict mode) |
| Styling | Tailwind CSS | 4.x | Utility-first CSS via `@tailwindcss/postcss` |
| Components | shadcn/ui (New York) | Latest | Accessible Radix primitives with CVA variants |
| Icons | Lucide React | 0.563.x | Tree-shakeable SVG icon set |
| Backend / DB | Supabase (PostgreSQL) | Latest | Managed Postgres, RLS, Auth, Edge Functions, cron |
| Auth | @supabase/ssr | 0.10.x | SSR cookie-based auth with PKCE flow |
| Scraping | Cheerio | 1.x | Lightweight HTML parser for static pages |
| Hosting | Vercel (Hobby) | N/A | Zero-config Next.js deployment |
| Linting | ESLint (Flat Config) | 9.x | Code quality via `eslint-config-next` |
| VCS | Git + GitHub | N/A | Trunk-based development on `main` |

---

## Next.js 16 + React 19

Next.js 16 is the application framework, using the App Router with
React Server Components (RSC). Key differences from earlier&nbsp;versions:

- **proxy.ts replaces middleware.ts** -- session refresh and auth
  redirects run through the proxy layer, not middleware.
- **Async `cookies()` API** -- the `cookies()` function is now async
  in Next.js 16, requiring `await` in server components.
- **React 19 features** -- async Server Components, the `use()` hook,
  and View Transitions are available.
- **ESLint flat config** -- Next.js 16 uses `eslint.config.mjs` instead
  of `.eslintrc`.

Server Components handle data fetching. Client Components (marked with
`'use client'`) handle interactivity: forms, search inputs, filters,
and any code requiring `useState`, `useEffect`, or&nbsp;browser&nbsp;APIs.

---

## Tailwind CSS v4 with @apply

Tailwind CSS v4 is configured via the `@tailwindcss/postcss` plugin in
`postcss.config.mjs`. There is no `tailwind.config.js` file -- Tailwind
v4 uses CSS-based configuration.

Theme variables are defined in `app/globals.css` using the **OKLCH color
space** with light and dark mode support. Custom properties follow the
shadcn/ui naming convention
(e.g.,&nbsp;`--background`,&nbsp;`--foreground`).

### @apply Extraction Rule

Per project coding standards, elements with more than one Tailwind
utility class must use the `@apply` directive in CSS rather than inline
classes in&nbsp;JSX:

```css
.stats-card {
  @apply rounded-xl border bg-card p-6 shadow-sm;
}
```

---

## Supabase

### PostgreSQL with RLS

Supabase provides a managed PostgreSQL database with Row-Level Security
enabled on every table. Multi-tenant data isolation is enforced via
`association_id` foreign keys and SECURITY DEFINER
helper&nbsp;functions.

Key database features used:

- **Enums:** `player_status`, `app_role`, `correction_status`
- **Partial indexes:** filter on `WHERE deleted_at IS NULL` for
  soft-deleted records
- **JSONB columns:** `scraper_configs.selectors` stores CSS selector
  configurations
- **Database triggers:** auto-apply approved corrections, write
  audit&nbsp;log&nbsp;entries
- **pg_cron:** scheduled data purge via Edge Functions

### Auth

Supabase Auth handles email/password signup and Google OAuth with the
PKCE flow. Sessions are managed as HttpOnly cookies via&nbsp;`@supabase/ssr`.

### Edge Functions

Two Edge Functions run on a daily cron schedule:

- `purge-expired-data` -- deletes player records 90 days after season
  end
- `purge-warning` -- notifies group admins 30 days before purge

---

## @supabase/ssr

The `@supabase/ssr` package (v0.10.x) is the official SSR integration
for Supabase. It provides:

- **`getClaims()`** -- local JWT validation without a network call,
  used in `proxy.ts` for session refresh
- **`getAll()` / `setAll()` cookie API** -- manages auth tokens as
  HttpOnly cookies
- **Client factories:**
  - `createBrowserClient()` -- for Client Components
  - `createServerClient()` -- for Server Components and API Routes

Never use `@supabase/supabase-js` `createClient` directly. Always use
the `@supabase/ssr` wrappers from `lib/supabase/`. Never store tokens
in localStorage.

---

## Cheerio (Web Scraping)

Cheerio (v1.x) is a lightweight server-side HTML parser (~200KB) used to
scrape player data from association websites. It handles static HTML
pages without browser overhead.

Each association stores a scraper configuration in the database with CSS
selectors for player data fields and a status text mapping. Scraping is
initiated manually by group admins via the `/api/scrape`&nbsp;API&nbsp;route.

A Puppeteer-core fallback (with `@sparticuz/chromium-min` for serverless
compatibility) is planned as a Nice to Have for JavaScript-rendered
sites but is deferred from the&nbsp;MVP.

---

## Vercel Hosting

The application is deployed on Vercel's Hobby tier with auto-deploy from
the `main` branch.

| Feature | Detail |
|---------|--------|
| Deployment root | `frontend/` directory |
| Node.js version | 20.x |
| Serverless timeout | 300 seconds |
| Bandwidth | 100GB/month |
| Preview deployments | Automatic on pull requests |
| HTTPS | Enforced by default |
| Compression | Automatic Gzip/Brotli |
| Analytics | Built-in Web Vitals (LCP, CLS, INP) |

---

## ESLint Flat Config

ESLint v9 is configured with the flat config format in
`eslint.config.mjs`, using `eslint-config-next` which includes
TypeScript and Core Web Vitals rules.

---

## TypeScript (Strict Mode)

TypeScript 5.x runs in strict mode with `bundler` module resolution,
configured in `tsconfig.json`. The `@/*` path alias maps to the
`frontend/` project root.

Type-check the codebase without emitting files:

```bash
cd frontend && npx tsc --noEmit
```

---

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `next` | Full-stack React framework (App Router, API routes, RSC) |
| `react` / `react-dom` | UI rendering |
| `radix-ui` | Accessible headless UI primitives (used by shadcn/ui) |
| `class-variance-authority` | Component variant definitions |
| `clsx` + `tailwind-merge` | Conditional class merging via `cn()` helper |
| `lucide-react` | Icon library configured in shadcn/ui |
| `@tailwindcss/postcss` | Tailwind v4 PostCSS integration |
| `tw-animate-css` | Animation utilities for Tailwind |
| `shadcn` | CLI for adding/updating shadcn/ui components |
| `@supabase/ssr` | Supabase SSR auth integration |
| `@supabase/supabase-js` | Underlying Supabase client |
| `cheerio` | HTML parsing for web scraping |
| `zod` | Schema validation (to be added) |

---

## Version Constraints

| Dependency | Constraint | Notes |
|-----------|-----------|-------|
| Node.js | 20.x | CI and Vercel runtime target |
| npm | 10.x+ | Ships with Node 20; lockfile v3 |
| Next.js | `16.1.6` | Pinned; uses `proxy.ts` not `middleware.ts` |
| React / React DOM | `19.2.3` | Pinned; must stay in sync |
| TypeScript | `^5` | Strict mode, `bundler` module resolution |
| Tailwind CSS | `^4` | v4 with `@tailwindcss/postcss` (no `tailwind.config.js`) |
| ESLint | `^9` | Flat config format (`eslint.config.mjs`) |
