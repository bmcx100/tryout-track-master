# Track Master -- Developer Documentation

Quick-reference documentation hub for Track Master, a hockey tryout
tracking application for parents in Ontario,&nbsp;Canada.

---

## Table of Contents

| Document | Description |
|----------|-------------|
| [Business Context](./business.md) | Product overview, roles, workflows, privacy model |
| [Architecture Overview](./architecture.md) | System design summary with link to full architecture |
| [Codebase Structure](./structure.md) | Monorepo layout, App Router directories, component organization |
| [Tech Stack](./tech-stack.md) | Technologies, versions, key dependencies |
| [Development Workflow](./development.md) | Branching, CI, coding standards, PR process |
| [Local Setup](./local-setup.md) | Prerequisites, install, env vars, running locally |

---

## Quick Start

All Next.js commands run from the `frontend/` directory. Until the
monorepo migration is complete, commands run from the project&nbsp;root.

```bash
# Install dependencies
cd frontend && npm install

# Start the dev server (port 3000)
cd frontend && npm run dev

# Lint the codebase
cd frontend && npm run lint

# Type-check without emitting
cd frontend && npx tsc --noEmit

# Production build
cd frontend && npm run build
```

### Supabase (local development)

```bash
cd backend && supabase start
cd backend && supabase db push
cd backend && supabase gen types typescript --local > ../frontend/types/database.ts
```

---

## Project-Level Instructions

The root [CLAUDE.md](../CLAUDE.md) file contains authoritative instructions
for Claude Code, including coding standards, path aliases, auth patterns,
database conventions, and domain&nbsp;terminology.

---

## Source-of-Truth Documents

Full specification documents live in the `docs/prd/` directory:

- [Product Requirements Document](./prd/PRD.md) -- complete functional
  and non-functional requirements
- [System Architecture Document](./prd/ARCHITECTURE.md) -- full
  architecture with ADRs, diagrams, and deployment&nbsp;config
- [Entity-Relationship Diagram](./prd/ER.md) -- detailed database schema
  and relationships
