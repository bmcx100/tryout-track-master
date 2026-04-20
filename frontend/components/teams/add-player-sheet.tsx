"use client"

import { useState, useEffect } from "react"
import { X } from "lucide-react"

type AddPlayerSheetProps = {
  onClose: () => void
  onSubmit: (name: string, jerseyNumber: string, position: string, previousTeam: string) => Promise<{ error?: string }>
}

const POSITIONS = ["F", "D", "G"]

export function AddPlayerSheet({ onClose, onSubmit }: AddPlayerSheetProps) {
  const [name, setName] = useState("")
  const [jersey, setJersey] = useState("")
  const [position, setPosition] = useState("")
  const [previousTeam, setPreviousTeam] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  const canSubmit = name.trim() && jersey.trim() && position && !submitting

  async function handleSubmit() {
    if (!canSubmit) return
    setError("")
    setSubmitting(true)
    const result = await onSubmit(name.trim(), jersey.trim(), position, previousTeam.trim())
    if (result.error) {
      setError(result.error)
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="detail-overlay" onClick={onClose} />
      <div className="add-player-sheet">
        <div className="add-player-sheet-handle" />
        <div className="add-player-sheet-header">
          <h3 className="add-player-sheet-title">Add a Player</h3>
          <button className="detail-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <p className="add-player-sheet-subtitle">
          This player will be submitted for admin&nbsp;approval.
        </p>

        {error && <p className="add-player-sheet-error">{error}</p>}

        <div className="add-player-sheet-form">
          <div className="add-player-sheet-field">
            <label className="add-player-sheet-label">Name</label>
            <input
              className="add-player-sheet-input"
              type="text"
              placeholder="Player name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="add-player-sheet-field">
            <label className="add-player-sheet-label">Jersey</label>
            <input
              className="add-player-sheet-input"
              type="text"
              inputMode="numeric"
              placeholder="#"
              value={jersey}
              onChange={(e) => setJersey(e.target.value)}
            />
          </div>

          <div className="add-player-sheet-field">
            <label className="add-player-sheet-label">Position</label>
            <div className="add-player-sheet-positions">
              {POSITIONS.map((pos) => (
                <button
                  key={pos}
                  className={position === pos ? "detail-sheet-position-btn detail-sheet-position-btn-active" : "detail-sheet-position-btn"}
                  onClick={() => setPosition(pos)}
                >
                  {pos}
                </button>
              ))}
            </div>
          </div>

          <div className="add-player-sheet-field">
            <label className="add-player-sheet-label">Previous Team</label>
            <input
              className="add-player-sheet-input"
              type="text"
              placeholder="e.g. U13 AA"
              value={previousTeam}
              onChange={(e) => setPreviousTeam(e.target.value)}
            />
          </div>
        </div>

        <button
          className="add-player-sheet-submit"
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          {submitting ? "Submitting\u2026" : "Submit for Approval"}
        </button>
      </div>
    </>
  )
}
