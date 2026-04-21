"use client"

import Link from "next/link"
import { Heart, AlertTriangle } from "lucide-react"
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

export function DashboardClient({ activityCards, favoriteStatuses }: DashboardClientProps) {
  return (
    <div className="dashboard-page">
      {/* Activity Section */}
      <div className="dashboard-section">
        <h2 className="dashboard-section-header">Recent Results</h2>
        {activityCards.length > 0 ? (
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
        ) : (
          <p className="dashboard-activity-empty">No results in the last 5&nbsp;days</p>
        )}
      </div>

      {/* Favorites Section */}
      {favoriteStatuses.length > 0 ? (
        <div className="dashboard-section">
          <h2 className="dashboard-section-header">
            My Players
            <span className="dashboard-section-count">{favoriteStatuses.length}</span>
          </h2>
          <div className="dashboard-fav-list">
            {favoriteStatuses.map((fav) => (
              <div key={fav.playerId} className="dashboard-fav-row">
                <span className="dashboard-fav-jersey">#{fav.jerseyNumber}</span>
                {fav.position !== "?" && (
                  <span className="dashboard-fav-position">{fav.position}</span>
                )}
                <span className="dashboard-fav-name">
                  {fav.playerName}
                  {fav.originalName && (
                    <span className="custom-name-indicator">{fav.originalName}</span>
                  )}
                </span>
                <span className="dashboard-fav-spacer" />
                <span className={`dashboard-fav-status dashboard-fav-status-${fav.statusType}`}>
                  {fav.statusType === "missing" && (
                    <AlertTriangle size={12} className="dashboard-fav-alert" />
                  )}
                  {fav.statusText}
                </span>
              </div>
            ))}
          </div>
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
