# Track Master -- Development Workflow

[Back to documentation hub](./index.md)

---

## Branching Strategy

Track Master uses **trunk-based development** on the `main` branch with
short-lived feature branches. All changes merge to `main` via pull
request. Vercel auto-deploys from `main`&nbsp;to&nbsp;production.

### Branch Naming

| Prefix | Purpose | Example |
|--------|---------|---------|
| `feature/` | New functionality | `feature/player-search` |
| `fix/` | Bug fixes | `fix/correction-duplicate-check` |
| `chore/` | Maintenance, config, docs | `chore/update-eslint-config` |

### Creating a Branch

Always use `git switch -c` (not `git checkout`):

```bash
git switch -c feature/player-search
```

---

## Pull Request Workflow

1. Create a branch from `main` using the naming conventions above.
2. Make changes and commit with clear, descriptive messages.
3. Push the branch and open a pull request against `main`.
4. Vercel creates a preview deployment for the PR automatically.
5. CI runs lint, type-check, and build on every PR (see below).
6. Merge to `main` after CI passes and review is complete.
7. Vercel auto-deploys `main` to production.

---

## CI Pipeline

The CI workflow runs on every pull request targeting `main`. It is
defined in `infrastructure/.github/workflows/ci.yml` and executes
from the `frontend/` working&nbsp;directory.

| Step | Command | Purpose |
|------|---------|---------|
| Lint | `npx eslint .` | Enforce code quality and style rules |
| Type-check | `npx tsc --noEmit` | Verify TypeScript correctness without emitting files |
| Build | `npm run build` | Confirm the production build succeeds |

All three steps must pass before a PR can be merged.

---

## Coding Standards

### No Semicolons

All TypeScript and JavaScript files must omit semicolons. This is
enforced project-wide.

```typescript
// correct
const name = "Track Master"
export default function Page() {
  return <h1>{name}</h1>
}

// incorrect
const name = "Track Master";
export default function Page() {
  return <h1>{name}</h1>;
}
```

### Tailwind Classes and @apply

Do not apply multiple Tailwind classes directly in component templates.
If an element needs more than a single Tailwind utility class, extract
them into a custom class using the `@apply` directive
in&nbsp;CSS.

```css
/* In globals.css or a component CSS module */
.player-card {
  @apply rounded-lg border p-4 shadow-sm;
}
```

```tsx
// correct: one class or a custom class
<div className="player-card">...</div>

// incorrect: multiple Tailwind classes inline
<div className="rounded-lg border p-4 shadow-sm">...</div>
```

### Images

All images must be stored in `public/images/` with subfolders by
category. Never place images in the project root or directly
in&nbsp;`public/`.

```
public/images/
|-- branding/
|   |-- logo.svg
|   |-- og-image.png
|-- homepage/
|   |-- hero.png
```

### No Hanging Words

Never allow a line break that leaves a single word alone on a new line
in rendered text. Ensure at least three words remain together on the last
line. Use `text-wrap: balance`, non-breaking spaces (`&nbsp;`), or
manual line breaks to&nbsp;prevent&nbsp;this.

### Minimal Dependencies

Use minimal project dependencies where possible. Before adding a new
npm package, consider whether the functionality can be achieved with
existing tools or a small custom&nbsp;implementation.

---

## Commit Conventions

Write clear, descriptive commit messages. Use the imperative mood in the
subject line. Keep the subject under 72&nbsp;characters.

Examples:

```
Add player search with debounced input
Fix duplicate correction submission check
Update RLS policies for three-tier role system
Remove unused import in player-list component
```

---

## Adding shadcn/ui Components

Run the shadcn CLI from the `frontend/` directory:

```bash
cd frontend
npx shadcn@latest add <component-name>
```

Components are placed in `components/ui/` and use:

- `class-variance-authority` for component variants
- `radix-ui` for accessible headless primitives
- The `cn()` utility from `lib/utils.ts` for class merging

Available components are listed at
[ui.shadcn.com](https://ui.shadcn.com). The project uses the
**New York** style with **Lucide** icons.

---

## Testing

The project does not include automated test suites in the MVP phase.
Verification is performed through the following&nbsp;methods:

| Method | Command | Purpose |
|--------|---------|---------|
| Type checking | `cd frontend && npx tsc --noEmit` | Catch type errors |
| Linting | `cd frontend && npx eslint .` | Enforce code quality |
| Build verification | `cd frontend && npm run build` | Confirm production build works |
| Manual testing | Start dev server + Supabase local | Test features with seed data |
| RLS testing | Supabase dashboard SQL editor | Verify policies with different user contexts |

---

## Database Workflow

### Creating Migrations

Add new migration files in `backend/supabase/migrations/` with
sequential numbering:

```
00013_add_new_table.sql
```

### Applying Migrations

```bash
cd backend && supabase db push
```

### Generating Types

After schema changes, regenerate the TypeScript types:

```bash
cd backend && supabase gen types typescript --local > ../frontend/types/database.ts
```

### Deploying Edge Functions

```bash
cd backend && supabase functions deploy purge-expired-data
cd backend && supabase functions deploy purge-warning
```
