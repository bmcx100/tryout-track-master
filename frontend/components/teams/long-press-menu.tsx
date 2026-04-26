"use client"

import { useState, useRef, useEffect } from "react"
import { Heart, X, Trash2, Pencil } from "lucide-react"
import type { TryoutPlayer } from "@/types"

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
  onAdminUpdate?: (updates: { name?: string, jersey_number?: string, position?: string, previous_team?: string, status?: string }) => Promise<{ error?: string }>
  onDelete?: () => void
  context?: "teams" | "continuations"
  teams?: { id: string, name: string }[]
}

const POSITIONS = ["F", "D", "G"]
const DIVISION_ORDER = ["U18", "U15", "U13", "U11", "U9"]
const LEVEL_ORDER = ["AA", "A", "BB", "B", "C"]

function getPreviousTeamGroups(division: string | null): { division: string, options: string[] }[] {
  const divIndex = DIVISION_ORDER.indexOf(division ?? "")
  if (divIndex === -1) return []
  const divisions = [DIVISION_ORDER[divIndex]]
  if (divIndex + 1 < DIVISION_ORDER.length) {
    divisions.push(DIVISION_ORDER[divIndex + 1])
  }
  return divisions.map((div) => ({
    division: div,
    options: LEVEL_ORDER.map((lvl) => `${div}${lvl}`),
  }))
}

function normalizePreviousTeam(value: string): string {
  return value.replace(/^(U\d+)\s+/i, "$1")
}

const STATUS_OPTIONS = [
  { value: "trying_out", label: "Trying Out" },
  { value: "made_team", label: "Made Team" },
  { value: "withdrew", label: "Withdrew" },
]

const STATUS_LABELS: Record<string, string> = {
  trying_out: "Trying Out",
  made_team: "Made Team",
  withdrew: "Withdrew",
  cut: "Cut",
  moved_up: "Moved Up",
  moved_down: "Moved Down",
  registered: "Registered",
}

function fieldLabel(fieldName: string): string {
  switch (fieldName) {
    case "name": return "Name"
    case "jersey_number": return "Jersey #"
    case "position": return "Position"
    case "previous_team": return "Previous Team"
    case "team": return "Team"
    default: return fieldName
  }
}

export function LongPressMenu({
  player,
  isFavorite,
  customName,
  customJersey,
  customPosition,
  customPreviousTeam,
  customTeam,
  note,
  onClose,
  onToggleFavorite,
  onSaveAnnotations,
  onSaveNote,
  onSubmitCorrection,
  isAdmin = false,
  onAdminUpdate,
  onDelete,
  context = "teams",
}: LongPressMenuProps) {
  const [editing, setEditing] = useState(false)
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
    normalizePreviousTeam(isAdmin ? (player.previous_team ?? "") : (customPreviousTeam ?? player.previous_team ?? ""))
  )
  const [statusValue, setStatusValue] = useState(
    isAdmin ? (player.status ?? "trying_out") : (customTeam || player.status || "trying_out")
  )
  const [noteValue, setNoteValue] = useState(note ?? "")
  const previousTeamGroups = getPreviousTeamGroups(player.division ?? null)
  const previousTeamOptions = previousTeamGroups.flatMap((g) => g.options)
  const [previousTeamCustom, setPreviousTeamCustom] = useState(
    previousTeamValue !== "" && !previousTeamOptions.includes(previousTeamValue)
  )
  const [showCorrectionPopup, setShowCorrectionPopup] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showJerseyWarning, setShowJerseyWarning] = useState(false)
  const [adminError, setAdminError] = useState<string | null>(null)
  const [pendingCorrections, setPendingCorrections] = useState<{ fieldName: string, oldValue: string, newValue: string }[]>([])
  const [pendingAdminUpdates, setPendingAdminUpdates] = useState<Record<string, string> | null>(null)
  const noteSaved = useRef(false)

  // Official DB values for correction comparison
  const officialName = player.name ?? ""
  const officialJersey = player.jersey_number ?? ""
  const officialPosition = player.position ?? "?"
  const officialPreviousTeam = player.previous_team ?? ""

  // Lock body scroll while detail sheet is open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const handleNoteBlur = () => {
    if (noteValue !== (note ?? "")) {
      onSaveNote(noteValue.trim())
      noteSaved.current = true
    }
  }

  const handleCancel = () => {
    // Reset all values to what they were when the sheet opened
    setNameValue(isAdmin ? (player.name ?? "") : (customName ?? player.name ?? ""))
    setJerseyValue(isAdmin ? (player.jersey_number ?? "") : (customJersey ?? player.jersey_number ?? ""))
    setPositionValue(isAdmin ? (player.position ?? "?") : (customPosition ?? player.position ?? "?"))
    const resetPrevTeam = normalizePreviousTeam(isAdmin ? (player.previous_team ?? "") : (customPreviousTeam ?? player.previous_team ?? ""))
    setPreviousTeamValue(resetPrevTeam)
    setPreviousTeamCustom(resetPrevTeam !== "" && !previousTeamOptions.includes(resetPrevTeam))
    setStatusValue(isAdmin ? (player.status ?? "trying_out") : (customTeam || player.status || "trying_out"))
    setAdminError(null)
    setEditing(false)
  }

  const handleSave = async () => {
    if (isAdmin && onAdminUpdate) {
      // Admin mode: save directly to tryout_players
      const updates: { name?: string, jersey_number?: string, position?: string, previous_team?: string, status?: string } = {}
      const trimmedName = nameValue.trim()
      const trimmedJersey = jerseyValue.trim()
      const trimmedPreviousTeam = previousTeamValue.trim()

      if (trimmedName && trimmedName !== officialName) {
        updates.name = trimmedName
      }
      if (trimmedJersey && trimmedJersey !== officialJersey) {
        updates.jersey_number = trimmedJersey
      }
      if (positionValue !== officialPosition) {
        updates.position = positionValue
      }
      if (trimmedPreviousTeam !== officialPreviousTeam) {
        updates.previous_team = trimmedPreviousTeam || undefined
      }
      if (statusValue !== (player.status ?? "trying_out")) {
        updates.status = statusValue
      }

      if (Object.keys(updates).length > 0) {
        // In continuations context, warn if jersey number is changing
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
      setEditing(false)
      onClose()
    } else {
      // Parent mode: save custom annotations
      const trimmedName = nameValue.trim()
      const trimmedJersey = jerseyValue.trim()
      const trimmedPreviousTeam = previousTeamValue.trim()
      const annots: Record<string, string | null> = {}
      // Save custom values (null if same as official)
      annots.customName = trimmedName && trimmedName !== officialName ? trimmedName : null
      annots.customJersey = trimmedJersey && trimmedJersey !== officialJersey ? trimmedJersey : null
      annots.customPosition = positionValue !== officialPosition ? positionValue : null
      annots.customPreviousTeam = trimmedPreviousTeam && trimmedPreviousTeam !== officialPreviousTeam ? trimmedPreviousTeam : null
      // Save status to customTeam annotation (null if same as official status)
      annots.customTeam = statusValue !== (player.status ?? "trying_out") ? statusValue : null

      onSaveAnnotations(annots)

      // Detect corrections: compare current values to official DB values
      // Status changes do NOT trigger corrections — status is a personal annotation
      const corrections: { fieldName: string, oldValue: string, newValue: string }[] = []
      if (trimmedName && trimmedName !== officialName) {
        corrections.push({ fieldName: "name", oldValue: officialName, newValue: trimmedName })
      }
      if (trimmedJersey && trimmedJersey !== officialJersey) {
        corrections.push({ fieldName: "jersey_number", oldValue: officialJersey, newValue: trimmedJersey })
      }
      if (positionValue !== officialPosition && positionValue !== "?") {
        corrections.push({ fieldName: "position", oldValue: officialPosition, newValue: positionValue })
      }
      if (trimmedPreviousTeam && trimmedPreviousTeam !== officialPreviousTeam) {
        corrections.push({ fieldName: "previous_team", oldValue: officialPreviousTeam, newValue: trimmedPreviousTeam })
      }

      if (corrections.length > 0) {
        setPendingCorrections(corrections)
        setShowCorrectionPopup(true)
      } else {
        setEditing(false)
        onClose()
      }
    }
  }

  const handleClose = () => {
    // Save note if changed
    if (noteValue !== (note ?? "") && !noteSaved.current) {
      onSaveNote(noteValue.trim())
    }
    onClose()
  }

  const handleSubmitCorrections = () => {
    for (const c of pendingCorrections) {
      onSubmitCorrection(c.fieldName, c.oldValue, c.newValue)
    }
    setShowCorrectionPopup(false)
    onClose()
  }

  const handleSkipCorrections = () => {
    setShowCorrectionPopup(false)
    onClose()
  }

  const handleJerseyWarningConfirm = async () => {
    if (pendingAdminUpdates && onAdminUpdate) {
      const result = await onAdminUpdate(pendingAdminUpdates)
      if (result.error) {
        setShowJerseyWarning(false)
        setAdminError(result.error)
        return
      }
    }
    setShowJerseyWarning(false)
    onClose()
  }

  const handleJerseyWarningCancel = () => {
    setShowJerseyWarning(false)
    setPendingAdminUpdates(null)
  }

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true)
  }

  const handleDeleteConfirm = () => {
    setShowDeleteConfirm(false)
    onDelete?.()
  }

  // Display values (show custom when available, for read-only mode)
  const displayJersey = isAdmin ? (player.jersey_number ?? "") : (customJersey ?? player.jersey_number ?? "")
  const displayName = isAdmin ? (player.name ?? "") : (customName ?? player.name ?? "")
  const displayPosition = isAdmin ? (player.position ?? "?") : (customPosition ?? player.position ?? "?")
  const displayPreviousTeam = isAdmin ? (player.previous_team ?? "") : (customPreviousTeam ?? player.previous_team ?? "")
  // Effective status: annotation overrides DB status
  const effectiveStatus = customTeam || player.status || "trying_out"

  // Jersey warning popup (admin in continuations context)
  if (showJerseyWarning) {
    return (
      <>
        <div className="long-press-overlay" onClick={handleJerseyWarningCancel} />
        <div className="jersey-warning-popup">
          <h3 className="jersey-warning-popup-title">Change jersey&nbsp;number?</h3>
          <p className="jersey-warning-popup-text">
            Changing the jersey number will cause this player to no longer
            match #{officialJersey} on the imported
            continuations&nbsp;list.
          </p>
          <div className="jersey-warning-popup-actions">
            <button className="jersey-warning-popup-confirm" onClick={handleJerseyWarningConfirm}>
              Change Anyway
            </button>
            <button className="jersey-warning-popup-cancel" onClick={handleJerseyWarningCancel}>
              Cancel
            </button>
          </div>
        </div>
      </>
    )
  }

  // Correction popup (parent only)
  if (showCorrectionPopup) {
    return (
      <>
        <div className="long-press-overlay" onClick={handleSkipCorrections} />
        <div className="correction-popup">
          <h3 className="correction-popup-title">Submit correction to&nbsp;admin?</h3>
          <div className="correction-popup-changes">
            {pendingCorrections.map((c) => (
              <p key={c.fieldName} className="correction-popup-change">
                {fieldLabel(c.fieldName)}: {c.oldValue || "(none)"} &rarr; {c.newValue}
              </p>
            ))}
          </div>
          <div className="correction-popup-actions">
            <button className="correction-popup-submit" onClick={handleSubmitCorrections}>
              Submit
            </button>
            <button className="correction-popup-skip" onClick={handleSkipCorrections}>
              Skip
            </button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="long-press-overlay" onClick={handleClose} />
      <div className="detail-sheet">
        <div className="detail-sheet-handle" />

        {/* Header: name + position badge, edit, close */}
        <div className="detail-sheet-header">
          <div className="detail-sheet-header-left">
            <span className="detail-sheet-title">{displayName}</span>
            {displayPosition && displayPosition !== "?" && (
              <span className="detail-sheet-view-position">{displayPosition}</span>
            )}
          </div>
          <div className="detail-sheet-header-actions">
            {isAdmin && onDelete && (
              <button className="detail-sheet-delete-btn" onClick={handleDeleteClick}>
                <Trash2 size={18} />
              </button>
            )}
            {!editing && (
              <button className="detail-sheet-edit-btn" onClick={() => setEditing(true)}>
                <Pencil size={14} />
                <span>Edit</span>
              </button>
            )}
            <button className="detail-sheet-close" onClick={handleClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Admin error message */}
        {adminError && (
          <div className="detail-sheet-error">{adminError}</div>
        )}

        {editing ? (
          /* ── Edit Mode ── */
          <>
            <div className="detail-sheet-editable">
              <div className="detail-sheet-edit-row-spread">
                <div className="detail-sheet-field-inline">
                  <label className="detail-sheet-field-label">Name</label>
                  <input
                    className="detail-sheet-input"
                    type="text"
                    value={nameValue}
                    onChange={(e) => setNameValue(e.target.value)}
                  />
                </div>

                <button
                  className={isFavorite ? "detail-sheet-heart-icon detail-sheet-heart-icon-active" : "detail-sheet-heart-icon"}
                  onClick={onToggleFavorite}
                >
                  <Heart size={20} fill={isFavorite ? "currentColor" : "none"} />
                </button>
              </div>

              <div className="detail-sheet-edit-row-spaced">
                <div className="detail-sheet-field">
                  <label className="detail-sheet-field-label">Number</label>
                  <input
                    className="detail-sheet-input detail-sheet-input-narrow"
                    type="text"
                    value={jerseyValue}
                    onChange={(e) => { setJerseyValue(e.target.value); setAdminError(null) }}
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
              </div>

              <div className="detail-sheet-edit-row">
                <div className="detail-sheet-field detail-sheet-field-half">
                  <label className="detail-sheet-field-label">Previous Team</label>
                  {previousTeamOptions.length > 0 && !previousTeamCustom ? (
                    <select
                      className="detail-sheet-select"
                      value={previousTeamOptions.includes(previousTeamValue) ? previousTeamValue : ""}
                      onChange={(e) => {
                        if (e.target.value === "__custom__") {
                          setPreviousTeamCustom(true)
                          setPreviousTeamValue("")
                        } else {
                          setPreviousTeamValue(e.target.value)
                        }
                      }}
                    >
                      <option value="" disabled>Select team</option>
                      {previousTeamGroups.map((group) => (
                        <optgroup key={group.division} label={group.division}>
                          {group.options.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </optgroup>
                      ))}
                      <option value="__custom__">Custom...</option>
                    </select>
                  ) : (
                    <input
                      className="detail-sheet-input"
                      type="text"
                      value={previousTeamValue}
                      onChange={(e) => setPreviousTeamValue(e.target.value)}
                      placeholder="e.g. U13AA"
                      autoFocus
                    />
                  )}
                </div>

                <div className="detail-sheet-field detail-sheet-field-half">
                  <label className="detail-sheet-field-label">Status</label>
                  <select
                    className="detail-sheet-select"
                    value={statusValue}
                    onChange={(e) => setStatusValue(e.target.value)}
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Notes — always editable */}
            <div className="detail-sheet-field detail-sheet-field-mb">
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

            {/* Save / Cancel actions */}
            <div className="detail-sheet-actions">
              <button className="detail-sheet-save-btn" onClick={handleSave}>
                Save
              </button>
              <button className="detail-sheet-cancel-btn" onClick={handleCancel}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          /* ── Read-Only Mode ── */
          <>
            {/* Jersey + heart row */}
            <div className="detail-sheet-jersey-heart-row">
              <span className="detail-sheet-view-jersey">#{displayJersey}</span>
              <button
                className={isFavorite ? "detail-sheet-heart-icon detail-sheet-heart-icon-active" : "detail-sheet-heart-icon"}
                onClick={onToggleFavorite}
              >
                <Heart size={20} fill={isFavorite ? "currentColor" : "none"} />
              </button>
            </div>

            {/* Previous Team + Status on one row */}
            <div className="detail-sheet-info-row">
              <div className="detail-sheet-info-col">
                <label className="detail-sheet-field-label">Previous Team</label>
                <span className="detail-sheet-info-value">{displayPreviousTeam || "None"}</span>
              </div>
              <div className="detail-sheet-info-col">
                <label className="detail-sheet-field-label">Status</label>
                <span className="detail-sheet-info-value">{STATUS_LABELS[effectiveStatus] || effectiveStatus || "Unknown"}</span>
              </div>
            </div>

            {/* Notes — always editable */}
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
          </>
        )}

        {/* Delete confirmation overlay */}
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
}
