# Scraper Onboarding Notes: Adding New Associations

When adding associations beyond Nepean Wildcats (NGHA/gowildcats.ca), the
continuations scraper will encounter different website structures. This
document captures lessons learned and the recommended approach.

## Problem: Every Association Website Is Different

The NGHA site (gowildcats.ca) uses the RAMP InterActive platform. Even
within a single site, different divisions use different HTML structures:

- **U15**: Jersey numbers in a `<div>` separated by `<br>` tags
- **U13**: Jersey numbers in a `<table>` with one number per `<td>` row
- **U18**: May use yet another format

Other associations may use entirely different platforms (TeamSnap,
custom WordPress, static HTML, Google Docs, PDF uploads, etc.).

## Current Scraper Architecture

The scraper in `frontend/app/(app)/continuations/scraper-actions.ts`:

1. Fetches HTML from a configured URL (`continuations_urls` table)
2. Extracts the content area (currently targets `.userContent` class from
   RAMP platform)
3. Looks for jersey numbers in two HTML patterns:
   - **Table format**: `<td>` cells containing numbers
   - **BR format**: `<div>` containing `number<br>number<br>...` sequences
4. Extracts team level, reporting date, and IP players from surrounding text
5. Presents results for admin review before publishing

## What Breaks With New Associations

| Assumption | NGHA Reality | May Differ For Others |
|---|---|---|
| Content area class | `.userContent` | Could be `.main-content`, `#article`, any selector |
| Number format | `<br>`-separated or `<table>` rows | Could be `<li>`, `<p>`, comma-separated, PDF |
| Team level in text | "U13AA skate" pattern | May use "Atom AA", "Bantam", "Minor Midget", etc. |
| IP notation | "461 IP" suffix | Could be asterisk, bold, separate column, footnote |
| Single page per division | One URL per age group | Could be one page with all divisions, tabbed, etc. |

## Recommended Approach for New Associations

### Option A: Per-Association Scraper Config (Recommended)

Add a `scraper_config` column to `continuations_urls` or a separate
`scraper_configs` table storing:

```
- content_selector: CSS selector for the content area (e.g., ".userContent", "#main-content")
- number_format: "br" | "table" | "list" | "comma" | "custom_regex"
- custom_regex: optional regex pattern for extracting numbers
- ip_pattern: how IP players are marked (e.g., "suffix:IP", "asterisk", "bold")
- team_level_pattern: optional regex for extracting team level
```

The admin configures these when first setting up the association's URL.
The scraper uses them instead of hardcoded patterns.

### Option B: Smart Detection With Fallbacks

Keep the current approach but add more format detectors in priority order:
1. Table cells (`<td>` with numbers)
2. BR-separated blocks
3. List items (`<li>` with numbers)
4. Paragraph tags (`<p>` with single numbers)
5. Comma/space-separated number blocks
6. Fallback: regex all numbers in content area (with noise filtering)

The content area selector should be configurable per-association even in
this approach.

### Before Onboarding a New Association

1. **Manually inspect their website** — view source, identify the content
   container and number format
2. **Test the scraper** against their URL using the Scrape Now button
3. **Verify the preview** carefully before confirming — the admin review
   step is the safety net
4. **If the scraper misparses**, add a new format handler or configure
   selectors before going live

### Key Safety Principle

The scrape-then-confirm workflow is critical. **Never auto-publish scraped
data.** The admin preview step catches parsing errors, wrong team levels,
and noise numbers before they reach parents. This was validated when the
NGHA scraper initially pulled address numbers (1000 from "1000 McGarry
Terrace") and misidentified "U15 Continuations" as team level "C".
