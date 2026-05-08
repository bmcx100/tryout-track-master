---
name: h-next-steps-implement
description: >-
  Use when the user wants to implement a spec file from docs/specs/.
  Triggers on "implement spec", "implement 016", or "/h-next-steps-implement <filename>".
  Receives a filename argument pointing to a spec in docs/specs/.
---

# Implement Spec

Implements a feature spec from `docs/specs/` end-to-end.

## Workflow

### 1. Label the session

Run this Bash command to label the session "Implementing `<filename>`" (without path or `.md` extension):

```bash
CLAUDE_PID=$(_P=$$; while [ "$_P" -gt 1 ]; do _C=$(cat /proc/$_P/comm 2>/dev/null) || break; [ "$_C" = "claude" ] && echo "$_P" && break; _P=$(awk '/PPid/{print }' /proc/$_P/status 2>/dev/null) || break; done)
mkdir -p "$HOME/.claude/session-labels"
echo "Implementing <filename>" > "$HOME/.claude/session-labels/$CLAUDE_PID.label"
```

### 2. Read the spec

Read `docs/specs/<filename>`. If the argument has no path prefix, prepend `docs/specs/`. If it has no `.md` extension, append it.

### 3. Implement

**Do NOT write a plan, invoke planning skills, or create planning documents.** The spec IS the plan. Go straight to writing code.

Do NOT invoke `superpowers:writing-plans`, `superpowers:brainstorming`, `EnterPlanMode`, or any other planning workflow. The spec already contains the full implementation plan (current state, changes required, files to touch, implementation details). Creating a plan on top of a spec is redundant — just implement it.

Follow every section of the spec exactly. The spec is self-contained.

### 4. Run the Implementation Checklist

The spec ends with an Implementation Checklist section. Complete every step in order:
- Build (`cd frontend && npm run build`)
- Lint (`cd frontend && npm run lint`)
- Start dev server (`cd frontend && npm run dev`)
- Run every Playwright test in the spec's Test Plan — do not skip any
- Revert all test mutations listed in the Test Mutations Log
- Confirm with the user that test data is clean

Do not skip any test. Every test in the Playwright Test Plan must pass before the work is considered complete.

### CRITICAL: Testing Association

**NEVER run write tests against NGHA (Nepean Wildcats) or any other live association.** All write operations during Playwright testing — creating records, updating statuses, completing levels, hearting players, submitting forms — MUST use the **Test / Sandbox association** (`a2000000-0000-0000-0000-000000000002`).

- Switch to the TEST association in the app before running any write test
- Read-only tests (navigate, snapshot, verify UI) may use NGHA
- If the sandbox lacks required test data, set it up there first — do NOT modify live data as a shortcut
- If you are unsure which association you're operating on, **STOP and verify**
