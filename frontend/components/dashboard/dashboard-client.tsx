"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import Link from "next/link"
import { Heart } from "lucide-react"
import type { HeroCard, HeroPlayerRow, FavoriteStatus } from "@/app/(app)/dashboard/actions"
import { SessionsToggle } from "@/components/continuations/sessions-toggle"
import { toggleFavorite } from "@/app/(app)/continuations/actions"

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

const POSITIONS: { label: string, value: string | null }[] = [
  { label: "All", value: null },
  { label: "F", value: "F" },
  { label: "D", value: "D" },
  { label: "G", value: "G" },
]

function HeroPositionFilter({
  active,
  onChange,
  counts,
}: {
  active: string | null
  onChange: (v: string | null) => void
  counts: Record<string, number>
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [pill, setPill] = useState({ left: 0, width: 0 })
  const activeIdx = POSITIONS.findIndex((p) => p.value === active)

  useEffect(() => {
    const btn = btnRefs.current[activeIdx]
    const container = trackRef.current
    if (!btn || !container) return
    const cRect = container.getBoundingClientRect()
    const bRect = btn.getBoundingClientRect()
    setPill({ left: bRect.left - cRect.left, width: bRect.width })
  }, [activeIdx])

  return (
    <div className="hero-position-filter">
      <div className="position-filter-track" ref={trackRef}>
        <div
          className="position-filter-pill"
          style={{ left: pill.left, width: pill.width }}
        />
        {POSITIONS.map((pos, i) => {
          const isActive = active === pos.value
          return (
            <button
              key={pos.label}
              ref={(el) => { btnRefs.current[i] = el }}
              className={isActive ? "position-chip active" : "position-chip"}
              onClick={() => { if (!isActive) onChange(pos.value) }}
            >
              {pos.value ? `${pos.label} (${counts[pos.value] ?? 0})` : pos.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function FinalTeamHeroCard({
  card,
  onToggleFavorite,
}: {
  card: HeroCard
  onToggleFavorite: (playerId: string) => void
}) {
  const [activeView, setActiveView] = useState<"continuing" | "cuts">("continuing")
  const [posFilter, setPosFilter] = useState<string | null>(null)
  const roster = card.rosterPlayers ?? []
  const cuts = card.cutPlayers ?? []
  const allPlayers = activeView === "continuing" ? roster : cuts
  const activePlayers = posFilter
    ? allPlayers.filter((p) => p.position === posFilter)
    : allPlayers

  // Counts based on the current view (roster or cuts)
  const posCounts: Record<string, number> = {}
  for (const p of allPlayers) {
    posCounts[p.position] = (posCounts[p.position] ?? 0) + 1
  }

  return (
    <div className="dashboard-hero-card dashboard-hero-card-final">
      <div className="dashboard-hero-title">Final Team - {card.division}{card.teamLevel}</div>
      <div className="dashboard-hero-final-toggle">
        <SessionsToggle
          activeView={activeView}
          onViewChange={(v) => { setActiveView(v); setPosFilter(null) }}
          continuingCount={roster.length}
          cutCount={cuts.length}
          isFinalTeam
        />
      </div>
      <HeroPositionFilter
        active={posFilter}
        onChange={setPosFilter}
        counts={posCounts}
      />
      <div className="dashboard-hero-final-players">
        {activePlayers.map((p) => (
          <DashboardPlayerRow
            key={p.jerseyNumber}
            player={p}
            isCut={false}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>
    </div>
  )
}

function DashboardPlayerRow({
  player,
  isCut,
  onToggleFavorite,
}: {
  player: HeroPlayerRow
  isCut: boolean
  onToggleFavorite: (playerId: string) => void
}) {
  const rowClass = isCut
    ? "continuation-player-row continuation-player-row-cut"
    : "continuation-player-row"

  return (
    <div className={rowClass}>
      <span className={isCut ? "player-jersey continuation-jersey-cut" : "player-jersey"}>
        #{player.jerseyNumber}
      </span>
      {player.position && player.position !== "?" && (
        <span className="player-position">{player.position}</span>
      )}
      <button
        className={player.isFavorite ? "favorite-btn favorite-btn-active" : "favorite-btn"}
        onClick={(e) => {
          e.stopPropagation()
          onToggleFavorite(player.playerId ?? "")
        }}
      >
        <Heart size={14} fill={player.isFavorite ? "currentColor" : "none"} />
      </button>
      <span className="player-name">{player.name}</span>
      {player.previousTeam && (
        <span className="player-prev-team">{player.previousTeam}</span>
      )}
    </div>
  )
}

function renderHeroCard(card: HeroCard) {
  // Variant A: Tryouts in progress
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
          </>
        )}
      </div>
    </Link>
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
  const [localCards, setLocalCards] = useState(heroCards)

  const handleToggleFavorite = useCallback(async (playerId: string) => {
    if (!playerId) return

    // Optimistic update
    setLocalCards((prev) =>
      prev.map((card) => {
        if (!card.isFinalTeam) return card
        const updateRows = (rows?: HeroPlayerRow[]) =>
          rows?.map((p) =>
            p.playerId === playerId ? { ...p, isFavorite: !p.isFavorite } : p
          )
        return {
          ...card,
          rosterPlayers: updateRows(card.rosterPlayers),
          cutPlayers: updateRows(card.cutPlayers),
        }
      })
    )

    const result = await toggleFavorite(playerId)
    if (result.error) {
      // Revert on error
      setLocalCards((prev) =>
        prev.map((card) => {
          if (!card.isFinalTeam) return card
          const revertRows = (rows?: HeroPlayerRow[]) =>
            rows?.map((p) =>
              p.playerId === playerId ? { ...p, isFavorite: !p.isFavorite } : p
            )
          return {
            ...card,
            rosterPlayers: revertRows(card.rosterPlayers),
            cutPlayers: revertRows(card.cutPlayers),
          }
        })
      )
    }
  }, [])

  return (
    <div className="dashboard-page">
      {/* Hero Cards */}
      {localCards.length > 0 && (
        <div className="dashboard-hero-section">
          {localCards.map((card) =>
            card.isFinalTeam ? (
              <FinalTeamHeroCard
                key={card.teamLevel}
                card={card}
                onToggleFavorite={handleToggleFavorite}
              />
            ) : (
              renderHeroCard(card)
            )
          )}
        </div>
      )}

      {/* My Favourites — hidden for now */}
    </div>
  )
}
