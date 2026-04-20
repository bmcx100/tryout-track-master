"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import type { ContinuationRound, TryoutPlayer } from "@/types"
import { RoundSection } from "./round-section"
import { LongPressMenu } from "@/components/teams/long-press-menu"
import { PlayerPicker } from "./player-picker"
import { AddPlayerSheet } from "./add-player-sheet"
import {
  toggleFavorite,
  savePlayerNote,
  linkUnknownPlayer,
  suggestPlayerLink,
} from "@/app/(app)/continuations/actions"
import { saveCustomName } from "@/app/(app)/annotations/actions"
import { submitCorrection } from "@/app/(app)/corrections/actions"
import { adminUpdatePlayer } from "@/app/(app)/players/actions"

type Annotations = Record<string, { isFavorite: boolean, notes: string | null, customName: string | null }>

type ContinuationsPageClientProps = {
  players: TryoutPlayer[]
  rounds: ContinuationRound[]
  annotations: Annotations
  associationId: string
  division: string
  isAdmin: boolean
}

export function ContinuationsPageClient({
  players,
  rounds,
  annotations: initialAnnotations,
  associationId,
  division,
  isAdmin,
}: ContinuationsPageClientProps) {
  const router = useRouter()
  const [localPlayers, setLocalPlayers] = useState(players)
  const [annotations, setAnnotations] = useState(initialAnnotations)
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Sync local state when server props change (e.g. division switch)
  useEffect(() => { setLocalPlayers(players) }, [players])
  useEffect(() => { setAnnotations(initialAnnotations) }, [initialAnnotations])
  const [selectedPlayer, setSelectedPlayer] = useState<TryoutPlayer | null>(null)
  const [linkingJerseyNumber, setLinkingJerseyNumber] = useState<string | null>(null)
  const [addingPlayer, setAddingPlayer] = useState<{ jerseyNumber: string } | null>(null)

  // Build jersey-number-to-player lookup (keyed by jersey_number)
  const playerMap: Record<string, TryoutPlayer> = {}
  for (const player of localPlayers) {
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
          customName: existing?.customName ?? null,
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
            customName: existing?.customName ?? null,
          },
        }
      })
    }
  }, [])

  const handleSaveName = useCallback((playerId: string, customName: string) => {
    setAnnotations((prev) => {
      const existing = prev[playerId]
      const nameValue = customName || null
      if (existing) {
        return { ...prev, [playerId]: { ...existing, customName: nameValue } }
      }
      return { ...prev, [playerId]: { isFavorite: false, notes: null, customName: nameValue } }
    })
    saveCustomName(playerId, customName)
  }, [])

  const handleSaveNote = useCallback((playerId: string, note: string) => {
    setAnnotations((prev) => {
      const existing = prev[playerId]
      const noteValue = note || null
      if (existing) {
        return { ...prev, [playerId]: { ...existing, notes: noteValue } }
      }
      return { ...prev, [playerId]: { isFavorite: false, notes: noteValue, customName: null } }
    })
    savePlayerNote(playerId, note)
  }, [])

  const handleSubmitCorrection = useCallback((playerId: string, fieldName: string, oldValue: string, newValue: string) => {
    submitCorrection(playerId, fieldName, oldValue, newValue)
  }, [])

  const handleAdminUpdate = useCallback(async (playerId: string, updates: { name?: string, jersey_number?: string, position?: string, previous_team?: string }) => {
    const result = await adminUpdatePlayer(playerId, updates)
    if (!result.error) {
      setLocalPlayers((prev) =>
        prev.map((p) => p.id === playerId ? { ...p, ...updates } : p)
      )
    }
    return result
  }, [])

  const handleLinkUnknown = useCallback((jerseyNumber: string) => {
    setLinkingJerseyNumber(jerseyNumber)
  }, [])

  const handleLinkPlayer = useCallback(async (playerId: string) => {
    if (!linkingJerseyNumber) return
    if (isAdmin) {
      const result = await linkUnknownPlayer(playerId, linkingJerseyNumber)
      if (result.error) return
    } else {
      const result = await suggestPlayerLink(playerId, linkingJerseyNumber)
      if (result.error) return
    }
    setLinkingJerseyNumber(null)
    router.refresh()
  }, [linkingJerseyNumber, isAdmin, router])

  const handleAddPlayer = useCallback(() => {
    const jn = linkingJerseyNumber
    setLinkingJerseyNumber(null)
    if (jn) setAddingPlayer({ jerseyNumber: jn })
  }, [linkingJerseyNumber])

  const handlePlayerSaved = useCallback(() => {
    setAddingPlayer(null)
    router.refresh()
  }, [router])

  const selectedAnn = selectedPlayer ? annotations[selectedPlayer.id] : null

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
        onPlayerLongPress={setSelectedPlayer}
        onLinkUnknown={handleLinkUnknown}
      />

      {selectedPlayer && (
        <LongPressMenu
          player={selectedPlayer}
          isFavorite={selectedAnn?.isFavorite ?? false}
          customName={selectedAnn?.customName ?? null}
          note={selectedAnn?.notes ?? null}
          onClose={() => setSelectedPlayer(null)}
          onToggleFavorite={() => handleToggleFavorite(selectedPlayer.id)}
          onSaveName={(name) => handleSaveName(selectedPlayer.id, name)}
          onSaveNote={(note) => handleSaveNote(selectedPlayer.id, note)}
          onSubmitCorrection={(fieldName, oldValue, newValue) =>
            handleSubmitCorrection(selectedPlayer.id, fieldName, oldValue, newValue)
          }
          isAdmin={isAdmin}
          onAdminUpdate={isAdmin ? (updates) => handleAdminUpdate(selectedPlayer.id, updates) : undefined}
          context="continuations"
        />
      )}

      {linkingJerseyNumber && (
        <PlayerPicker
          jerseyNumber={linkingJerseyNumber}
          players={players}
          onLinkPlayer={handleLinkPlayer}
          onAddPlayer={handleAddPlayer}
          onClose={() => setLinkingJerseyNumber(null)}
        />
      )}

      {addingPlayer && (
        <AddPlayerSheet
          jerseyNumber={addingPlayer.jerseyNumber}
          division={division}
          associationId={associationId}
          isAdmin={isAdmin}
          onSave={handlePlayerSaved}
          onClose={() => setAddingPlayer(null)}
        />
      )}
    </div>
  )
}
