"use client"

import { useState, useCallback } from "react"
import type { ContinuationRound, TryoutPlayer } from "@/types"
import { RoundSection } from "./round-section"
import { RoundHistoryModal } from "./round-history-modal"
import { toggleFavorite } from "@/app/(app)/continuations/actions"

type ContinuationsPageClientProps = {
  players: TryoutPlayer[]
  rounds: { teamLevel: string, latestRound: ContinuationRound, previousRound: ContinuationRound | null }[]
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
  const [historyTeamLevel, setHistoryTeamLevel] = useState<string | null>(null)

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

  return (
    <div className="continuations-page">
      {rounds.map((r) => (
        <RoundSection
          key={r.teamLevel}
          teamLevel={r.teamLevel}
          division={division}
          latestRound={r.latestRound}
          previousRound={r.previousRound}
          playerMap={playerMap}
          annotations={annotations}
          onToggleFavorite={handleToggleFavorite}
          onOpenHistory={setHistoryTeamLevel}
        />
      ))}
      <RoundHistoryModal
        teamLevel={historyTeamLevel ?? ""}
        division={division}
        associationId={associationId}
        isOpen={historyTeamLevel !== null}
        onClose={() => setHistoryTeamLevel(null)}
      />
    </div>
  )
}
