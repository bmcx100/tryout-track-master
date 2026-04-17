# Track Master -- Stack Reference

Quick-reference guide for the Track Master technology stack,
version constraints, and development&nbsp;commands.

---

## Tech Stack Overview

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Framework | Next.js (App Router) | 16.1.6 | Server-rendered React with RSC, `proxy.ts` auth layer |
| UI Library | React | 19.2.3 | Component model, Server Components, `use()` hook |
| Language | TypeScript | 5.x | Static type safety (strict mode) |
| Styling | Tailwind CSS | 4.x | Utility-first CSS via `@tailwindcss/postcss` |
| Components | shadcn/ui (New York) | Latest | Accessible Radix primitives with CVA variants |
| Icons | Lucide React | 0.563.x | Tree-shakeable SVG icon set |
| Backend / DB | Supabase (PostgreSQL) | Latest | Managed Postgres, RLS, Auth, Edge Functions |
| Auth | @supabase/ssr | 0.10.x | SSR cookie-based auth with PKCE flow |
| Scraping | Cheerio | 1.x | Lightweight HTML parser for static pages |
| Hosting | Vercel (Hobby) | N/A | Zero-config Next.js deployment |
| Linting | ESLint (Flat Config) | 9.x | Code quality via `eslint-config-next` |
| VCS | Git + GitHub | N/A | Trunk-based development on `main` |

---

## Version Constraints

| Dependency | Constraint | Notes |
|---|---|---|
| Node.js | 20.x | CI and Vercel runtime target |
| npm | 10.x+ | Ships with Node 20; lockfile v3 |
| Next.js | `16.1.6` | Pinned; uses `proxy.ts` instead of `middleware.ts` |
| React / React DOM | `19.2.3` | Pinned; must stay in sync |
| TypeScript | `^5` | Strict mode, `bundler` module resolution |
| Tailwind CSS | `^4` | v4 with `@tailwindcss/postcss` (no `tailwind.config.js`) |
| ESLint | `^9` | Flat config format (`eslint.config.mjs`) |

---

## Key Dependencies

| Package | Purpose |
|---|---|
| `next` | Full-stack React framework (App Router, API routes, RSC) |
| `react` / `react-dom` | UI rendering |
| `radix-ui` | Accessible headless UI primitives (used by shadcn/ui) |
| `class-variance-authority` | Component variant definitions for shadcn/ui |
| `clsx` + `tailwind-merge` | Conditional class merging via `cn()` helper |
| `lucide-react` | Icon library configured in shadcn/ui |
| `@tailwindcss/postcss` | Tailwind v4 PostCSS integration |
| `tw-animate-css` | Animation utilities for Tailwind |
| `shadcn` | CLI for adding/updating shadcn/ui components |

---

## Development Commands

```bash
# Start the dev server (port 3000)
npm run dev

# Run ESLint
npm run lint

# Run TypeScript type checking
npx tsc --noEmit

# Production build
npm run build

# Start production server
npm start

# Add a shadcn/ui component
npx shadcn@latest add <component-name>
```

---

## Monorepo Structure

```
track-master/
  frontend/          # Next.js application (all current code lives here)
  backend/           # Supabase Edge Functions, migrations, seed data
  infrastructure/    # IaC, Vercel config, CI/CD workflows
  docs/              # Architecture docs, PRD, stack reference
  .github/workflows/ # GitHub Actions CI pipeline
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL (public, used client-side) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous/public API key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (server) | Supabase service role key (server-side only, never exposed to client) |
| `NEXT_PUBLIC_BASE_URL` | No | Application base URL for OAuth callbacks (defaults to `http://localhost:3000`) |

> Store secrets in Vercel environment settings for production. Use a local `.env.local` file
> during development (already in `.gitignore`).

---

## Coding Standards

- **No semicolons** in TypeScript/JavaScript files
- **Tailwind classes** must use `@apply` in CSS when more than one class is needed on an element
- **ESLint flat config** format (`eslint.config.mjs`)
- **Branching:** trunk-based development on `main` with short-lived feature branches

---

## Useful Links

- [Next.js 16 Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript)
- [Vercel Documentation](https://vercel.com/docs)
- [shadcn/ui Documentation](https://ui.shadcn.com)
- [Tailwind CSS v4 Documentation](https://tailwindcss.com/docs)
- [Radix UI Primitives](https://www.radix-ui.com/primitives)
- [Lucide Icons](https://lucide.dev/icons)
- [ESLint Flat Config](https://eslint.org/docs/latest/use/configure/configuration-files-new)
