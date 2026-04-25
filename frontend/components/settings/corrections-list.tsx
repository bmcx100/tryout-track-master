"use client"

import { useState } from "react"
import { Check, X, Pencil } from "lucide-react"
import { reviewCorrection, reviewSuggestedPlayer } from "@/app/(app)/corrections/actions"
import type { CorrectionRow } from "@/app/(app)/corrections/actions"

type CorrectionsListProps = {
  initialCorrections: CorrectionRow[]
}

function AddPlayerReview({
  correction,
  onReviewed,
  onError,
}: {
  correction: CorrectionRow
  onReviewed: (id: string) => void
  onError: (msg: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(correction.player_name)
  const [jersey, setJersey] = useState(correction.player_jersey)
  const [position, setPosition] = useState(correction.player_position ?? "")
  const [processing, setProcessing] = useState(false)

  const handleApprove = async () => {
    setProcessing(true)
    onError("")
    const updates: { name?: string, jersey_number?: string, position?: string } = {}
    if (name !== correction.player_name) updates.name = name
    if (jersey !== correction.player_jersey) updates.jersey_number = jersey
    if (position !== correction.player_position) updates.position = position

    const result = await reviewSuggestedPlayer(
      correction.id,
      "approved",
      Object.keys(updates).length > 0 ? updates : undefined
    )
    if (result.error) {
      onError(result.error)
      setProcessing(false)
      return
    }
    onReviewed(correction.id)
  }

  const handleReject = async () => {
    setProcessing(true)
    onError("")
    const result = await reviewSuggestedPlayer(correction.id, "rejected")
    if (result.error) {
      onError(result.error)
      setProcessing(false)
      return
    }
    onReviewed(correction.id)
  }

  const date = new Date(correction.created_at).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
  })

  return (
    <div className="corrections-row corrections-add-player">
      <div className="corrections-row-info">
        <span className="corrections-field-label">New Player</span>
        <span className="corrections-division">{correction.player_division}</span>
      </div>

      {editing ? (
        <div className="corrections-edit-fields">
          <div className="corrections-edit-row">
            <label className="corrections-edit-label">Jersey</label>
            <input
              className="corrections-edit-input"
              value={jersey}
              onChange={(e) => setJersey(e.target.value)}
            />
          </div>
          <div className="corrections-edit-row">
            <label className="corrections-edit-label">Name</label>
            <input
              className="corrections-edit-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="corrections-edit-row">
            <label className="corrections-edit-label">Position</label>
            <div className="corrections-edit-position">
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
        </div>
      ) : (
        <div className="corrections-field-change">
          <span className="corrections-change">
            #{correction.player_jersey} {correction.player_name}
            {correction.player_position ? ` · ${correction.player_position}` : ""}
          </span>
        </div>
      )}

      <div className="corrections-row-meta">
        <span className="corrections-submitter">{correction.submitter_email}</span>
        <span className="corrections-date">{date}</span>
      </div>

      <div className="corrections-actions">
        {!editing && (
          <button
            className="corrections-review-btn"
            onClick={() => setEditing(true)}
            disabled={processing}
          >
            <Pencil size={14} />
            <span>Edit</span>
          </button>
        )}
        <button
          className="corrections-approve"
          onClick={handleApprove}
          disabled={processing}
        >
          <Check size={16} />
          <span>Approve</span>
        </button>
        <button
          className="corrections-reject"
          onClick={handleReject}
          disabled={processing}
        >
          <X size={16} />
          <span>Reject</span>
        </button>
      </div>
    </div>
  )
}

export function CorrectionsList({ initialCorrections }: CorrectionsListProps) {
  const [corrections, setCorrections] = useState(initialCorrections)
  const [processing, setProcessing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleReview = async (id: string, action: "approved" | "rejected") => {
    setProcessing(id)
    setError(null)
    const result = await reviewCorrection(id, action)
    if (result.error) {
      setError(result.error)
      setProcessing(null)
      return
    }
    setCorrections((prev) => prev.filter((c) => c.id !== id))
    setProcessing(null)
  }

  const handleAddPlayerReviewed = (id: string) => {
    setCorrections((prev) => prev.filter((c) => c.id !== id))
  }

  if (corrections.length === 0) {
    return (
      <div className="corrections-empty">
        <p>No pending corrections</p>
      </div>
    )
  }

  return (
    <div className="corrections-list">
      {error && <div className="corrections-error">{error}</div>}
      {corrections.map((c) => {
        if (c.field_name === "add_player") {
          return (
            <AddPlayerReview
              key={c.id}
              correction={c}
              onReviewed={handleAddPlayerReviewed}
              onError={(msg) => setError(msg || null)}
            />
          )
        }

        const isProcessing = processing === c.id
        const date = new Date(c.created_at).toLocaleDateString("en-CA", {
          month: "short",
          day: "numeric",
        })
        return (
          <div key={c.id} className="corrections-row">
            <div className="corrections-row-info">
              <span className="corrections-player">
                #{c.player_jersey} {c.player_name}
              </span>
              <span className="corrections-division">{c.player_division}</span>
            </div>
            <div className="corrections-field-change">
              <span className="corrections-field-label">
                {c.field_name === "name" ? "Name" : c.field_name === "jersey_number" ? "Jersey #" : c.field_name === "position" ? "Position" : c.field_name === "previous_team" ? "Previous Team" : c.field_name === "team" ? "Team" : c.field_name}
              </span>
              <span className="corrections-change">
                {c.old_value} &rarr; {c.new_value}
              </span>
            </div>
            <div className="corrections-row-meta">
              <span className="corrections-submitter">{c.submitter_email}</span>
              <span className="corrections-date">{date}</span>
            </div>
            <div className="corrections-actions">
              <button
                className="corrections-approve"
                onClick={() => handleReview(c.id, "approved")}
                disabled={isProcessing}
              >
                <Check size={16} />
                <span>Approve</span>
              </button>
              <button
                className="corrections-reject"
                onClick={() => handleReview(c.id, "rejected")}
                disabled={isProcessing}
              >
                <X size={16} />
                <span>Reject</span>
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
