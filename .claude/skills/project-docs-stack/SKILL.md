# Project Docs Stack

**Description:** Guides developers to the correct reference documentation for the Track Master tech stack. Ensures that Next.js 16 proxy patterns, Supabase auth integration, and stack version constraints are followed by consulting official documentation before making changes.

**Trigger:** Use this skill when:
- Implementing or modifying authentication flows
- Working with proxy.ts or session refresh logic
- Creating or modifying Supabase client utilities
- Upgrading Next.js, Supabase, or other core dependencies
- Encountering auth-related bugs or unexpected behavior
- Unsure about the correct API for a stack component

---

## Reference Documentation

### 1. Next.js 16 Proxy Patterns

**Documentation file:** `/home/data/Documents/webapps/documentation/nextjs-16-proxy.md`

**When to consult:**
- Creating or modifying `proxy.ts` (the root-level proxy file)
- Implementing route protection or redirect logic in the proxy layer
- Configuring the proxy matcher (which routes the proxy applies to)
- Understanding the difference between proxy.ts and the deprecated middleware.ts

**Key facts:**
- Next.js 16 replaces `middleware.ts` with `proxy.ts`
- The proxy file must export a `proxy` function and a `config` object with a `matcher`
- The proxy runs on the edge before the route is rendered
- Use it for session refresh, auth redirects, and header manipulation
- Do NOT use it for heavy computation or database queries

**Correct proxy structure:**
```ts
// proxy.ts (root level)
import { type NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/proxy"

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
```

**IMPORTANT:** Always read the documentation file before modifying proxy.ts. The API has specific constraints that differ from the old middleware pattern.

---

### 2. Supabase Auth with Next.js

**Documentation file:** `/home/data/Documents/webapps/documentation/supabase-auth-nextjs-examples.md`

**When to consult:**
- Creating Supabase client utilities (browser, server, proxy, admin)
- Implementing login, signup, logout, or OAuth flows
- Setting up the auth callback route handler
- Configuring cookie handling for SSR
- Troubleshooting session persistence or refresh issues

**Key patterns covered:**
- Browser client creation (`createBrowserClient`)
- Server client creation (`createServerClient` with `cookies()`)
- Proxy client creation (`createServerClient` with request/response cookies)
- Auth callback handler (`exchangeCodeForSession`)
- OAuth flow with PKCE
- Email/password signup and login
- Session refresh in the proxy layer

**Critical rules from the docs:**
- Always use `getAll()`/`setAll()` cookie API, never `get()`/`set()`/`remove()`
- Use `getClaims()` in proxy, `getUser()` in Server Components
- The browser client handles cookies automatically; do not manually manage cookies client-side
- The auth callback must be a route handler (`route.ts`), not a page

---

### 3. Next.js 16 Upgrade Guide

**Documentation file:** `/home/data/Documents/webapps/documentation/nextjs-16-upgrade-guide.md`

**When to consult:**
- Encountering breaking changes or deprecation warnings
- Migrating patterns from Next.js 14 or 15 to 16
- Understanding new App Router features or API changes
- Configuring `next.config.ts` (not `.js`)

**Key breaking changes in Next.js 16:**
- `middleware.ts` is replaced by `proxy.ts`
- Configuration file must be `next.config.ts` (TypeScript, not JavaScript)
- ESLint uses flat config format (`eslint.config.mjs`)
- `cookies()` and `headers()` are now async (must `await`)
- Dynamic route params are async (must `await params` in page components)

---

## Stack Version Constraints

The following versions are pinned for Track Master. Do not upgrade major versions without consulting the relevant documentation and testing thoroughly.

| Package | Version | Notes |
|---------|---------|-------|
| `next` | 16.1.6 | Uses proxy.ts, App Router, React 19 |
| `react` | 19.x | Ships with Next.js 16, async RSC |
| `typescript` | 5.x | Strict mode enabled |
| `tailwindcss` | 4.x | OKLCH color space, @apply directive |
| `@supabase/ssr` | 0.10.x | getAll/setAll cookie API, getClaims |
| `@supabase/supabase-js` | 2.x | PostgreSQL client, auth, realtime |
| `cheerio` | 1.x | HTML parsing for scraping |
| `eslint` | 9.x | Flat config format |

**Rules:**
- Do not install `@supabase/auth-helpers-nextjs` (deprecated)
- Do not install `next-auth` or `NextAuth.js` (project uses Supabase Auth)
- Do not install `middleware`-related packages (proxy.ts replaces middleware)
- Do not install state management libraries (`redux`, `zustand`, `jotai`) unless the project outgrows React state
- Minimize dependencies: prefer built-in browser/Node APIs and existing packages over adding new ones

---

## Documentation Consultation Protocol

**Before making changes to auth, proxy, or Next.js 16 patterns, follow this protocol:**

1. **Read the relevant doc file** from `/home/data/Documents/webapps/documentation/`
2. **Identify the correct pattern** for your use case
3. **Follow the official pattern exactly** -- do not invent alternative approaches
4. **If the docs conflict with your intuition,** the docs are the source of truth
5. **If the docs do not cover your use case,** note this explicitly and propose a pattern consistent with the documented conventions

**Correct:**
```
// Before modifying proxy.ts:
// 1. Read /home/data/Documents/webapps/documentation/nextjs-16-proxy.md
// 2. Confirmed: proxy exports async function + config with matcher
// 3. Following documented pattern for session refresh
```

**Incorrect:**
```
// Modifying proxy.ts based on Stack Overflow answers for Next.js 14 middleware
// Not consulting project documentation
// Using deprecated middleware.ts patterns
```
