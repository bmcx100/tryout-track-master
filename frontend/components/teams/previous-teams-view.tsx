"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import type { Player } from "@/types"

type PreviousTeamsViewProps = {
  players: Player[]
}

function groupByPreviousTeam(players: Player[]): Map<string, Player[]> {
  const groups = new Map<string, Player[]>()
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
  players: Player[]
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
              {player.position && (
                <span className="player-position">{player.position}</span>
              )}
              <span className="player-name">{player.name}</span>
              <span className="prev-teams-status">{formatStatus(player.status)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function formatStatus(status: Player["status"]): string {
  const labels: Record<Player["status"], string> = {
    registered: "Registered",
    trying_out: "Trying Out",
    cut: "Cut",
    made_team: "Made Team",
    moved_up: "Moved Up",
    moved_down: "Moved Down",
    withdrew: "Withdrew",
  }
  return labels[status]
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
