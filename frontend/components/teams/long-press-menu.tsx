"use client"

import { useState, useRef, useEffect } from "react"
import { Heart, X } from "lucide-react"
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
}

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
}: LongPressMenuProps) {
  const [nameValue, setNameValue] = useState(customName ?? player.name ?? "")
  const [jerseyValue, setJerseyValue] = useState(player.jersey_number ?? "")
  const [noteValue, setNoteValue] = useState(note ?? "")
  const [showCorrectionPopup, setShowCorrectionPopup] = useState(false)
  const [pendingCorrections, setPendingCorrections] = useState<{ fieldName: string, oldValue: string, newValue: string }[]>([])
  const noteSaved = useRef(false)

  // Capture values at mount time for correction detection
  const nameAtOpen = useRef(customName ?? player.name ?? "")
  const jerseyAtOpen = useRef(player.jersey_number ?? "")

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

  const handleClose = () => {
    // Save note if changed
    if (noteValue !== (note ?? "") && !noteSaved.current) {
      onSaveNote(noteValue.trim())
    }

    // Save custom name if changed from what it was when opened
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

  // Correction popup
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

        {/* Header with close button */}
        <div className="detail-sheet-header">
          <span className="detail-sheet-title">Player Details</span>
          <button className="detail-sheet-close" onClick={handleClose}>
            <X size={18} />
          </button>
        </div>

        {/* Editable section */}
        <div className="detail-sheet-editable">
          <div className="detail-sheet-field">
            <label className="detail-sheet-field-label">Jersey Number</label>
            <input
              className="detail-sheet-input"
              type="text"
              value={jerseyValue}
              onChange={(e) => setJerseyValue(e.target.value)}
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

        {/* Read-only section */}
        <div className="detail-sheet-readonly">
          <div className="detail-sheet-field">
            <label className="detail-sheet-field-label">Position</label>
            <span className="detail-sheet-value">{player.position || "Unknown"}</span>
          </div>

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
        </div>
      </div>
    </>
  )
}
