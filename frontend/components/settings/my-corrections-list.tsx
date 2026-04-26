"use client"

import { useState } from "react"
import { ChevronDown, ArrowRight } from "lucide-react"
import type { MyCorrectionsRow } from "@/app/(app)/corrections/actions"

type MyCorrectionslListProps = {
  corrections: MyCorrectionsRow[]
}

type PlayerGroup = {
  playerId: string
  playerName: string
  playerJersey: string
  corrections: MyCorrectionsRow[]
  latestDate: string
  status: string
}

function groupByPlayer(corrections: MyCorrectionsRow[]): PlayerGroup[] {
  const map = new Map<string, MyCorrectionsRow[]>()
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
      corrections: sorted,
      latestDate: first.created_at,
      status: first.status,
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

function statusBadgeClass(status: string): string {
  switch (status) {
    case "approved": return "corrections-status-badge corrections-status-badge--approved"
    case "rejected": return "corrections-status-badge corrections-status-badge--rejected"
    default: return "corrections-status-badge corrections-status-badge--pending"
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "approved": return "Approved"
    case "rejected": return "Rejected"
    default: return "Pending"
  }
}

function MyCorrectionsCard({ group }: { group: PlayerGroup }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={expanded ? "my-corrections-card my-corrections-card--expanded" : "my-corrections-card"}>
      <div className="my-corrections-card-header" onClick={() => setExpanded(!expanded)}>
        <div className="my-corrections-card-header-left">
          <div className="corrections-card-player">
            #{group.playerJersey} {group.playerName}
          </div>
          <div className="corrections-card-meta">
            <span className="corrections-card-date">{formatDate(group.latestDate)}</span>
          </div>
        </div>
        <div className="my-corrections-card-header-right">
          <span className={statusBadgeClass(group.status)}>
            {statusLabel(group.status)}
          </span>
          <ChevronDown size={16} className="corrections-card-chevron" />
        </div>
      </div>
      <div className="my-corrections-card-body">
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

            <div className="corrections-card-submitter-full">
              Submitted {formatDate(group.latestDate)}
              {group.corrections[0].reviewed_at && (
                <> · Reviewed {formatDate(group.corrections[0].reviewed_at)}</>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function MyCorrectionsList({ corrections }: MyCorrectionslListProps) {
  if (corrections.length === 0) {
    return (
      <div className="corrections-empty">
        <p>You haven&apos;t submitted any corrections&nbsp;yet.</p>
      </div>
    )
  }

  const groups = groupByPlayer(corrections)

  return (
    <div className="corrections-list">
      {groups.map((group) => (
        <MyCorrectionsCard key={group.playerId} group={group} />
      ))}
    </div>
  )
}
