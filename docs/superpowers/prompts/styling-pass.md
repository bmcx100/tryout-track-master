# Styling Pass Prompt

Copy everything below the line into a new Claude Code session from the `track-master` project root.

---

I'm building Track Master -- a hockey tryout tracker for parents. Read these files first to understand what's built and what's been decided:

1. `CLAUDE.md` -- project conventions and coding standards
2. `docs/prd/PRD.md` -- full product requirements
3. `docs/prd/ARCHITECTURE.md` -- system architecture
4. `docs/superpowers/specs/2026-04-17-teams-prediction-board-design.md` -- the Teams prediction board design spec
5. Your memory file for project context

**What I need from you:**

I'm going to give you my styling preferences (color scheme, fonts, spacing, visual tone). Your job is to:

1. **Read all five documents above first** before asking me anything.
2. **Use the visual companion to show me styling options.** For every styling decision (color palette, font pairing, status badge colors, button styles, etc.), build phone-shaped mockups using the prediction board layout from the design spec and serve them on localhost so I can see and compare the options in my browser. Use the brainstorming skill's visual companion -- start the server with `scripts/start-server.sh --project-dir /path/to/track-master --host 0.0.0.0 --url-host localhost`, write HTML content fragments to the screen directory, and tell me the URL to open. Show me 2-3 options per decision as side-by-side phone mockups and get my approval before moving to the next decision.
3. **Ask me styling questions one at a time** -- colors, fonts, visual tone, brand feel. Every question that involves visual appearance should be shown as a mockup, not described in text.
4. **Update the design spec** (`docs/superpowers/specs/2026-04-17-teams-prediction-board-design.md`) with concrete styling decisions -- exact color values, font families, spacing scales, border styles, shadow values, etc. Fill in the "Status Badge Colors" section with exact hex/oklch values. Add a new "Visual Style Guide" section.
5. **Update `frontend/app/globals.css`** with the CSS custom properties and any new `@apply` classes needed.
6. **Do NOT change any layout, functionality, interactions, component hierarchy, data model, or routing.** Those are locked. You are only touching visual presentation: colors, fonts, spacing, borders, shadows, border-radius, background tints.

**How to show mockups:**

- Use the prediction board layout from the design spec as the base for all mockups. Show real player data (names, jerseys, status badges, team headers, hearts, drag handles) so I can see how the styling looks in context.
- Phone-shaped frames with notch, rounded corners, status bar -- the same format used during the design brainstorming.
- Show 2-3 options side by side as phone mockups for each styling question.
- After I pick an option, apply it to all subsequent mockups so the style builds up cumulatively.
- Remind me of the localhost URL each time you push a new mockup.

**Rules:**
- The design spec is the source of truth for WHAT gets built. You're adding HOW it looks.
- Follow the `@apply` convention from CLAUDE.md -- no inline Tailwind class lists in JSX.
- Use OKLCH color space for theme variables (matching the existing globals.css pattern).
- Commit your changes when done.

**After styling is complete**, I'll continue implementing the spec. Leave me set up to do that -- make sure the spec + PRD + globals.css are all consistent and ready for a developer to build from.

Ready? Here are my styling preferences:
