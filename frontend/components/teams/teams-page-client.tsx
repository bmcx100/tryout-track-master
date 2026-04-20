"use client"

import { useState, useCallback, useRef } from "react"
import type { TryoutPlayer, Team } from "@/types"
import { ViewToggle } from "./view-toggle"
import { PositionFilter } from "./position-filter"
import { PredictionBoard } from "./prediction-board"
import { PreviousTeamsView } from "./previous-teams-view"
import { LongPressMenu } from "./long-press-menu"
import {
  savePredictionOrder,
  savePreviousTeamOrder,
  resetPredictionOrders,
  resetPreviousTeamOrders,
} from "@/app/(app)/teams/actions"
import { toggleFavorite, saveCustomName } from "@/app/(app)/annotations/actions"

type Annotations = Record<string, { isFavorite: boolean, notes: string | null, customName: string | null }>

type TeamsPageClientProps = {
  players: TryoutPlayer[]
  teams: Team[]
  savedOrders: Record<string, string[]>
  savedPreviousOrders: Record<string, string[]>
  associationId: string
  annotations: Annotations
}

export function TeamsPageClient({
  players,
  teams,
  savedOrders,
  savedPreviousOrders,
  associationId,
  annotations: initialAnnotations,
}: TeamsPageClientProps) {
  const [activeView, setActiveView] = useState<"predictions" | "previous">("predictions")
  const [activePosition, setActivePosition] = useState<string | null>(null)
  const [resetKey, setResetKey] = useState(0)
  const [selectedPlayer, setSelectedPlayer] = useState<TryoutPlayer | null>(null)
  const [currentPredictionOrders, setCurrentPredictionOrders] = useState(savedOrders)
  const [currentPreviousOrders, setCurrentPreviousOrders] = useState(savedPreviousOrders)
  const [isResetting, setIsResetting] = useState(false)
  const [annotations, setAnnotations] = useState<Annotations>(initialAnnotations)
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const savePreviousTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const hasCustomOrder = activeView === "predictions"
    ? Object.keys(currentPredictionOrders).length > 0
    : Object.keys(currentPreviousOrders).length > 0

  const handleOrderChange = useCallback((division: string, playerIds: string[]) => {
    setCurrentPredictionOrders((prev) => ({ ...prev, [division]: playerIds }))
    if (saveTimers.current[division]) clearTimeout(saveTimers.current[division])
    saveTimers.current[division] = setTimeout(() => {
      savePredictionOrder(associationId, division, playerIds)
    }, 1000)
  }, [associationId])

  const handlePreviousOrderChange = useCallback((previousTeam: string, playerIds: string[]) => {
    setCurrentPreviousOrders((prev) => ({ ...prev, [previousTeam]: playerIds }))
    if (savePreviousTimers.current[previousTeam]) clearTimeout(savePreviousTimers.current[previousTeam])
    savePreviousTimers.current[previousTeam] = setTimeout(() => {
      savePreviousTeamOrder(associationId, previousTeam, playerIds)
    }, 1000)
  }, [associationId])

  const handleReset = useCallback(() => {
    setIsResetting(true)
    setTimeout(() => setIsResetting(false), 500)

    if (activePosition === null) {
      if (activeView === "predictions") {
        resetPredictionOrders(associationId)
        setCurrentPredictionOrders({})
      } else {
        resetPreviousTeamOrders(associationId)
        setCurrentPreviousOrders({})
      }
    }
    setResetKey((k) => k + 1)
  }, [activePosition, activeView, associationId])

  const handleToggleFavorite = useCallback((playerId: string) => {
    // Optimistic update
    setAnnotations((prev) => {
      const existing = prev[playerId]
      if (existing) {
        return { ...prev, [playerId]: { ...existing, isFavorite: !existing.isFavorite } }
      }
      return { ...prev, [playerId]: { isFavorite: true, notes: null, customName: null } }
    })
    // Server action (fire and forget)
    toggleFavorite(playerId)
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

  const selectedAnn = selectedPlayer ? annotations[selectedPlayer.id] : null

  const instructionText = activePosition
    ? `Showing ${activePosition === "F" ? "forwards" : activePosition === "D" ? "defensemen" : "goalies"} only \u2014 drag to\u00a0reorder`
    : "Drag players up and down between\u00a0teams"

  return (
    <>
      <ViewToggle activeView={activeView} onViewChange={setActiveView} />
      <PositionFilter
        activePosition={activePosition}
        onPositionChange={setActivePosition}
        onReset={handleReset}
        isResetting={isResetting}
        hasCustomOrder={hasCustomOrder}
      />
      <p className="instruction-line">{instructionText}</p>

      {activeView === "predictions" ? (
        <PredictionBoard
          key={`predictions-${resetKey}`}
          players={players}
          teams={teams}
          savedOrders={currentPredictionOrders}
          savedPreviousOrders={currentPreviousOrders}
          positionFilter={activePosition}
          annotations={annotations}
          onOrderChange={handleOrderChange}
          onPlayerLongPress={setSelectedPlayer}
          onToggleFavorite={handleToggleFavorite}
        />
      ) : (
        <PreviousTeamsView
          key={`previous-${resetKey}`}
          players={players}
          savedOrders={currentPreviousOrders}
          positionFilter={activePosition}
          annotations={annotations}
          onOrderChange={handlePreviousOrderChange}
          onPlayerLongPress={setSelectedPlayer}
          onToggleFavorite={handleToggleFavorite}
        />
      )}

      {selectedPlayer && (
        <LongPressMenu
          player={selectedPlayer}
          isFavorite={selectedAnn?.isFavorite ?? false}
          customName={selectedAnn?.customName ?? null}
          onClose={() => setSelectedPlayer(null)}
          onToggleFavorite={() => handleToggleFavorite(selectedPlayer.id)}
          onSaveName={(name) => handleSaveName(selectedPlayer.id, name)}
        />
      )}
    </>
  )
}
