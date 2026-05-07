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
  groupKey: string
  players: FavoriteStatus[]
}

const LEVEL_ORDER = ["AA", "A", "BB", "B", "C"]

function buildStatusGroups(favs: FavoriteStatus[]): StatusGroup[] {
  const groups: StatusGroup[] = []

  // Continuing
  const continuing = favs.filter((f) => f.statusType === "continuing")
  if (continuing.length > 0) {
    groups.push({ statusType: "continuing", groupKey: "continuing", players: continuing })
  }

  // Cut
  const cut = favs.filter((f) => f.statusType === "cut")
  if (cut.length > 0) {
    groups.push({ statusType: "cut", groupKey: "cut", players: cut })
  }

  // Made Team — split by teamLevel and subTeam, reverse LEVEL_ORDER (C, B, BB, A, AA)
  const madeTeam = favs.filter((f) => f.statusType === "made_team")
  // Group by level:subTeam
  const madeByKey = new Map<string, FavoriteStatus[]>()
  const madeNullLevel: FavoriteStatus[] = []
  for (const f of madeTeam) {
    if (f.teamLevel) {
      const subKey = f.subTeam ? `${f.teamLevel}:${f.subTeam}` : f.teamLevel
      const existing = madeByKey.get(subKey) ?? []
      existing.push(f)
      madeByKey.set(subKey, existing)
    } else {
      madeNullLevel.push(f)
    }
  }
  const reverseLevels = [...LEVEL_ORDER].reverse()
  for (const lvl of reverseLevels) {
    // Find all keys that start with this level
    const levelKeys = Array.from(madeByKey.keys()).filter(
      (k) => k === lvl || k.startsWith(`${lvl}:`)
    )
    // Sort: level without sub-team first, then sub-teams alphabetically
    levelKeys.sort((a, b) => {
      if (a === lvl) return -1
      if (b === lvl) return 1
      return a.localeCompare(b)
    })
    for (const key of levelKeys) {
      const players = madeByKey.get(key)
      if (players && players.length > 0) {
        groups.push({ statusType: "made_team", groupKey: `made_team:${key}`, players })
      }
    }
  }
  if (madeNullLevel.length > 0) {
    groups.push({ statusType: "made_team", groupKey: "made_team:unknown", players: madeNullLevel })
  }

  // Registered
  const registered = favs.filter((f) => f.statusType === "registered")
  if (registered.length > 0) {
    groups.push({ statusType: "registered", groupKey: "registered", players: registered })
  }

  return groups
}

function formatSampleNames(players: FavoriteStatus[]): string {
  const samples = players.slice(0, 4).map((p) => {
    const lastName = p.playerName.split(",")[0]?.trim() ?? p.playerName
    return `#${p.jerseyNumber} ${lastName}`
  })
  const remaining = players.length - 4
  if (remaining > 0) {
    return `${samples.join(", ")} +${remaining}`
  }
  return samples.join(", ")
}

function getStatusLabel(group: StatusGroup): string {
  const { statusType, players } = group
  if (statusType === "continuing") return "Continuing"
  if (statusType === "cut") {
    const isFinal = players.some((p) => p.roundType === "final")
    return isFinal ? "Final Cut" : "Cut"
  }
  if (statusType === "made_team") {
    const text = players[0]?.statusText
    return text && text !== "Made Team" ? text : "Made Team"
  }
  if (statusType === "registered") return "Registered"
  return statusType
}

function renderPositionBreakdown(card: HeroCard) {
  if (!card.positionSource) return null
  const hasData = (card.positionCountF != null && card.positionCountF > 0) ||
    (card.positionCountD != null && card.positionCountD > 0) ||
    (card.positionCountG != null && card.positionCountG > 0)
  if (!hasData) return null

  if (card.isRoundOne && card.positionSource === "estimated") {
    const parts: string[] = []
    if (card.positionCountF != null && card.positionCountF > 0) parts.push(`${card.positionCountF}F`)
    if (card.positionCountD != null && card.positionCountD > 0) parts.push(`${card.positionCountD}D`)
    if (card.positionCountG != null && card.positionCountG > 0) parts.push(`${card.positionCountG}G`)
    if (card.positionCountUnknown > 0) parts.push(`${card.positionCountUnknown}?`)
    return <div className="dashboard-hero-position-breakdown">{parts.join(" / ")}</div>
  }

  const parts: string[] = []
  if (card.positionCountF != null) parts.push(`F: ${card.positionCountF}`)
  if (card.positionCountD != null) parts.push(`D: ${card.positionCountD}`)
  if (card.positionCountG != null) parts.push(`G: ${card.positionCountG}`)
  if (card.positionCountUnknown > 0) parts.push(`?: ${card.positionCountUnknown}`)
  return <div className="dashboard-hero-position-breakdown">{parts.join(" | ")}</div>
}

function renderFinalTeamHeroCard(card: HeroCard) {
  return (
    <Link key={card.teamLevel} href="/continuations" className="dashboard-hero-card dashboard-hero-card-link">
      <div className="dashboard-hero-title">{card.division} {card.teamLevel} - Final&nbsp;Team</div>
      <div className="dashboard-hero-stats">
        <div className="dashboard-hero-stat">
          <div className="dashboard-hero-stat-value dashboard-hero-stat-value-green">
            {card.continuingCount}
          </div>
          <div className="dashboard-hero-stat-label">Made Team</div>
        </div>
        <div className="dashboard-hero-stat">
          <div className="dashboard-hero-stat-value dashboard-hero-stat-value-red">
            {card.cutCount}
          </div>
          <div className="dashboard-hero-stat-label">Cuts</div>
        </div>
      </div>
      {renderPositionBreakdown(card)}
    </Link>
  )
}

function renderHeroCard(card: HeroCard) {
  return (
    <Link key={card.teamLevel} href="/continuations" className="dashboard-hero-card dashboard-hero-card-link">
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
          </>
        )}
      </div>
      {renderPositionBreakdown(card)}
    </Link>
  )
}

function renderFavCard(group: StatusGroup) {
  const { statusType, groupKey, players } = group
  const count = players.length
  const label = getStatusLabel(group)

  return (
    <Link
      key={groupKey}
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
      {heroCards.length > 0 && (
        <div className="dashboard-hero-section">
          {heroCards.map((card) =>
            card.isFinalTeam
              ? renderFinalTeamHeroCard(card)
              : renderHeroCard(card)
          )}
        </div>
      )}

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
