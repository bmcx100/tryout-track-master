"use client"

import { useState, useCallback } from "react"
import type { ContinuationRound, TryoutPlayer } from "@/types"
import { RoundSection } from "./round-section"
import { toggleFavorite } from "@/app/(app)/continuations/actions"

type ContinuationsPageClientProps = {
  players: TryoutPlayer[]
  rounds: ContinuationRound[]
  annotations: Record<string, { isFavorite: boolean, notes: string | null }>
  associationId: string
  division: string
}

export function ContinuationsPageClient({
  players,
  rounds,
  annotations: initialAnnotations,
  associationId,
  division,
}: ContinuationsPageClientProps) {
  const [annotations, setAnnotations] = useState(initialAnnotations)
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Build jersey-number-to-player lookup (keyed by jersey_number)
  const playerMap: Record<string, TryoutPlayer> = {}
  for (const player of players) {
    if (player.jersey_number) {
      playerMap[player.jersey_number] = player
    }
  }

  const handleToggleFavorite = useCallback(async (playerId: string) => {
    // Optimistic update
    setAnnotations((prev) => {
      const existing = prev[playerId]
      return {
        ...prev,
        [playerId]: {
          isFavorite: existing ? !existing.isFavorite : true,
          notes: existing?.notes ?? null,
        },
      }
    })

    // Server call
    const result = await toggleFavorite(playerId)
    if (result.error) {
      // Revert on error
      setAnnotations((prev) => {
        const existing = prev[playerId]
        return {
          ...prev,
          [playerId]: {
            isFavorite: existing ? !existing.isFavorite : false,
            notes: existing?.notes ?? null,
          },
        }
      })
    }
  }, [])

  if (rounds.length === 0) {
    return (
      <div className="continuations-empty">
        <p className="continuations-empty-text">No tryout results posted&nbsp;yet</p>
      </div>
    )
  }

  const activeRound = rounds[selectedIndex]

  // Find the previous round for the SAME team level (for computing cuts)
  const previousRound = rounds.find(
    (r, idx) => idx > selectedIndex && r.team_level === activeRound.team_level
  ) ?? null

  // Build dropdown label for each round
  const getRoundLabel = (round: ContinuationRound) => {
    const label = round.is_final_team ? "Final Team" : `Round ${round.round_number}`
    return `${division} ${round.team_level} - ${label}`
  }

  return (
    <div className="continuations-page">
      <div className="continuations-header">
        <div className="continuations-header-left">
          {rounds.length > 1 ? (
            <select
              className="continuations-round-select"
              value={selectedIndex}
              onChange={(e) => setSelectedIndex(Number(e.target.value))}
            >
              {rounds.map((r, idx) => (
                <option key={r.id} value={idx}>
                  {getRoundLabel(r)}
                </option>
              ))}
            </select>
          ) : (
            <span className="continuations-header-title">
              {getRoundLabel(activeRound)}
            </span>
          )}
        </div>
      </div>

      <RoundSection
        key={activeRound.id}
        teamLevel={activeRound.team_level}
        division={division}
        activeRound={activeRound}
        previousRound={previousRound}
        playerMap={playerMap}
        annotations={annotations}
        onToggleFavorite={handleToggleFavorite}
      />
    </div>
  )
}
