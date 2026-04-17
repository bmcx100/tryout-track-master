# Track Master -- Local Setup

[Back to documentation hub](./index.md)

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 20.x | JavaScript runtime for Next.js |
| npm | 10.x+ | Package manager (ships with Node 20) |
| Git | Any recent | Version control |
| Docker Desktop | Any recent | Required for Supabase local development |
| Supabase CLI | Latest | Database management, migrations, type generation |

### Installing the Supabase CLI

```bash
npm install -g supabase
```

Verify the installation:

```bash
supabase --version
```

---

## Clone and Install

```bash
git clone <repository-url>
cd track-master
```

Install frontend dependencies:

```bash
cd frontend && npm install
```

> **Note:** Until the monorepo migration is complete, the Next.js
> `package.json` may still be at the project root. If `frontend/`
> does not contain a `package.json`, run `npm install` from the
> project root instead.

---

## Environment Variables

### Frontend (`frontend/.env.local`)

Create a `.env.local` file in the `frontend/` directory with the
following variables:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJ...  # from supabase start output
SUPABASE_SERVICE_ROLE_KEY=eyJ...             # from supabase start output

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

For local development, the Supabase URL and keys come from the output of
`supabase start` (see below). For production, set these values in the
Vercel dashboard.

### Backend (`backend/.env.local`)

```bash
# Supabase CLI (for remote operations)
SUPABASE_ACCESS_TOKEN=sbp_...
SUPABASE_PROJECT_ID=<project-ref>
SUPABASE_DB_PASSWORD=<db-password>
```

The backend `.env.local` is only needed for deploying to a remote
Supabase project. Local development uses the values from
`supabase start`&nbsp;automatically.

### Environment Variable Reference

| Variable | Required | Exposed to Client | Description |
|----------|----------|-------------------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Yes | Supabase anonymous/public API key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (server) | No | Supabase service role key (server-side only) |
| `NEXT_PUBLIC_APP_URL` | No | Yes | Application base URL (defaults to `http://localhost:3000`) |

> **Security:** Never commit `.env.local` files. They are already
> listed in `.gitignore`. The `SUPABASE_SERVICE_ROLE_KEY` must never
> be exposed to client-side code.

---

## Supabase Local Development

Start the local Supabase stack (requires Docker running):

```bash
cd backend && supabase start
```

This starts a local PostgreSQL database, Auth server, and API gateway.
The output displays the local URL and API keys -- use these for
your&nbsp;`frontend/.env.local`.

### Apply Migrations

```bash
cd backend && supabase db push
```

### Load Seed Data

Seed data is applied automatically from `backend/supabase/seed.sql`
when migrations are pushed. To re-seed manually:

```bash
cd backend && supabase db reset
```

This drops and recreates the database, re-applies all migrations, and
loads the seed data.

### Generate TypeScript Types

After any schema changes, regenerate the frontend types:

```bash
cd backend && supabase gen types typescript --local > ../frontend/types/database.ts
```

### Stop Supabase

```bash
cd backend && supabase stop
```

---

## Running the Dev Server

Start the Next.js development server on port 3000:

```bash
cd frontend && npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. The
page hot-reloads on file changes.

> Make sure Supabase is running locally before starting the dev server
> if you need database access.

---

## Linting and Type Checking

```bash
# Run ESLint
cd frontend && npm run lint

# Run TypeScript type checking
cd frontend && npx tsc --noEmit

# Production build (also catches issues)
cd frontend && npm run build
```

---

## Common Troubleshooting

### `supabase start` fails

- Ensure Docker Desktop is running.
- Check that no other service is using ports 54321-54324.
- Try `supabase stop` followed by `supabase start` to reset.

### Missing environment variables

If the dev server starts but API calls fail, verify that
`frontend/.env.local` contains all required variables and that the
values match the output from `supabase start`.

### Port 3000 already in use

Another process is using port 3000. Find and stop it:

```bash
lsof -i :3000
kill -9 <PID>
```

Or start the dev server on a different port:

```bash
cd frontend && npm run dev -- --port 3001
```

### Type errors after schema changes

Regenerate the TypeScript types from the local Supabase instance:

```bash
cd backend && supabase gen types typescript --local > ../frontend/types/database.ts
```

### RLS policies blocking queries

When testing with different user roles, use the Supabase local dashboard
at [http://127.0.0.1:54323](http://127.0.0.1:54323) to inspect RLS
policies and run SQL queries with different user contexts.

### `proxy.ts` not refreshing sessions

Verify that `proxy.ts` exists at the root of the `frontend/` directory
(not inside `app/`). It must use `getClaims()` for session validation,
not `getUser()` or `getSession()`. Refer to the Next.js 16 proxy
documentation at
`/home/data/Documents/webapps/documentation/nextjs-16-proxy.md`.

### Build fails with module resolution errors

Check that the `@/*` path alias in `tsconfig.json` correctly maps to
the project root. After the monorepo migration, this should point
to&nbsp;`frontend/`.
