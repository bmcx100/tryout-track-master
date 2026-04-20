"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { adminCreatePlayer } from "@/app/(app)/players/actions"
import {
  createSuggestedPlayer,
  submitSuggestedPlayer,
} from "@/app/(app)/continuations/actions"

type AddPlayerSheetProps = {
  jerseyNumber: string
  division: string
  associationId: string
  isAdmin: boolean
  onSave: (playerId: string) => void
  onClose: () => void
}

export function AddPlayerSheet({
  jerseyNumber,
  division,
  associationId,
  isAdmin,
  onSave,
  onClose,
}: AddPlayerSheetProps) {
  const [jersey, setJersey] = useState(jerseyNumber)
  const [name, setName] = useState("")
  const [position, setPosition] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showSubmitPopup, setShowSubmitPopup] = useState(false)
  const [savedPlayerId, setSavedPlayerId] = useState<string | null>(null)

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Name is required")
      return
    }
    if (!position) {
      setError("Position is required")
      return
    }
    if (!jersey.trim()) {
      setError("Jersey number is required")
      return
    }

    setSaving(true)
    setError(null)

    if (isAdmin) {
      const result = await adminCreatePlayer({
        association_id: associationId,
        division,
        jersey_number: jersey.trim(),
        name: name.trim(),
        position,
      })
      if (result.error) {
        setError(result.error)
        setSaving(false)
        return
      }
      onSave(result.playerId!)
    } else {
      const result = await createSuggestedPlayer({
        association_id: associationId,
        division,
        jersey_number: jersey.trim(),
        name: name.trim(),
        position,
      })
      if (result.error) {
        setError(result.error)
        setSaving(false)
        return
      }
      setSavedPlayerId(result.playerId!)
      setShowSubmitPopup(true)
      setSaving(false)
    }
  }

  const handleSubmit = async () => {
    if (!savedPlayerId) return
    await submitSuggestedPlayer(savedPlayerId)
    onSave(savedPlayerId)
  }

  const handleSkip = () => {
    if (!savedPlayerId) return
    onSave(savedPlayerId)
  }

  return (
    <>
      <div className="player-picker-overlay" onClick={onClose} />
      <div className="add-player-sheet">
        <div className="detail-sheet-handle" />
        <div className="detail-sheet-header">
          <span className="detail-sheet-title">Add Player</span>
          <button className="detail-sheet-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="detail-sheet-editable">
          <div className="detail-sheet-field">
            <label className="detail-sheet-field-label">Jersey Number</label>
            <input
              className="detail-sheet-input"
              type="text"
              value={jersey}
              onChange={(e) => setJersey(e.target.value)}
            />
          </div>

          <div className="detail-sheet-field">
            <label className="detail-sheet-field-label">Name</label>
            <input
              className="detail-sheet-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Player name"
              autoFocus
            />
          </div>

          <div className="detail-sheet-field">
            <label className="detail-sheet-field-label">Position</label>
            <div className="detail-sheet-position-selector">
              {["F", "D", "G"].map((pos) => (
                <button
                  key={pos}
                  className={
                    position === pos
                      ? "detail-sheet-position-btn detail-sheet-position-btn-active"
                      : "detail-sheet-position-btn"
                  }
                  onClick={() => setPosition(pos)}
                >
                  {pos}
                </button>
              ))}
            </div>
          </div>

          {error && <div className="add-player-error">{error}</div>}

          <button
            className="add-player-submit"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>

        {/* Parent submit popup */}
        {showSubmitPopup && (
          <div className="correction-popup">
            <p className="correction-popup-title">
              Submit new player to admin&nbsp;for&nbsp;review?
            </p>
            <div className="correction-popup-actions">
              <button className="correction-popup-submit" onClick={handleSubmit}>
                Submit
              </button>
              <button className="correction-popup-skip" onClick={handleSkip}>
                Skip
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
