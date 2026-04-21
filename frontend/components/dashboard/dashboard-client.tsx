"use client"

import Link from "next/link"
import { Heart } from "lucide-react"
import type { ActivityCard, FavoriteStatus } from "@/app/(app)/dashboard/actions"

type DashboardClientProps = {
  activityCards: ActivityCard[]
  favoriteStatuses: FavoriteStatus[]
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 1) return "Just now"
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

type StatusGroup = {
  statusType: string
  players: FavoriteStatus[]
}

const STATUS_ORDER = ["continuing", "cut", "missing", "made_team", "registered"]

function buildStatusGroups(favs: FavoriteStatus[]): StatusGroup[] {
  const grouped = new Map<string, FavoriteStatus[]>()
  for (const f of favs) {
    const existing = grouped.get(f.statusType) ?? []
    existing.push(f)
    grouped.set(f.statusType, existing)
  }
  const groups: StatusGroup[] = []
  for (const st of STATUS_ORDER) {
    const players = grouped.get(st)
    if (players && players.length > 0) {
      groups.push({ statusType: st, players })
    }
  }
  return groups
}

function formatSampleNames(players: FavoriteStatus[]): string {
  const samples = players.slice(0, 2).map((p) => {
    const lastName = p.playerName.split(",")[0]?.trim() ?? p.playerName
    return `#${p.jerseyNumber} ${lastName}`
  })
  const remaining = players.length - 2
  if (remaining > 0) {
    return `${samples.join(", ")} +${remaining}`
  }
  return samples.join(", ")
}

function getMissingLevel(players: FavoriteStatus[]): string {
  // Extract level from statusText: "Cut R3 (AA) · Not at A" → "A"
  for (const p of players) {
    const match = p.statusText.match(/Not at (\w+)/)
    if (match) return match[1]
  }
  return ""
}

function renderStatusCard(group: StatusGroup) {
  const { statusType, players } = group
  const count = players.length

  let heading = ""
  if (statusType === "continuing") heading = `${count} continuing`
  else if (statusType === "cut") heading = `${count} cut`
  else if (statusType === "missing") {
    const level = getMissingLevel(players)
    heading = `\u26A0 ${count} missing${level ? ` at ${level}` : ""}`
  } else if (statusType === "made_team") heading = `${count} made team`
  else if (statusType === "registered") heading = `${count} registered`

  return (
    <div
      key={statusType}
      className={`dashboard-status-card dashboard-status-card-${statusType}`}
    >
      <div className={`dashboard-status-heading dashboard-status-heading-${statusType}`}>
        {heading}
      </div>
      <div className="dashboard-status-names">{formatSampleNames(players)}</div>
    </div>
  )
}

export function DashboardClient({ activityCards, favoriteStatuses }: DashboardClientProps) {
  const statusGroups = buildStatusGroups(favoriteStatuses)

  return (
    <div className="dashboard-page">
      {/* Activity Section */}
      <div className="dashboard-section">
        <Link href="/continuations" className="dashboard-section-header">Recent Results</Link>
        {activityCards.length > 0 ? (
          <>
            <div className="dashboard-activity-list">
              {activityCards.map((card) => (
                <Link
                  key={card.teamLevel}
                  href="/continuations"
                  className="dashboard-activity-card"
                >
                  <div className="dashboard-activity-top">
                    <span className="dashboard-activity-badge">{card.teamLevel}</span>
                    <span className="dashboard-activity-round">Round {card.roundNumber}</span>
                    <span className="dashboard-activity-time">{formatTimeAgo(card.publishedAt)}</span>
                  </div>
                  <div className="dashboard-activity-stats">
                    {card.isFinalTeam ? (
                      <span className="dashboard-activity-final">Final Roster</span>
                    ) : (
                      <>
                        {card.cutCount > 0 && (
                          <span className="dashboard-activity-cuts">{card.cutCount} cut{card.cutCount !== 1 ? "s" : ""}</span>
                        )}
                        <span className="dashboard-activity-continuing">{card.continuingCount} continuing</span>
                      </>
                    )}
                  </div>
                </Link>
              ))}
            </div>
            <Link href="/continuations" className="dashboard-results-link">
              Results Details ›
            </Link>
          </>
        ) : (
          <p className="dashboard-activity-empty">No results in the last 5&nbsp;days</p>
        )}
      </div>

      <div className="dashboard-divider" />

      {/* Favorites Section */}
      {favoriteStatuses.length > 0 ? (
        <div className="dashboard-section">
          <Link href="/my-favourites" className="dashboard-section-header">
            My Favourites{" "}
            <span className="dashboard-section-count">({favoriteStatuses.length})</span>
          </Link>
          {statusGroups.map((group) => renderStatusCard(group))}
          <Link href="/my-favourites" className="dashboard-see-all-link">
            See All My Favourites ›
          </Link>
        </div>
      ) : (
        <div className="dashboard-empty">
          <Heart size={32} />
          <p>
            Heart players on the{" "}
            <Link href="/teams" className="dashboard-empty-link">Teams</Link>
            {" "}page to track them&nbsp;here.
          </p>
        </div>
      )}
    </div>
  )
}
