"use client"

import { useState } from "react"
import { ChevronDown, Clock } from "lucide-react"
import type { ContinuationRound, TryoutPlayer } from "@/types"
import { ContinuationPlayerRow } from "./continuation-player-row"

type SessionData = {
  session_number: number
  date: string
  start_time: string
  end_time: string
  jersey_numbers: string[]
}

type RoundSectionProps = {
  teamLevel: string
  division: string
  latestRound: ContinuationRound
  previousRound: ContinuationRound | null
  playerMap: Record<string, TryoutPlayer>
  annotations: Record<string, { isFavorite: boolean, notes: string | null }>
  onToggleFavorite: (playerId: string) => void
  onOpenHistory: (teamLevel: string) => void
}

const POSITION_ORDER: Record<string, number> = { F: 0, D: 1, G: 2 }
const TIER_ORDER: Record<string, number> = { AA: 0, A: 1, BB: 2, B: 3, C: 4 }

function getPositionRank(player: TryoutPlayer | null): number {
  if (!player?.position || player.position === "?") return 99
  return POSITION_ORDER[player.position] ?? 99
}

// Blended rank: tier first (AA > A > BB > B > C), then age desc within tier (U15 > U13 > U11)
function getBlendedTeamRank(player: TryoutPlayer | null): number {
  if (!player?.previous_team) return 9999
  const match = player.previous_team.match(/U(\d+)(.+)/)
  if (!match) return 9999
  const age = parseInt(match[1])
  const tier = TIER_ORDER[match[2]] ?? 99
  // tier * 100 gives major grouping, subtract age so higher age sorts first
  return tier * 100 - age
}

function sortByPositionThenTeam(
  a: { player: TryoutPlayer | null },
  b: { player: TryoutPlayer | null }
): number {
  const posA = getPositionRank(a.player)
  const posB = getPositionRank(b.player)
  if (posA !== posB) return posA - posB
  return getBlendedTeamRank(a.player) - getBlendedTeamRank(b.player)
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00")
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
}

function formatTime(time: string): string {
  const [h, m] = time.split(":")
  const hour = parseInt(h)
  const ampm = hour >= 12 ? "pm" : "am"
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  return `${displayHour}:${m}${ampm}`
}

function getSessionInfo(sessions: SessionData[]): string {
  if (!sessions || sessions.length === 0) return ""
  const sessionCount = sessions.length
  const dates = [...new Set(sessions.map((s) => s.date))]
  const dateStr = dates.length === 1
    ? formatDate(dates[0])
    : `${formatDate(dates[0])} – ${formatDate(dates[dates.length - 1])}`
  return `${sessionCount} session${sessionCount > 1 ? "s" : ""} · ${dateStr}`
}

type PlayerEntry = {
  jerseyNumber: string
  player: TryoutPlayer | null
  isFavorite: boolean
  hasNotes: boolean
  isInjured: boolean
}

function buildPlayerList(
  jerseyNumbers: string[],
  playerMap: Record<string, TryoutPlayer>,
  annotations: Record<string, { isFavorite: boolean, notes: string | null }>,
  ipPlayers: string[]
): PlayerEntry[] {
  const list = jerseyNumbers.map((jn) => {
    const player = playerMap[jn] ?? null
    const ann = player ? annotations[player.id] : undefined
    return {
      jerseyNumber: jn,
      player,
      isFavorite: ann?.isFavorite ?? false,
      hasNotes: !!(ann?.notes),
      isInjured: ipPlayers.includes(jn),
    }
  })
  list.sort(sortByPositionThenTeam)
  return list
}

export function RoundSection({
  teamLevel,
  division,
  latestRound,
  previousRound,
  playerMap,
  annotations,
  onToggleFavorite,
  onOpenHistory,
}: RoundSectionProps) {
  const sessions = (latestRound.sessions ?? []) as SessionData[]
  const sessionInfo = getSessionInfo(sessions)
  const ipPlayers = latestRound.ip_players ?? []

  const totalContinuing = latestRound.jersey_numbers.length

  // Build per-session player lists
  const sessionLists = sessions.map((s) => ({
    session: s,
    players: buildPlayerList(s.jersey_numbers, playerMap, annotations, ipPlayers),
  }))

  // Initial expanded state: all sessions + continuing + cuts expanded
  const [continuingExpanded, setContinuingExpanded] = useState(true)
  const [sessionExpanded, setSessionExpanded] = useState<Record<number, boolean>>(
    () => Object.fromEntries(sessions.map((s) => [s.session_number, true]))
  )
  const [cutsExpanded, setCutsExpanded] = useState(true)

  // Compute cuts
  const cuts = previousRound
    ? previousRound.jersey_numbers.filter((jn) => !latestRound.jersey_numbers.includes(jn))
    : []

  const cutPlayers = buildPlayerList(cuts, playerMap, annotations, [])

  const roundLabel = latestRound.is_final_team ? "Final Team" : `Round ${latestRound.round_number}`

  const toggleSession = (num: number) => {
    setSessionExpanded((prev) => ({ ...prev, [num]: !prev[num] }))
  }

  return (
    <div>
      <button
        className="continuations-header"
        onClick={() => onOpenHistory(teamLevel)}
      >
        <div className="continuations-header-left">
          <span className="continuations-header-title">
            {division} {teamLevel} — {roundLabel}
          </span>
          <Clock size={14} className="continuations-header-icon" />
        </div>
      </button>
      {sessionInfo && (
        <div className="continuations-session-info">{sessionInfo}</div>
      )}

      {/* Continuing section */}
      <button
        className="continuations-section-label"
        onClick={() => setContinuingExpanded(!continuingExpanded)}
      >
        <ChevronDown
          size={14}
          style={{ transform: continuingExpanded ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 200ms" }}
        />
        <span>Continuing ({totalContinuing})</span>
      </button>
      {continuingExpanded && (
        <div>
          {sessionLists.map(({ session, players }) => (
            <div key={session.session_number}>
              <button
                className="continuations-session-subheader"
                onClick={() => toggleSession(session.session_number)}
              >
                <ChevronDown
                  size={12}
                  style={{
                    transform: sessionExpanded[session.session_number] ? "rotate(0deg)" : "rotate(-90deg)",
                    transition: "transform 200ms",
                  }}
                />
                <span>
                  Session {session.session_number} · {formatTime(session.start_time)}–{formatTime(session.end_time)}
                </span>
                <span className="continuations-session-count">({players.length})</span>
              </button>
              {sessionExpanded[session.session_number] && (
                <div className="continuations-session-players">
                  {players.map((p) => (
                    <ContinuationPlayerRow
                      key={p.jerseyNumber}
                      jerseyNumber={p.jerseyNumber}
                      player={p.player}
                      isFavorite={p.isFavorite}
                      hasNotes={p.hasNotes}
                      isInjured={p.isInjured}
                      isCut={false}
                      onToggleFavorite={() => {
                        if (p.player) onToggleFavorite(p.player.id)
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Cuts section */}
      <button
        className="continuations-section-label"
        onClick={() => setCutsExpanded(!cutsExpanded)}
      >
        <ChevronDown
          size={14}
          style={{ transform: cutsExpanded ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 200ms" }}
        />
        <span>Cuts ({cutPlayers.length})</span>
      </button>
      {cutsExpanded && (
        <div>
          {cutPlayers.length === 0 ? (
            <p className="continuations-empty-cuts">No cuts yet</p>
          ) : (
            cutPlayers.map((p) => (
              <ContinuationPlayerRow
                key={p.jerseyNumber}
                jerseyNumber={p.jerseyNumber}
                player={p.player}
                isFavorite={p.isFavorite}
                hasNotes={p.hasNotes}
                isInjured={false}
                isCut={true}
                onToggleFavorite={() => {
                  if (p.player) onToggleFavorite(p.player.id)
                }}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
