"use client"

import { useState } from "react"
import { Check, X } from "lucide-react"
import { reviewCorrection } from "@/app/(app)/corrections/actions"

type CorrectionRow = {
  id: string
  player_id: string
  field_name: string
  old_value: string
  new_value: string
  status: string
  created_at: string
  user_id: string
  player_jersey: string
  player_name: string
  player_division: string
  submitter_email: string
}

type CorrectionsListProps = {
  initialCorrections: CorrectionRow[]
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
                {c.field_name === "name" ? "Name" : "Jersey #"}
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
