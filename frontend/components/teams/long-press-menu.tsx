"use client"

import { useState, useRef, useEffect } from "react"
import { Heart, X, Trash2 } from "lucide-react"
import type { TryoutPlayer } from "@/types"

type LongPressMenuProps = {
  player: TryoutPlayer
  isFavorite: boolean
  customName: string | null
  note: string | null
  onClose: () => void
  onToggleFavorite: () => void
  onSaveName: (name: string) => void
  onSaveNote: (note: string) => void
  onSubmitCorrection: (fieldName: string, oldValue: string, newValue: string) => void
  isAdmin?: boolean
  onAdminUpdate?: (updates: { name?: string, jersey_number?: string, position?: string, previous_team?: string }) => Promise<{ error?: string }>
  onDelete?: () => void
  context?: "teams" | "continuations"
}

const POSITIONS = ["F", "D", "G"]

export function LongPressMenu({
  player,
  isFavorite,
  customName,
  note,
  onClose,
  onToggleFavorite,
  onSaveName,
  onSaveNote,
  onSubmitCorrection,
  isAdmin = false,
  onAdminUpdate,
  onDelete,
  context = "teams",
}: LongPressMenuProps) {
  const [nameValue, setNameValue] = useState(
    isAdmin ? (player.name ?? "") : (customName ?? player.name ?? "")
  )
  const [jerseyValue, setJerseyValue] = useState(player.jersey_number ?? "")
  const [positionValue, setPositionValue] = useState(player.position ?? "?")
  const [previousTeamValue, setPreviousTeamValue] = useState(player.previous_team ?? "")
  const [noteValue, setNoteValue] = useState(note ?? "")
  const [showCorrectionPopup, setShowCorrectionPopup] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showJerseyWarning, setShowJerseyWarning] = useState(false)
  const [adminError, setAdminError] = useState<string | null>(null)
  const [pendingCorrections, setPendingCorrections] = useState<{ fieldName: string, oldValue: string, newValue: string }[]>([])
  const [pendingAdminUpdates, setPendingAdminUpdates] = useState<Record<string, string> | null>(null)
  const noteSaved = useRef(false)

  // Capture values at mount time for correction detection
  const nameAtOpen = useRef(isAdmin ? (player.name ?? "") : (customName ?? player.name ?? ""))
  const jerseyAtOpen = useRef(player.jersey_number ?? "")
  const previousTeamAtOpen = useRef(player.previous_team ?? "")

  // Official DB values for correction submission
  const officialName = player.name ?? ""
  const officialJersey = player.jersey_number ?? ""

  // Lock body scroll while detail sheet is open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const handleClose = async () => {
    // Save note if changed
    if (noteValue !== (note ?? "") && !noteSaved.current) {
      onSaveNote(noteValue.trim())
    }

    if (isAdmin && onAdminUpdate) {
      // Admin mode: collect changed fields and save directly
      const updates: { name?: string, jersey_number?: string, position?: string, previous_team?: string } = {}
      const trimmedName = nameValue.trim()
      const trimmedJersey = jerseyValue.trim()
      const trimmedPreviousTeam = previousTeamValue.trim()

      if (trimmedName && trimmedName !== officialName) {
        updates.name = trimmedName
      }
      if (trimmedJersey && trimmedJersey !== officialJersey) {
        updates.jersey_number = trimmedJersey
      }
      if (positionValue !== (player.position ?? "?")) {
        updates.position = positionValue
      }
      if (trimmedPreviousTeam !== previousTeamAtOpen.current) {
        updates.previous_team = trimmedPreviousTeam || undefined
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
      onClose()
    } else {
      // Parent mode: save custom name if changed from what it was when opened
      const trimmedName = nameValue.trim()
      if (trimmedName !== nameAtOpen.current) {
        onSaveName(trimmedName === officialName ? "" : trimmedName)
      }

      // Detect corrections: user changed value during this session AND it differs from official
      const corrections: { fieldName: string, oldValue: string, newValue: string }[] = []
      if (trimmedName !== nameAtOpen.current && trimmedName && trimmedName !== officialName) {
        corrections.push({ fieldName: "name", oldValue: officialName, newValue: trimmedName })
      }
      const trimmedJersey = jerseyValue.trim()
      if (trimmedJersey !== jerseyAtOpen.current && trimmedJersey && trimmedJersey !== officialJersey) {
        corrections.push({ fieldName: "jersey_number", oldValue: officialJersey, newValue: trimmedJersey })
      }

      if (corrections.length > 0) {
        setPendingCorrections(corrections)
        setShowCorrectionPopup(true)
      } else {
        onClose()
      }
    }
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

  const handleNoteBlur = () => {
    if (noteValue !== (note ?? "")) {
      onSaveNote(noteValue.trim())
      noteSaved.current = true
    }
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
                {c.fieldName === "name" ? "Name" : "Jersey #"}: {c.oldValue} &rarr; {c.newValue}
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

        {/* Header with close button and optional delete */}
        <div className="detail-sheet-header">
          <span className="detail-sheet-title">Player Details</span>
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

        {/* Admin error message */}
        {adminError && (
          <div className="detail-sheet-error">{adminError}</div>
        )}

        {/* Editable section */}
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
            <label className="detail-sheet-field-label">Favorite</label>
            <button
              className={isFavorite ? "detail-sheet-heart detail-sheet-heart-active" : "detail-sheet-heart"}
              onClick={onToggleFavorite}
            >
              <Heart size={20} fill={isFavorite ? "currentColor" : "none"} />
              <span>{isFavorite ? "Favorited" : "Add to Favorites"}</span>
            </button>
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
            <label className="detail-sheet-field-label">Notes</label>
            <textarea
              className="detail-sheet-textarea"
              value={noteValue}
              onChange={(e) => setNoteValue(e.target.value)}
              onBlur={handleNoteBlur}
              placeholder="Add private notes..."
              rows={3}
            />
          </div>
        </div>

        {/* Position — editable for admin, read-only for parent */}
        <div className={isAdmin ? "detail-sheet-editable" : "detail-sheet-readonly"}>
          <div className="detail-sheet-field">
            <label className="detail-sheet-field-label">Position</label>
            {isAdmin ? (
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
            ) : (
              <span className="detail-sheet-value">{player.position || "Unknown"}</span>
            )}
          </div>

          {!isAdmin && (
            <>
              <div className="detail-sheet-field">
                <label className="detail-sheet-field-label">Previous Team</label>
                <span className="detail-sheet-value">{player.previous_team || "None"}</span>
              </div>

              {player.status === "made_team" && (
                <div className="detail-sheet-field">
                  <label className="detail-sheet-field-label">Made Team</label>
                  <span className="detail-sheet-value detail-sheet-value-highlight">Yes</span>
                </div>
              )}
            </>
          )}

          {isAdmin && (
            <>
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

              {player.status === "made_team" && (
                <div className="detail-sheet-field">
                  <label className="detail-sheet-field-label">Made Team</label>
                  <span className="detail-sheet-value detail-sheet-value-highlight">Yes</span>
                </div>
              )}
            </>
          )}
        </div>

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
