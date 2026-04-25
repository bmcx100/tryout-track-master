# Player Detail Form Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the player detail bottom-sheet into a read-only/edit-mode form with extended annotation fields and multi-field corrections.

**Architecture:** The current `LongPressMenu` component is a single-mode sheet where most fields are always editable. This plan converts it to a two-mode design: read-only by default, edit mode behind an Edit button. New annotation columns (`custom_jersey`, `custom_position`, `custom_previous_team`, `custom_team`) let parents store personal overrides. The shared `Annotations` type is extracted to `frontend/types/annotations.ts` so all consuming files import from one place.

**Tech Stack:** Next.js 16 App Router, React 19, Supabase (PostgreSQL + RLS), TypeScript 5, Tailwind CSS v4 with `@apply` convention.

**Spec:** `docs/specs/024-player-detail-form.md`

**CLAUDE.md rules to follow:**
- No semicolons in TS/JS
- No more than 1 Tailwind class inline — use `@apply` in `globals.css`
- `@/*` path alias maps to `frontend/`
- Commands run from `frontend/`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/supabase/migrations/20260424000001_add_custom_annotation_columns.sql` | Create | Add 4 columns to `player_annotations` |
| `frontend/types/annotations.ts` | Create | Shared `Annotations` type definition |
| `frontend/types/index.ts` | Modify | Re-export `Annotations` from `annotations.ts` |
| `frontend/app/(app)/annotations/actions.ts` | Modify | Extend return types, add `savePlayerAnnotations` |
| `frontend/app/(app)/corrections/actions.ts` | Modify | Extend `reviewCorrection` for position/previous_team/team |
| `frontend/components/teams/long-press-menu.tsx` | Modify | Major rewrite: read-only/edit modes |
| `frontend/components/teams/teams-page-client.tsx` | Modify | Use shared type, add `handleSaveAnnotations`, pass new props |
| `frontend/components/continuations/continuations-page-client.tsx` | Modify | Use shared type, add save handler |
| `frontend/components/teams/player-row.tsx` | Modify | Accept + display custom jersey/position |
| `frontend/components/continuations/continuation-player-row.tsx` | Modify | Accept + display custom jersey/position |
| `frontend/components/teams/prediction-board.tsx` | Modify | Use shared `Annotations` type |
| `frontend/components/teams/previous-teams-view.tsx` | Modify | Use shared `Annotations` type |
| `frontend/components/teams/team-section.tsx` | Modify | Use shared `Annotations` type, pass new fields to PlayerRow |
| `frontend/components/continuations/round-section.tsx` | Modify | Use shared `Annotations` type, pass new fields |
| `frontend/components/dashboard/my-favourites-client.tsx` | Modify | Use shared type |
| `frontend/components/settings/corrections-list.tsx` | Modify | Add field labels for position/previous_team/team |
| `frontend/app/globals.css` | Modify | New styles for edit/read-only modes, save/cancel buttons |

---

## Task 1: Database Migration

**Files:**
- Create: `backend/supabase/migrations/20260424000001_add_custom_annotation_columns.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Add custom annotation columns for parent overrides
ALTER TABLE player_annotations ADD COLUMN IF NOT EXISTS custom_jersey text;
ALTER TABLE player_annotations ADD COLUMN IF NOT EXISTS custom_position text;
ALTER TABLE player_annotations ADD COLUMN IF NOT EXISTS custom_previous_team text;
ALTER TABLE player_annotations ADD COLUMN IF NOT EXISTS custom_team text;
```

No new RLS policies needed — existing user-scoped policies on `player_annotations` already cover all columns.

- [ ] **Step 2: Apply migration to hosted Supabase**

Run via Supabase dashboard SQL editor (since this is a hosted project, not local):
```
Navigate to Supabase dashboard → SQL Editor → paste the ALTER TABLE statements → Run
```

Or if the user prefers CLI: `cd backend && supabase db push`

- [ ] **Step 3: Regenerate types**

```bash
cd /home/data/Documents/webapps/tryout-track-master/backend && supabase gen types typescript --local > ../frontend/types/database.ts
```

**Note:** If local Supabase is not running, skip this step — the types file can be manually updated or generated later. The code will use the column names directly which are known.

- [ ] **Step 4: Commit**

```bash
git add backend/supabase/migrations/20260424000001_add_custom_annotation_columns.sql
git commit -m "db: add custom annotation columns for jersey, position, previous_team, team"
```

---

## Task 2: Extract Shared Annotations Type

**Files:**
- Create: `frontend/types/annotations.ts`
- Modify: `frontend/types/index.ts`

- [ ] **Step 1: Create `frontend/types/annotations.ts`**

```typescript
export type Annotations = Record<string, {
  isFavorite: boolean
  notes: string | null
  customName: string | null
  customJersey: string | null
  customPosition: string | null
  customPreviousTeam: string | null
  customTeam: string | null
}>
```

- [ ] **Step 2: Re-export from `frontend/types/index.ts`**

Add this line at the end of the existing file:

```typescript
export type { Annotations } from "./annotations"
```

- [ ] **Step 3: Commit**

```bash
git add frontend/types/annotations.ts frontend/types/index.ts
git commit -m "refactor: extract shared Annotations type to types/annotations.ts"
```

---

## Task 3: Extend Server Actions (Annotations)

**Files:**
- Modify: `frontend/app/(app)/annotations/actions.ts`

- [ ] **Step 1: Update `getPlayerAnnotations` return type and query**

Change the select to include the new columns:

```typescript
export async function getPlayerAnnotations(
  associationId: string
): Promise<Record<string, { isFavorite: boolean, notes: string | null, customName: string | null, customJersey: string | null, customPosition: string | null, customPreviousTeam: string | null, customTeam: string | null }>> {
```

Update the `.select()` call:
```typescript
.select("player_id, is_favorite, notes, custom_name, custom_jersey, custom_position, custom_previous_team, custom_team, tryout_players!inner(association_id)")
```

Update the result mapping to include the new fields:
```typescript
result[ann.player_id] = {
  isFavorite: ann.is_favorite,
  notes: ann.notes,
  customName: ann.custom_name,
  customJersey: ann.custom_jersey,
  customPosition: ann.custom_position,
  customPreviousTeam: ann.custom_previous_team,
  customTeam: ann.custom_team,
}
```

- [ ] **Step 2: Add `savePlayerAnnotations` function**

Add after the existing `saveCustomName` function:

```typescript
export async function savePlayerAnnotations(
  playerId: string,
  annotations: {
    customName?: string | null
    customJersey?: string | null
    customPosition?: string | null
    customPreviousTeam?: string | null
    customTeam?: string | null
  }
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("player_annotations")
    .upsert(
      {
        user_id: user.id,
        player_id: playerId,
        custom_name: annotations.customName ?? null,
        custom_jersey: annotations.customJersey ?? null,
        custom_position: annotations.customPosition ?? null,
        custom_previous_team: annotations.customPreviousTeam ?? null,
        custom_team: annotations.customTeam ?? null,
      },
      { onConflict: "user_id,player_id" }
    )

  if (error) return { error: error.message }
  return {}
}
```

- [ ] **Step 3: Update `saveCustomName` to delegate**

Replace body of `saveCustomName` to call `savePlayerAnnotations`:

```typescript
export async function saveCustomName(
  playerId: string,
  customName: string
): Promise<{ error?: string }> {
  return savePlayerAnnotations(playerId, { customName: customName || null })
}
```

- [ ] **Step 4: Update `getMyPlayers` return type**

Extend the annotation object in the return type:

```typescript
): Promise<{ player: TryoutPlayer, annotation: { isFavorite: boolean, customName: string | null, customJersey: string | null, customPosition: string | null, customPreviousTeam: string | null, customTeam: string | null } }[]> {
```

Update the `.select()` to include new columns:
```typescript
.select("player_id, is_favorite, custom_name, custom_jersey, custom_position, custom_previous_team, custom_team, tryout_players!inner(*)")
```

Update the `.or()` filter to match rows with any custom field set:
```typescript
.or("is_favorite.eq.true,custom_name.neq.,custom_jersey.neq.,custom_position.neq.,custom_previous_team.neq.,custom_team.neq.")
```

Update the result mapping:
```typescript
annotation: {
  isFavorite: ann.is_favorite,
  customName: ann.custom_name,
  customJersey: ann.custom_jersey,
  customPosition: ann.custom_position,
  customPreviousTeam: ann.custom_previous_team,
  customTeam: ann.custom_team,
},
```

- [ ] **Step 5: Update `getMyPlayersCount` filter**

Update the `.or()` to match the new filter:
```typescript
.or("is_favorite.eq.true,custom_name.neq.,custom_jersey.neq.,custom_position.neq.,custom_previous_team.neq.,custom_team.neq.")
```

- [ ] **Step 6: Verify build**

```bash
cd /home/data/Documents/webapps/tryout-track-master/frontend && npx tsc --noEmit
```

Expected: Type errors in consuming files (they still use old Annotations shape). That's fine — those get fixed in later tasks.

- [ ] **Step 7: Commit**

```bash
git add frontend/app/\(app\)/annotations/actions.ts
git commit -m "feat: extend annotation actions with custom jersey/position/team fields"
```

---

## Task 4: Extend Corrections Review

**Files:**
- Modify: `frontend/app/(app)/corrections/actions.ts`
- Modify: `frontend/components/settings/corrections-list.tsx`

- [ ] **Step 1: Extend `reviewCorrection` in `corrections/actions.ts`**

Add handling for `position`, `previous_team`, and `team` fields inside the `if (action === "approved")` block, after the existing `jersey_number` and `name` handlers:

```typescript
    } else if (correction.field_name === "position") {
      const validPositions = ["F", "D", "G"]
      if (!validPositions.includes(correction.new_value)) {
        return { error: `Invalid position: ${correction.new_value}. Must be F, D, or G.` }
      }
      const { error: updateError } = await supabase
        .from("tryout_players")
        .update({ position: correction.new_value })
        .eq("id", correction.player_id)
      if (updateError) return { error: updateError.message }
    } else if (correction.field_name === "previous_team") {
      const { error: updateError } = await supabase
        .from("tryout_players")
        .update({ previous_team: correction.new_value })
        .eq("id", correction.player_id)
      if (updateError) return { error: updateError.message }
    } else if (correction.field_name === "team") {
      // Team corrections store a team name — look up team_id
      const { data: player } = await supabase
        .from("tryout_players")
        .select("association_id, division")
        .eq("id", correction.player_id)
        .single()

      if (player) {
        const { data: team } = await supabase
          .from("teams")
          .select("id")
          .eq("association_id", player.association_id)
          .eq("division", player.division)
          .ilike("name", correction.new_value)
          .maybeSingle()

        if (!team) {
          return { error: `Team "${correction.new_value}" not found in this division` }
        }

        const { error: updateError } = await supabase
          .from("tryout_players")
          .update({ team_id: team.id })
          .eq("id", correction.player_id)
        if (updateError) return { error: updateError.message }
      }
    }
```

- [ ] **Step 2: Update field label in `corrections-list.tsx`**

In the `CorrectionsList` component, around line 214, replace the field label logic:

Change:
```typescript
{c.field_name === "name" ? "Name" : "Jersey #"}
```

To:
```typescript
{fieldLabel(c.field_name)}
```

Add a helper function at the top of the file (after imports):

```typescript
function fieldLabel(fieldName: string): string {
  const labels: Record<string, string> = {
    name: "Name",
    jersey_number: "Jersey #",
    position: "Position",
    previous_team: "Previous Team",
    team: "Team",
  }
  return labels[fieldName] ?? fieldName
}
```

- [ ] **Step 3: Verify build**

```bash
cd /home/data/Documents/webapps/tryout-track-master/frontend && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add frontend/app/\(app\)/corrections/actions.ts frontend/components/settings/corrections-list.tsx
git commit -m "feat: extend corrections review to handle position, previous_team, team fields"
```

---

## Task 5: Rewrite Detail Sheet (LongPressMenu)

**Files:**
- Modify: `frontend/components/teams/long-press-menu.tsx`

This is the largest task. The component gets a read-only/edit-mode design.

- [ ] **Step 1: Update props**

Replace the existing `LongPressMenuProps` type:

```typescript
type LongPressMenuProps = {
  player: TryoutPlayer
  isFavorite: boolean
  customName: string | null
  customJersey: string | null
  customPosition: string | null
  customPreviousTeam: string | null
  customTeam: string | null
  note: string | null
  onClose: () => void
  onToggleFavorite: () => void
  onSaveAnnotations: (annotations: {
    customName?: string | null
    customJersey?: string | null
    customPosition?: string | null
    customPreviousTeam?: string | null
    customTeam?: string | null
  }) => void
  onSaveNote: (note: string) => void
  onSubmitCorrection: (fieldName: string, oldValue: string, newValue: string) => void
  isAdmin?: boolean
  onAdminUpdate?: (updates: { name?: string, jersey_number?: string, position?: string, previous_team?: string }) => Promise<{ error?: string }>
  onDelete?: () => void
  context?: "teams" | "continuations"
}
```

Key changes vs current props:
- Added `customJersey`, `customPosition`, `customPreviousTeam`, `customTeam`
- Replaced `onSaveName` with `onSaveAnnotations`
- Removed individual `onSaveName`

- [ ] **Step 2: Rewrite state and mode management**

Replace all the current state variables with:

```typescript
const [isEditing, setIsEditing] = useState(false)
const [nameValue, setNameValue] = useState(
  isAdmin ? (player.name ?? "") : (customName ?? player.name ?? "")
)
const [jerseyValue, setJerseyValue] = useState(
  isAdmin ? (player.jersey_number ?? "") : (customJersey ?? player.jersey_number ?? "")
)
const [positionValue, setPositionValue] = useState(
  isAdmin ? (player.position ?? "?") : (customPosition ?? player.position ?? "?")
)
const [previousTeamValue, setPreviousTeamValue] = useState(
  isAdmin ? (player.previous_team ?? "") : (customPreviousTeam ?? player.previous_team ?? "")
)
const [teamValue, setTeamValue] = useState(customTeam ?? "")
const [noteValue, setNoteValue] = useState(note ?? "")
const [showCorrectionPopup, setShowCorrectionPopup] = useState(false)
const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
const [showJerseyWarning, setShowJerseyWarning] = useState(false)
const [adminError, setAdminError] = useState<string | null>(null)
const [pendingCorrections, setPendingCorrections] = useState<{ fieldName: string, oldValue: string, newValue: string }[]>([])
const [pendingAdminUpdates, setPendingAdminUpdates] = useState<Record<string, string> | null>(null)
const noteSaved = useRef(false)

// Snapshot values at open time for change detection
const nameAtOpen = useRef(nameValue)
const jerseyAtOpen = useRef(jerseyValue)
const positionAtOpen = useRef(positionValue)
const previousTeamAtOpen = useRef(previousTeamValue)
const teamAtOpen = useRef(teamValue)

// Official DB values for correction comparison
const officialName = player.name ?? ""
const officialJersey = player.jersey_number ?? ""
const officialPosition = player.position ?? "?"
const officialPreviousTeam = player.previous_team ?? ""
```

- [ ] **Step 3: Implement Cancel handler**

```typescript
const handleCancel = () => {
  // Reset all values to what they were when sheet opened
  setNameValue(nameAtOpen.current)
  setJerseyValue(jerseyAtOpen.current)
  setPositionValue(positionAtOpen.current)
  setPreviousTeamValue(previousTeamAtOpen.current)
  setTeamValue(teamAtOpen.current)
  setAdminError(null)
  setIsEditing(false)
}
```

- [ ] **Step 4: Implement Save handler**

```typescript
const handleSave = async () => {
  if (isAdmin && onAdminUpdate) {
    // Admin: save directly to tryout_players
    const updates: { name?: string, jersey_number?: string, position?: string, previous_team?: string } = {}
    const trimmedName = nameValue.trim()
    const trimmedJersey = jerseyValue.trim()
    const trimmedPreviousTeam = previousTeamValue.trim()

    if (trimmedName && trimmedName !== officialName) updates.name = trimmedName
    if (trimmedJersey && trimmedJersey !== officialJersey) updates.jersey_number = trimmedJersey
    if (positionValue !== officialPosition) updates.position = positionValue
    if (trimmedPreviousTeam !== officialPreviousTeam) updates.previous_team = trimmedPreviousTeam || undefined

    if (Object.keys(updates).length > 0) {
      if (context === "continuations" && updates.jersey_number) {
        setPendingAdminUpdates(updates as Record<string, string>)
        setShowJerseyWarning(true)
        return
      }
      const result = await onAdminUpdate(updates)
      if (result.error) {
        setAdminError(result.error)
        return
      }
    }
    setIsEditing(false)
    onClose()
  } else {
    // Parent: save custom annotations
    const trimmedName = nameValue.trim()
    const trimmedJersey = jerseyValue.trim()
    const trimmedPreviousTeam = previousTeamValue.trim()
    const trimmedTeam = teamValue.trim()

    const annUpdates: Record<string, string | null> = {}
    // Only store custom values that differ from official
    annUpdates.customName = trimmedName && trimmedName !== officialName ? trimmedName : null
    annUpdates.customJersey = trimmedJersey && trimmedJersey !== officialJersey ? trimmedJersey : null
    annUpdates.customPosition = positionValue !== officialPosition ? positionValue : null
    annUpdates.customPreviousTeam = trimmedPreviousTeam && trimmedPreviousTeam !== officialPreviousTeam ? trimmedPreviousTeam : null
    annUpdates.customTeam = trimmedTeam || null

    onSaveAnnotations(annUpdates as {
      customName?: string | null
      customJersey?: string | null
      customPosition?: string | null
      customPreviousTeam?: string | null
      customTeam?: string | null
    })

    // Detect corrections: fields changed during this session AND differ from official
    const corrections: { fieldName: string, oldValue: string, newValue: string }[] = []
    if (trimmedName !== nameAtOpen.current && trimmedName && trimmedName !== officialName) {
      corrections.push({ fieldName: "name", oldValue: officialName, newValue: trimmedName })
    }
    if (trimmedJersey !== jerseyAtOpen.current && trimmedJersey && trimmedJersey !== officialJersey) {
      corrections.push({ fieldName: "jersey_number", oldValue: officialJersey, newValue: trimmedJersey })
    }
    if (positionValue !== positionAtOpen.current && positionValue !== officialPosition) {
      corrections.push({ fieldName: "position", oldValue: officialPosition, newValue: positionValue })
    }
    if (trimmedPreviousTeam !== previousTeamAtOpen.current && trimmedPreviousTeam !== officialPreviousTeam) {
      corrections.push({ fieldName: "previous_team", oldValue: officialPreviousTeam, newValue: trimmedPreviousTeam })
    }
    if (trimmedTeam !== teamAtOpen.current && trimmedTeam) {
      corrections.push({ fieldName: "team", oldValue: "", newValue: trimmedTeam })
    }

    if (corrections.length > 0) {
      setPendingCorrections(corrections)
      setShowCorrectionPopup(true)
    } else {
      setIsEditing(false)
      onClose()
    }
  }
}
```

- [ ] **Step 5: Update the Close handler**

The close button now only saves notes (no field save on close — that's handled by Save):

```typescript
const handleClose = () => {
  // Save note if changed
  if (noteValue !== (note ?? "") && !noteSaved.current) {
    onSaveNote(noteValue.trim())
  }
  onClose()
}
```

- [ ] **Step 6: Update correction popup field labels**

In the correction popup JSX, change the label from the hardcoded name/jersey to use the `fieldLabel` helper:

```typescript
function correctionFieldLabel(fieldName: string): string {
  const labels: Record<string, string> = {
    name: "Name",
    jersey_number: "Jersey #",
    position: "Position",
    previous_team: "Previous Team",
    team: "Team",
  }
  return labels[fieldName] ?? fieldName
}
```

Update the popup `<p>` to use it:
```tsx
<p key={c.fieldName} className="correction-popup-change">
  {correctionFieldLabel(c.fieldName)}: {c.oldValue} &rarr; {c.newValue}
</p>
```

- [ ] **Step 7: Rewrite the main JSX — read-only view**

The main return replaces the current layout. Here is the full component JSX (inside the return, after the jersey warning and correction popup early returns):

```tsx
return (
  <>
    <div className="long-press-overlay" onClick={handleClose} />
    <div className="detail-sheet">
      <div className="detail-sheet-handle" />

      {/* Header: Edit button | Title | Delete? | Close */}
      <div className="detail-sheet-header">
        <div className="detail-sheet-header-left">
          {!isEditing && (
            <button className="detail-sheet-edit-btn" onClick={() => setIsEditing(true)}>
              <Pencil size={16} />
            </button>
          )}
          <span className="detail-sheet-title">Player Details</span>
        </div>
        <div className="detail-sheet-header-actions">
          {isAdmin && onDelete && (
            <button className="detail-sheet-delete-btn" onClick={handleDeleteClick}>
              <Trash2 size={18} />
            </button>
          )}
          <button className="detail-sheet-close" onClick={handleClose}>
            <X size={18} />
          </button>
        </div>
      </div>

      {adminError && (
        <div className="detail-sheet-error">{adminError}</div>
      )}

      {/* Player info section */}
      {isEditing ? (
        <div className="detail-sheet-editable">
          <div className="detail-sheet-field">
            <label className="detail-sheet-field-label">Jersey Number</label>
            <input
              className="detail-sheet-input"
              type="text"
              value={jerseyValue}
              onChange={(e) => { setJerseyValue(e.target.value); setAdminError(null) }}
            />
          </div>
          <div className="detail-sheet-field">
            <label className="detail-sheet-field-label">Name</label>
            <input
              className="detail-sheet-input"
              type="text"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
            />
          </div>
          <div className="detail-sheet-field">
            <label className="detail-sheet-field-label">Position</label>
            <div className="detail-sheet-position-selector">
              {POSITIONS.map((pos) => (
                <button
                  key={pos}
                  className={
                    positionValue === pos
                      ? "detail-sheet-position-btn detail-sheet-position-btn-active"
                      : "detail-sheet-position-btn"
                  }
                  onClick={() => setPositionValue(pos)}
                >
                  {pos}
                </button>
              ))}
            </div>
          </div>
          <div className="detail-sheet-field">
            <label className="detail-sheet-field-label">Previous Team</label>
            <input
              className="detail-sheet-input"
              type="text"
              value={previousTeamValue}
              onChange={(e) => setPreviousTeamValue(e.target.value)}
              placeholder="e.g. U13 AA"
            />
          </div>
          {!isAdmin && (
            <div className="detail-sheet-field">
              <label className="detail-sheet-field-label">Team</label>
              <input
                className="detail-sheet-input"
                type="text"
                value={teamValue}
                onChange={(e) => setTeamValue(e.target.value)}
                placeholder="e.g. U15 A"
              />
            </div>
          )}
        </div>
      ) : (
        <div className="detail-sheet-readonly">
          <div className="detail-sheet-view-row">
            <span className="detail-sheet-view-jersey">#{jerseyValue}</span>
            <span className="detail-sheet-view-position">{positionValue !== "?" ? positionValue : ""}</span>
            <span className="detail-sheet-view-name">{nameValue || "Unknown"}</span>
          </div>
          <div className="detail-sheet-view-row">
            <span className="detail-sheet-field-label">Previous Team</span>
            <span className="detail-sheet-view-value">{previousTeamValue || "None"}</span>
          </div>
          {player.status === "made_team" && (
            <div className="detail-sheet-view-row">
              <span className="detail-sheet-field-label">Made Team</span>
              <span className="detail-sheet-value-highlight">Yes</span>
            </div>
          )}
        </div>
      )}

      {/* Always-editable: Heart + Notes */}
      <div className="detail-sheet-always-editable">
        <div className="detail-sheet-field">
          <button
            className={isFavorite ? "detail-sheet-heart detail-sheet-heart-active" : "detail-sheet-heart"}
            onClick={onToggleFavorite}
          >
            <Heart size={20} fill={isFavorite ? "currentColor" : "none"} />
            <span>{isFavorite ? "Favorited" : "Add to Favorites"}</span>
          </button>
        </div>
        <div className="detail-sheet-field">
          <label className="detail-sheet-field-label">Notes</label>
          <textarea
            className="detail-sheet-textarea"
            value={noteValue}
            onChange={(e) => setNoteValue(e.target.value)}
            onBlur={handleNoteBlur}
            placeholder="Add private notes..."
            rows={2}
          />
        </div>
      </div>

      {/* Save/Cancel for edit mode */}
      {isEditing && (
        <div className="detail-sheet-actions">
          <button className="detail-sheet-save-btn" onClick={handleSave}>
            Save
          </button>
          <button className="detail-sheet-cancel-btn" onClick={handleCancel}>
            Cancel
          </button>
        </div>
      )}

      {/* Delete confirm */}
      {showDeleteConfirm && (
        <div className="detail-sheet-delete-confirm">
          <p className="detail-sheet-delete-confirm-text">
            Delete #{player.jersey_number} {player.name}?
          </p>
          <div className="detail-sheet-delete-confirm-actions">
            <button className="detail-sheet-delete-confirm-yes" onClick={handleDeleteConfirm}>
              Delete
            </button>
            <button className="detail-sheet-delete-confirm-no" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  </>
)
```

- [ ] **Step 8: Add Pencil import**

Add `Pencil` to the lucide-react import:

```typescript
import { Heart, X, Trash2, Pencil } from "lucide-react"
```

- [ ] **Step 9: Verify build compiles (expect errors from callers)**

```bash
cd /home/data/Documents/webapps/tryout-track-master/frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: errors in files that call `LongPressMenu` with old props. Fixed in next tasks.

- [ ] **Step 10: Commit**

```bash
git add frontend/components/teams/long-press-menu.tsx
git commit -m "feat: rewrite detail sheet with read-only/edit modes and extended fields"
```

---

## Task 6: Update TeamsPageClient

**Files:**
- Modify: `frontend/components/teams/teams-page-client.tsx`

- [ ] **Step 1: Import shared type and new action**

Replace the local `Annotations` type and imports:

```typescript
import type { Annotations } from "@/types/annotations"
import {
  toggleFavorite, bulkToggleFavorite, savePlayerAnnotations, savePlayerNote
} from "@/app/(app)/annotations/actions"
```

Remove the old `import { saveCustomName }` and remove the inline `type Annotations = ...` definition.

- [ ] **Step 2: Update `handleToggleFavorite` default annotation shape**

Every place that creates a new annotation entry needs the 4 new null fields. Update `handleToggleFavorite`:

```typescript
return { ...prev, [playerId]: { isFavorite: true, notes: null, customName: null, customJersey: null, customPosition: null, customPreviousTeam: null, customTeam: null } }
```

Same for `handleBulkToggleFavorite`:
```typescript
next[id] = { isFavorite: setFavorite, notes: null, customName: null, customJersey: null, customPosition: null, customPreviousTeam: null, customTeam: null }
```

And `handleSaveNote`:
```typescript
return { ...prev, [playerId]: { isFavorite: false, notes: noteValue, customName: null, customJersey: null, customPosition: null, customPreviousTeam: null, customTeam: null } }
```

- [ ] **Step 3: Replace `handleSaveName` with `handleSaveAnnotations`**

```typescript
const handleSaveAnnotations = useCallback((playerId: string, annotations: {
  customName?: string | null
  customJersey?: string | null
  customPosition?: string | null
  customPreviousTeam?: string | null
  customTeam?: string | null
}) => {
  setAnnotations((prev) => {
    const existing = prev[playerId]
    const base = existing ?? { isFavorite: false, notes: null, customName: null, customJersey: null, customPosition: null, customPreviousTeam: null, customTeam: null }
    return {
      ...prev,
      [playerId]: {
        ...base,
        customName: annotations.customName !== undefined ? annotations.customName : base.customName,
        customJersey: annotations.customJersey !== undefined ? annotations.customJersey : base.customJersey,
        customPosition: annotations.customPosition !== undefined ? annotations.customPosition : base.customPosition,
        customPreviousTeam: annotations.customPreviousTeam !== undefined ? annotations.customPreviousTeam : base.customPreviousTeam,
        customTeam: annotations.customTeam !== undefined ? annotations.customTeam : base.customTeam,
      },
    }
  })
  savePlayerAnnotations(playerId, annotations)
}, [])
```

- [ ] **Step 4: Update LongPressMenu usage in JSX**

Replace the `<LongPressMenu>` block:

```tsx
{selectedPlayer && (
  <LongPressMenu
    player={selectedPlayer}
    isFavorite={selectedAnn?.isFavorite ?? false}
    customName={selectedAnn?.customName ?? null}
    customJersey={selectedAnn?.customJersey ?? null}
    customPosition={selectedAnn?.customPosition ?? null}
    customPreviousTeam={selectedAnn?.customPreviousTeam ?? null}
    customTeam={selectedAnn?.customTeam ?? null}
    note={selectedAnn?.notes ?? null}
    onClose={() => setSelectedPlayer(null)}
    onToggleFavorite={() => handleToggleFavorite(selectedPlayer.id)}
    onSaveAnnotations={(anns) => handleSaveAnnotations(selectedPlayer.id, anns)}
    onSaveNote={(note) => handleSaveNote(selectedPlayer.id, note)}
    onSubmitCorrection={(fieldName, oldValue, newValue) =>
      handleSubmitCorrection(selectedPlayer.id, fieldName, oldValue, newValue)
    }
    isAdmin={isAdmin}
    onAdminUpdate={(updates) => handleAdminUpdate(selectedPlayer.id, updates)}
    onDelete={() => handleDelete(selectedPlayer.id)}
  />
)}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/components/teams/teams-page-client.tsx
git commit -m "feat: update TeamsPageClient for extended annotations and new detail sheet props"
```

---

## Task 7: Update ContinuationsPageClient

**Files:**
- Modify: `frontend/components/continuations/continuations-page-client.tsx`

- [ ] **Step 1: Import shared type and new action**

Replace inline `Annotations` type:
```typescript
import type { Annotations } from "@/types/annotations"
```

Replace `saveCustomName` import with `savePlayerAnnotations`:
```typescript
import { savePlayerAnnotations, savePlayerNote } from "@/app/(app)/annotations/actions"
```

Remove the inline `type Annotations = ...` line.

- [ ] **Step 2: Update annotation default shapes**

Every place that creates a new annotation needs the 4 new null fields. In `handleToggleFavorite`:
```typescript
customName: existing?.customName ?? null,
customJersey: existing?.customJersey ?? null,
customPosition: existing?.customPosition ?? null,
customPreviousTeam: existing?.customPreviousTeam ?? null,
customTeam: existing?.customTeam ?? null,
```

Same for `handleSaveNote` fallback:
```typescript
return { ...prev, [playerId]: { isFavorite: false, notes: noteValue, customName: null, customJersey: null, customPosition: null, customPreviousTeam: null, customTeam: null } }
```

- [ ] **Step 3: Replace `handleSaveName` with `handleSaveAnnotations`**

Same pattern as TeamsPageClient:

```typescript
const handleSaveAnnotations = useCallback((playerId: string, annotations: {
  customName?: string | null
  customJersey?: string | null
  customPosition?: string | null
  customPreviousTeam?: string | null
  customTeam?: string | null
}) => {
  setAnnotations((prev) => {
    const existing = prev[playerId]
    const base = existing ?? { isFavorite: false, notes: null, customName: null, customJersey: null, customPosition: null, customPreviousTeam: null, customTeam: null }
    return {
      ...prev,
      [playerId]: {
        ...base,
        customName: annotations.customName !== undefined ? annotations.customName : base.customName,
        customJersey: annotations.customJersey !== undefined ? annotations.customJersey : base.customJersey,
        customPosition: annotations.customPosition !== undefined ? annotations.customPosition : base.customPosition,
        customPreviousTeam: annotations.customPreviousTeam !== undefined ? annotations.customPreviousTeam : base.customPreviousTeam,
        customTeam: annotations.customTeam !== undefined ? annotations.customTeam : base.customTeam,
      },
    }
  })
  savePlayerAnnotations(playerId, annotations)
}, [])
```

- [ ] **Step 4: Update LongPressMenu usage in JSX**

```tsx
{selectedPlayer && (
  <LongPressMenu
    player={selectedPlayer}
    isFavorite={selectedAnn?.isFavorite ?? false}
    customName={selectedAnn?.customName ?? null}
    customJersey={selectedAnn?.customJersey ?? null}
    customPosition={selectedAnn?.customPosition ?? null}
    customPreviousTeam={selectedAnn?.customPreviousTeam ?? null}
    customTeam={selectedAnn?.customTeam ?? null}
    note={selectedAnn?.notes ?? null}
    onClose={() => setSelectedPlayer(null)}
    onToggleFavorite={() => handleToggleFavorite(selectedPlayer.id)}
    onSaveAnnotations={(anns) => handleSaveAnnotations(selectedPlayer.id, anns)}
    onSaveNote={(note) => handleSaveNote(selectedPlayer.id, note)}
    onSubmitCorrection={(fieldName, oldValue, newValue) =>
      handleSubmitCorrection(selectedPlayer.id, fieldName, oldValue, newValue)
    }
    isAdmin={isAdmin}
    onAdminUpdate={isAdmin ? (updates) => handleAdminUpdate(selectedPlayer.id, updates) : undefined}
    context="continuations"
  />
)}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/components/continuations/continuations-page-client.tsx
git commit -m "feat: update ContinuationsPageClient for extended annotations"
```

---

## Task 8: Update MyFavouritesClient

**Files:**
- Modify: `frontend/components/dashboard/my-favourites-client.tsx`

- [ ] **Step 1: Import shared type and new action**

Replace `saveCustomName` import with `savePlayerAnnotations`:
```typescript
import { savePlayerAnnotations, savePlayerNote } from "@/app/(app)/annotations/actions"
```

- [ ] **Step 2: Replace `handleSaveName` with `handleSaveAnnotations`**

```typescript
const handleSaveAnnotations = useCallback((playerId: string, annotations: {
  customName?: string | null
  customJersey?: string | null
  customPosition?: string | null
  customPreviousTeam?: string | null
  customTeam?: string | null
}) => {
  setLocalFavourites((prev) =>
    prev.map((f) => {
      if (f.playerId !== playerId) return f
      const displayName = annotations.customName || f.playerRawName
      const originalName = annotations.customName && annotations.customName !== f.playerRawName ? f.playerRawName : null
      return { ...f, customName: annotations.customName ?? null, playerName: displayName, originalName }
    })
  )
  savePlayerAnnotations(playerId, annotations)
}, [])
```

- [ ] **Step 3: Update LongPressMenu usage**

```tsx
{selectedPlayer && (
  <LongPressMenu
    player={buildTryoutPlayer(selectedPlayer)}
    isFavorite={!unhearted.has(selectedPlayer.playerId)}
    customName={selectedPlayer.customName}
    customJersey={null}
    customPosition={null}
    customPreviousTeam={null}
    customTeam={null}
    note={selectedPlayer.notes}
    onClose={() => setSelectedPlayer(null)}
    onToggleFavorite={handleDetailSheetToggleFavorite}
    onSaveAnnotations={(anns) => handleSaveAnnotations(selectedPlayer.playerId, anns)}
    onSaveNote={(note) => handleSaveNote(selectedPlayer.playerId, note)}
    onSubmitCorrection={(fieldName, oldValue, newValue) =>
      handleSubmitCorrection(selectedPlayer.playerId, fieldName, oldValue, newValue)
    }
  />
)}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/components/dashboard/my-favourites-client.tsx
git commit -m "feat: update MyFavouritesClient for extended detail sheet"
```

---

## Task 9: Update Pass-Through Components (Annotations Type)

**Files:**
- Modify: `frontend/components/teams/prediction-board.tsx`
- Modify: `frontend/components/teams/previous-teams-view.tsx`
- Modify: `frontend/components/teams/team-section.tsx`
- Modify: `frontend/components/continuations/round-section.tsx`

These files all define their own inline `Annotations` type. Replace each with the shared import.

- [ ] **Step 1: In each file, find the inline type**

```typescript
type Annotations = Record<string, { isFavorite: boolean, notes: string | null, customName: string | null }>
```

Replace with:
```typescript
import type { Annotations } from "@/types/annotations"
```

And remove the inline `type Annotations = ...` line.

Do this in all 4 files.

- [ ] **Step 2: Update `team-section.tsx` to pass new fields to PlayerRow**

In team-section.tsx, where it passes annotation data to `PlayerRow`, add the new props:

```tsx
<PlayerRow
  ...existing props...
  customJersey={ann?.customJersey}
  customPosition={ann?.customPosition}
/>
```

- [ ] **Step 3: Update `round-section.tsx` to pass new fields to ContinuationPlayerRow**

Same pattern — pass `customJersey` and `customPosition` to `ContinuationPlayerRow`.

- [ ] **Step 4: Update `previous-teams-view.tsx` to pass new fields**

In the PreviousTeamSection where it renders `PlayerRow`, pass:
```tsx
customJersey={ann?.customJersey}
customPosition={ann?.customPosition}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/components/teams/prediction-board.tsx frontend/components/teams/previous-teams-view.tsx frontend/components/teams/team-section.tsx frontend/components/continuations/round-section.tsx
git commit -m "refactor: use shared Annotations type in pass-through components"
```

---

## Task 10: Update Player Row Components

**Files:**
- Modify: `frontend/components/teams/player-row.tsx`
- Modify: `frontend/components/continuations/continuation-player-row.tsx`

- [ ] **Step 1: Update `PlayerRow` props and display**

Add new optional props:
```typescript
type PlayerRowProps = {
  player: TryoutPlayer
  isLocked: boolean
  isFavorite?: boolean
  isSuggested?: boolean
  customName?: string | null
  customJersey?: string | null
  customPosition?: string | null
  noteText?: string | null
  onEdit?: (player: TryoutPlayer) => void
  onToggleFavorite?: () => void
}
```

Update display logic for jersey:
```typescript
const displayJersey = customJersey || player.jersey_number
```

Update display logic for position:
```typescript
const displayPosition = customPosition || player.position
```

Update JSX:
- Jersey: `<span className="player-jersey">#{displayJersey}</span>`
- Position: use `displayPosition` instead of `player.position`

- [ ] **Step 2: Update `ContinuationPlayerRow` props and display**

Add `customJersey` and `customPosition` optional props:
```typescript
customJersey?: string | null
customPosition?: string | null
```

Update display:
```typescript
const displayJersey = customJersey || jerseyNumber
const displayPosition = player ? (customPosition || player.position) : null
```

Update JSX to use `displayJersey` and `displayPosition`.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/teams/player-row.tsx frontend/components/continuations/continuation-player-row.tsx
git commit -m "feat: display custom jersey and position annotations in player rows"
```

---

## Task 11: Add CSS Styles

**Files:**
- Modify: `frontend/app/globals.css`

- [ ] **Step 1: Add new detail sheet styles**

Add after the existing `.detail-sheet-delete-confirm-no` block (around line 3250):

```css
.detail-sheet-header-left {
  @apply flex items-center gap-2;
}

.detail-sheet-edit-btn {
  @apply flex h-8 w-8 items-center justify-center rounded-full;
  color: var(--dm-gold);
  background: oklch(1 0 0 / 5%);
  border: none;
  cursor: pointer;
}

.detail-sheet-edit-btn:hover {
  background: oklch(1 0 0 / 10%);
}

.detail-sheet-always-editable {
  @apply flex flex-col gap-4 mt-4;
}

.detail-sheet-actions {
  @apply flex gap-3 mt-4;
}

.detail-sheet-save-btn {
  @apply flex-1 rounded-lg py-2.5 text-sm font-semibold;
  background: var(--dm-gold);
  color: oklch(0.15 0 0);
  border: none;
  cursor: pointer;
}

.detail-sheet-save-btn:hover {
  filter: brightness(1.1);
}

.detail-sheet-cancel-btn {
  @apply flex-1 rounded-lg py-2.5 text-sm font-semibold;
  background: oklch(1 0 0 / 8%);
  color: var(--dm-dust);
  border: none;
  cursor: pointer;
}

.detail-sheet-cancel-btn:hover {
  background: oklch(1 0 0 / 12%);
}

.detail-sheet-view-row {
  @apply flex items-center gap-2 py-1;
}

.detail-sheet-view-jersey {
  @apply text-base font-bold;
  color: var(--dm-gold);
}

.detail-sheet-view-position {
  @apply text-xs font-bold uppercase rounded px-1.5 py-0.5;
  background: oklch(1 0 0 / 8%);
  color: var(--dm-dust);
}

.detail-sheet-view-name {
  @apply text-base font-semibold;
  color: var(--dm-umber);
}

.detail-sheet-view-value {
  @apply text-sm;
  color: var(--dm-umber);
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/globals.css
git commit -m "style: add CSS for detail sheet read-only/edit modes"
```

---

## Task 12: Build, Lint, Final Verification

- [ ] **Step 1: Run TypeScript check**

```bash
cd /home/data/Documents/webapps/tryout-track-master/frontend && npx tsc --noEmit
```

Fix any remaining type errors.

- [ ] **Step 2: Run build**

```bash
cd /home/data/Documents/webapps/tryout-track-master/frontend && npm run build
```

- [ ] **Step 3: Run lint**

```bash
cd /home/data/Documents/webapps/tryout-track-master/frontend && npm run lint
```

- [ ] **Step 4: Start dev server for Playwright testing**

```bash
cd /home/data/Documents/webapps/tryout-track-master/frontend && npm run dev
```

- [ ] **Step 5: Run Playwright tests from spec 024**

Follow every test in the spec's Playwright Test Plan section. Navigate, snapshot, verify.

- [ ] **Step 6: Revert test mutations**

Check the Test Mutations Log in the spec and undo every data change.

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat: player detail form redesign — read-only/edit modes with extended annotations (spec 024)"
```
