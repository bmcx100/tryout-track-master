"use client"

import { useState } from "react"
import { Check, X, Pencil, ChevronDown, AlertTriangle, ArrowRight } from "lucide-react"
import { reviewCorrection, reviewSuggestedPlayer } from "@/app/(app)/corrections/actions"
import type { CorrectionRow } from "@/app/(app)/corrections/actions"

type CorrectionsListProps = {
  pendingCorrections: CorrectionRow[]
  resolvedCorrections: CorrectionRow[]
}

type PlayerGroup = {
  playerId: string
  playerName: string
  playerJersey: string
  playerDivision: string
  corrections: CorrectionRow[]
  latestDate: string
  submitterEmail: string
}

function groupByPlayer(corrections: CorrectionRow[]): PlayerGroup[] {
  const map = new Map<string, CorrectionRow[]>()
  for (const c of corrections) {
    const existing = map.get(c.player_id) ?? []
    existing.push(c)
    map.set(c.player_id, existing)
  }

  const groups: PlayerGroup[] = []
  for (const [playerId, items] of map) {
    const sorted = items.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    const first = sorted[0]
    groups.push({
      playerId,
      playerName: first.player_name,
      playerJersey: first.player_jersey,
      playerDivision: first.player_division,
      corrections: sorted,
      latestDate: first.created_at,
      submitterEmail: first.submitter_email,
    })
  }

  return groups.sort((a, b) =>
    new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime()
  )
}

function formatFieldName(fieldName: string): string {
  switch (fieldName) {
    case "name": return "NAME"
    case "jersey_number": return "JERSEY #"
    case "position": return "POSITION"
    case "previous_team": return "PREV TEAM"
    case "team": return "TEAM"
    case "add_player": return "NEW PLAYER"
    default: return fieldName.toUpperCase()
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
  }) + ", " + d.toLocaleTimeString("en-CA", {
    hour: "numeric",
    minute: "2-digit",
  })
}

function truncateEmail(email: string): string {
  const at = email.indexOf("@")
  return at > 0 ? email.substring(0, at) : email
}

function AddPlayerCard({
  group,
  onReviewed,
  onError,
}: {
  group: PlayerGroup
  onReviewed: (ids: string[]) => void
  onError: (msg: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [processing, setProcessing] = useState(false)
  const correction = group.corrections[0]
  const [name, setName] = useState(correction.player_name)
  const [jersey, setJersey] = useState(correction.player_jersey)
  const [position, setPosition] = useState(correction.player_position ?? "")

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
    onReviewed([correction.id])
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
    onReviewed([correction.id])
  }

  return (
    <div className={expanded ? "corrections-card corrections-card--expanded" : "corrections-card"}>
      <div className="corrections-card-header" onClick={() => setExpanded(!expanded)}>
        <div className="corrections-card-header-left">
          <div className="corrections-card-player">
            #{group.playerJersey} {group.playerName}
          </div>
          <div className="corrections-card-meta">
            <span className="corrections-card-submitter">{truncateEmail(group.submitterEmail)}</span>
            <span className="corrections-card-date">{formatDate(group.latestDate)}</span>
          </div>
        </div>
        <div className="corrections-card-header-right">
          <span className="corrections-change-count">New Player</span>
          <ChevronDown size={16} className="corrections-card-chevron" />
        </div>
      </div>
      <div className="corrections-card-body">
        <div className="corrections-card-body-inner">
          <div className="corrections-card-content">
            <div className="corrections-diff-row">
              <span className="corrections-diff-label">DIVISION</span>
              <span className="corrections-diff-new">{group.playerDivision}</span>
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
              <>
                <div className="corrections-diff-row">
                  <span className="corrections-diff-label">PLAYER</span>
                  <span className="corrections-diff-new">
                    #{correction.player_jersey} {correction.player_name}
                    {correction.player_position ? ` · ${correction.player_position}` : ""}
                  </span>
                </div>
              </>
            )}

            <div className="corrections-card-submitter-full">
              Submitted by {group.submitterEmail} · {formatDate(group.latestDate)}
            </div>

            <div className="corrections-actions">
              {!editing && (
                <button
                  className="corrections-edit-btn"
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
        </div>
      </div>
    </div>
  )
}

function PendingCard({
  group,
  onReviewed,
  onError,
}: {
  group: PlayerGroup
  onReviewed: (ids: string[]) => void
  onError: (msg: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [processing, setProcessing] = useState(false)

  // If this is an add_player correction, use the AddPlayerCard
  if (group.corrections[0].field_name === "add_player") {
    return <AddPlayerCard group={group} onReviewed={onReviewed} onError={onError} />
  }

  const handleBulkAction = async (action: "approved" | "rejected") => {
    setProcessing(true)
    onError("")
    for (const c of group.corrections) {
      const result = await reviewCorrection(c.id, action)
      if (result.error) {
        onError(result.error)
        setProcessing(false)
        return
      }
    }
    onReviewed(group.corrections.map((c) => c.id))
  }

  return (
    <div className={expanded ? "corrections-card corrections-card--expanded" : "corrections-card"}>
      <div className="corrections-card-header" onClick={() => setExpanded(!expanded)}>
        <div className="corrections-card-header-left">
          <div className="corrections-card-player">
            #{group.playerJersey} {group.playerName}
          </div>
          <div className="corrections-card-meta">
            <span className="corrections-card-submitter">{truncateEmail(group.submitterEmail)}</span>
            <span className="corrections-card-date">{formatDate(group.latestDate)}</span>
          </div>
        </div>
        <div className="corrections-card-header-right">
          {group.corrections.length > 1 && (
            <span className="corrections-change-count">
              {group.corrections.length} changes
            </span>
          )}
          <ChevronDown size={16} className="corrections-card-chevron" />
        </div>
      </div>
      <div className="corrections-card-body">
        <div className="corrections-card-body-inner">
          <div className="corrections-card-content">
            {group.corrections.map((c) => (
              <div key={c.id} className="corrections-diff-row">
                <span className="corrections-diff-label">{formatFieldName(c.field_name)}</span>
                <div className="corrections-diff-values">
                  <span className="corrections-diff-old">{c.old_value}</span>
                  <ArrowRight size={12} className="corrections-diff-arrow" />
                  <span className="corrections-diff-new">{c.new_value}</span>
                </div>
                {c.current_value !== null && c.old_value !== c.current_value && (
                  <div className="corrections-stale-warning">
                    <AlertTriangle size={12} />
                    <span>Current value: {c.current_value}</span>
                  </div>
                )}
              </div>
            ))}

            <div className="corrections-card-submitter-full">
              Submitted by {group.submitterEmail} · {formatDate(group.latestDate)}
            </div>

            <div className="corrections-actions">
              <button
                className="corrections-approve"
                onClick={() => handleBulkAction("approved")}
                disabled={processing}
              >
                <Check size={16} />
                <span>Approve</span>
              </button>
              <button
                className="corrections-reject"
                onClick={() => handleBulkAction("rejected")}
                disabled={processing}
              >
                <X size={16} />
                <span>Reject</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ResolvedCard({ group }: { group: PlayerGroup }) {
  const [expanded, setExpanded] = useState(false)
  const status = group.corrections[0].status

  return (
    <div className={expanded ? "corrections-card corrections-card--expanded" : "corrections-card"}>
      <div className="corrections-card-header" onClick={() => setExpanded(!expanded)}>
        <div className="corrections-card-header-left">
          <div className="corrections-card-player">
            #{group.playerJersey} {group.playerName}
          </div>
          <div className="corrections-card-meta">
            <span className="corrections-card-date">
              {group.corrections[0].reviewed_at
                ? formatDate(group.corrections[0].reviewed_at)
                : formatDate(group.latestDate)}
            </span>
          </div>
        </div>
        <div className="corrections-card-header-right">
          <span className={
            status === "approved"
              ? "corrections-status-badge corrections-status-badge--approved"
              : "corrections-status-badge corrections-status-badge--rejected"
          }>
            {status === "approved" ? "Approved" : "Rejected"}
          </span>
          <ChevronDown size={16} className="corrections-card-chevron" />
        </div>
      </div>
      <div className="corrections-card-body">
        <div className="corrections-card-body-inner">
          <div className="corrections-card-content">
            {group.corrections.map((c) => (
              <div key={c.id} className="corrections-diff-row">
                <span className="corrections-diff-label">{formatFieldName(c.field_name)}</span>
                {c.field_name === "add_player" ? (
                  <span className="corrections-diff-new">{c.new_value}</span>
                ) : (
                  <div className="corrections-diff-values">
                    <span className="corrections-diff-old">{c.old_value}</span>
                    <ArrowRight size={12} className="corrections-diff-arrow" />
                    <span className="corrections-diff-new">{c.new_value}</span>
                  </div>
                )}
              </div>
            ))}

            <div className="corrections-reviewer">
              {group.corrections[0].reviewed_by_email && (
                <>Reviewed by {group.corrections[0].reviewed_by_email} · {group.corrections[0].reviewed_at ? formatDate(group.corrections[0].reviewed_at) : ""}</>
              )}
            </div>
            <div className="corrections-card-submitter-full">
              Submitted by {group.submitterEmail} · {formatDate(group.latestDate)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function CorrectionsList({ pendingCorrections, resolvedCorrections }: CorrectionsListProps) {
  const [tab, setTab] = useState<"pending" | "resolved">("pending")
  const [pending, setPending] = useState(pendingCorrections)
  const [error, setError] = useState<string | null>(null)

  const handleReviewed = (ids: string[]) => {
    setPending((prev) => prev.filter((c) => !ids.includes(c.id)))
  }

  const pendingGroups = groupByPlayer(pending)
  const resolvedGroups = groupByPlayer(resolvedCorrections)

  return (
    <div>
      <div className="corrections-toggle">
        <button
          className={tab === "pending" ? "corrections-toggle-btn corrections-toggle-btn--active" : "corrections-toggle-btn"}
          onClick={() => setTab("pending")}
        >
          Pending ({pending.length})
        </button>
        <button
          className={tab === "resolved" ? "corrections-toggle-btn corrections-toggle-btn--active" : "corrections-toggle-btn"}
          onClick={() => setTab("resolved")}
        >
          Resolved ({resolvedCorrections.length})
        </button>
      </div>

      {error && <div className="corrections-error">{error}</div>}

      {tab === "pending" ? (
        pendingGroups.length === 0 ? (
          <div className="corrections-empty">
            <p>No pending corrections</p>
          </div>
        ) : (
          <div className="corrections-list">
            {pendingGroups.map((group) => (
              <PendingCard
                key={group.playerId}
                group={group}
                onReviewed={handleReviewed}
                onError={(msg) => setError(msg || null)}
              />
            ))}
          </div>
        )
      ) : (
        resolvedGroups.length === 0 ? (
          <div className="corrections-empty">
            <p>No resolved corrections</p>
          </div>
        ) : (
          <div className="corrections-list">
            {resolvedGroups.map((group) => (
              <ResolvedCard key={group.playerId} group={group} />
            ))}
          </div>
        )
      )}
    </div>
  )
}
