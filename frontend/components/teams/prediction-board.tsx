"use client"

import type { Player, Team } from "@/types"
import { TeamSection } from "./team-section"

type PredictionBoardProps = {
  players: Player[]
  teams: Team[]
  onPlayerLongPress?: (player: Player) => void
}

export function PredictionBoard({ players, teams, onPlayerLongPress }: PredictionBoardProps) {
  const sortedTeams = [...teams].sort((a, b) => a.display_order - b.display_order)

  // Split players into official (assigned to a team) and predicted (unassigned)
  const officialByTeam = new Map<string, Player[]>()
  const predictedPlayers: Player[] = []

  for (const player of players) {
    const officialTeam = sortedTeams.find(
      (t) => t.is_official && t.id === player.team_id
    )
    if (officialTeam) {
      const existing = officialByTeam.get(officialTeam.id) ?? []
      existing.push(player)
      officialByTeam.set(officialTeam.id, existing)
    } else {
      predictedPlayers.push(player)
    }
  }

  // Build sections: official teams first (locked), then predicted teams from remaining players
  const sections: {
    key: string
    teamName: string
    players: Player[]
    isOfficial: boolean
  }[] = []

  for (const team of sortedTeams) {
    const official = officialByTeam.get(team.id)
    if (official && official.length > 0) {
      sections.push({
        key: `official-${team.id}`,
        teamName: team.name,
        players: official,
        isOfficial: true,
      })
    }
  }

  // Distribute remaining players across predicted teams
  const predictedTeams = sortedTeams.filter((t) => !t.is_official)
  let offset = 0
  for (const team of predictedTeams) {
    const slice = predictedPlayers.slice(offset, offset + team.max_roster_size)
    if (slice.length > 0) {
      sections.push({
        key: `predicted-${team.id}`,
        teamName: team.name,
        players: slice,
        isOfficial: false,
      })
      offset += team.max_roster_size
    }
  }

  return (
    <div>
      {sections.map((section, i) => (
        <TeamSection
          key={section.key}
          teamName={section.teamName}
          players={section.players}
          isOfficial={section.isOfficial}
          index={i}
          onPlayerLongPress={onPlayerLongPress}
        />
      ))}
    </div>
  )
}
