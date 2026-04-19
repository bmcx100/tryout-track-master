"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import type { TryoutPlayer } from "@/types"
import { STATUS_LABELS } from "@/types"

type PreviousTeamsViewProps = {
  players: TryoutPlayer[]
}

function groupByPreviousTeam(players: TryoutPlayer[]): Map<string, TryoutPlayer[]> {
  const groups = new Map<string, TryoutPlayer[]>()
  for (const player of players) {
    const key = player.previous_team ?? "Unknown"
    const existing = groups.get(key) ?? []
    existing.push(player)
    groups.set(key, existing)
  }
  return groups
}

function PreviousTeamSection({
  label,
  players,
  index,
}: {
  label: string
  players: TryoutPlayer[]
  index: number
}) {
  const [isExpanded, setIsExpanded] = useState(true)
  const toneClass = index % 2 === 0 ? "team-header-tone-1" : "team-header-tone-2"

  return (
    <div>
      <button
        className={`team-header ${toneClass}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="team-header-left">
          <span className="team-name">From {label}</span>
          <span className="team-count">{players.length} Players</span>
        </div>
        <ChevronDown
          size={16}
          className="team-chevron"
          style={{ transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)" }}
        />
      </button>
      {isExpanded && (
        <div>
          {players.map((player) => (
            <div key={player.id} className="player-row">
              <span className="player-jersey">#{player.jersey_number}</span>
              {player.position && player.position !== "?" && (
                <span className="player-position">{player.position}</span>
              )}
              <span className="player-name">{player.name}</span>
              <span className="prev-teams-status">{STATUS_LABELS[player.status] ?? player.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function PreviousTeamsView({ players }: PreviousTeamsViewProps) {
  const groups = groupByPreviousTeam(players)

  return (
    <div>
      {Array.from(groups.entries()).map(([label, groupPlayers], i) => (
        <PreviousTeamSection
          key={label}
          label={label}
          players={groupPlayers}
          index={i}
        />
      ))}
    </div>
  )
}
