/**
 * Normalize a previous_team string by removing spaces between
 * the division prefix (e.g. "U15") and the tier (e.g. "AA", "B").
 *
 * "U15 B"   → "U15B"
 * "U15 AA"  → "U15AA"
 * "U18 BB"  → "U18BB"
 * "U13A"    → "U13A"  (already normalized)
 * "U15AA-NGHA" → "U15AA-NGHA" (suffix preserved)
 */
export function normalizePreviousTeam(value: string): string {
  return value.replace(/^(U\d+)\s+/i, "$1")
}
