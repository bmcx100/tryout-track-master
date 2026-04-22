"use client"

import Link from "next/link"
import { Heart } from "lucide-react"
import type { HeroCard, FavoriteStatus } from "@/app/(app)/dashboard/actions"

type DashboardClientProps = {
  heroCards: HeroCard[]
  favoriteStatuses: FavoriteStatus[]
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
  for (const p of players) {
    const match = p.statusText.match(/Not at (\w+)/)
    if (match) return match[1]
  }
  return ""
}

function getStatusLabel(statusType: string, players: FavoriteStatus[]): string {
  if (statusType === "continuing") return "Continuing"
  if (statusType === "cut") return "Cut"
  if (statusType === "missing") {
    const level = getMissingLevel(players)
    return level ? `Missing at ${level}` : "Missing"
  }
  if (statusType === "made_team") return "Made Team"
  if (statusType === "registered") return "Registered"
  return statusType
}

function renderHeroCard(card: HeroCard) {
  if (card.isFinalTeam) {
    // Variant B: Team Finalized
    const hasFavourites = card.favouritesOnTeam > 0 || card.favouritesCutFinal > 0
    return (
      <div key={card.teamLevel} className="dashboard-hero-card">
        <div className="dashboard-hero-title">Team Finalized</div>
        <div className="dashboard-hero-subtitle">{card.teamLevel}</div>
        <div className="dashboard-hero-stats">
          <div className="dashboard-hero-stat">
            <div className="dashboard-hero-stat-value dashboard-hero-stat-value-gold">
              {hasFavourites ? card.favouritesOnTeam : card.totalPlayers}
            </div>
            <div className="dashboard-hero-stat-label">
              {hasFavourites ? "On Roster" : "Roster"}
            </div>
          </div>
          <div className="dashboard-hero-stat">
            <div className="dashboard-hero-stat-value dashboard-hero-stat-value-red">
              {hasFavourites ? card.favouritesCutFinal : card.cutCount}
            </div>
            <div className="dashboard-hero-stat-label">Cut</div>
          </div>
        </div>
      </div>
    )
  }

  // Variant A: Tryouts in progress
  return (
    <div key={card.teamLevel} className="dashboard-hero-card">
      <div className="dashboard-hero-title">{card.division} {card.teamLevel} - Round&nbsp;{card.roundNumber}</div>
      <div className="dashboard-hero-stats">
        {card.isRoundOne ? (
          <>
            <div className="dashboard-hero-stat">
              <div className="dashboard-hero-stat-value dashboard-hero-stat-value-neutral">
                {card.totalPlayers}
              </div>
              <div className="dashboard-hero-stat-label">Total Players</div>
            </div>
            <div className="dashboard-hero-stat">
              <div className="dashboard-hero-stat-value dashboard-hero-stat-value-gold">
                {card.missingCount}
              </div>
              <div className="dashboard-hero-stat-label">Missing</div>
            </div>
          </>
        ) : (
          <>
            <div className="dashboard-hero-stat">
              <div className="dashboard-hero-stat-value dashboard-hero-stat-value-green">
                {card.continuingCount}
              </div>
              <div className="dashboard-hero-stat-label">Continuing</div>
            </div>
            <div className="dashboard-hero-stat">
              <div className="dashboard-hero-stat-value dashboard-hero-stat-value-red">
                {card.cutCount}
              </div>
              <div className="dashboard-hero-stat-label">Cuts</div>
            </div>
            <div className="dashboard-hero-stat">
              <div className="dashboard-hero-stat-value dashboard-hero-stat-value-gold">
                {card.missingCount}
              </div>
              <div className="dashboard-hero-stat-label">Missing</div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function renderFavCard(group: StatusGroup) {
  const { statusType, players } = group
  const count = players.length
  const label = getStatusLabel(statusType, players)

  return (
    <Link
      key={statusType}
      href="/my-favourites"
      className={`dashboard-fav-card dashboard-fav-card-${statusType}`}
    >
      <div className={`dashboard-fav-count dashboard-fav-count-${statusType}`}>
        {count}
      </div>
      <div className="dashboard-fav-info">
        <div className="dashboard-fav-label">{label}</div>
        <div className="dashboard-fav-names">{formatSampleNames(players)}</div>
      </div>
    </Link>
  )
}

export function DashboardClient({ heroCards, favoriteStatuses }: DashboardClientProps) {
  const statusGroups = buildStatusGroups(favoriteStatuses)

  return (
    <div className="dashboard-page">
      {/* Hero Cards */}
      {heroCards.length > 0 && (
        <div className="dashboard-hero-section">
          {heroCards.map((card) => renderHeroCard(card))}
        </div>
      )}

      {/* My Favourites */}
      {favoriteStatuses.length > 0 ? (
        <div className="dashboard-fav-section">
          <Link href="/my-favourites" className="dashboard-fav-header">
            My Favourites ({favoriteStatuses.length}<Heart size={12} fill="currentColor" className="dashboard-fav-heart" />)
          </Link>
          <div className="dashboard-fav-list">
            {statusGroups.map((group) => renderFavCard(group))}
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
