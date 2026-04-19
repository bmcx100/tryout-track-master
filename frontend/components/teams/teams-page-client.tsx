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

type TeamsPageClientProps = {
  players: TryoutPlayer[]
  teams: Team[]
  savedOrders: Record<string, string[]>
  savedPreviousOrders: Record<string, string[]>
  associationId: string
}

export function TeamsPageClient({
  players,
  teams,
  savedOrders,
  savedPreviousOrders,
  associationId,
}: TeamsPageClientProps) {
  const [activeView, setActiveView] = useState<"predictions" | "previous">("predictions")
  const [activePosition, setActivePosition] = useState<string | null>(null)
  const [resetKey, setResetKey] = useState(0)
  const [selectedPlayer, setSelectedPlayer] = useState<TryoutPlayer | null>(null)
  const [currentPredictionOrders, setCurrentPredictionOrders] = useState(savedOrders)
  const [currentPreviousOrders, setCurrentPreviousOrders] = useState(savedPreviousOrders)
  const [isResetting, setIsResetting] = useState(false)
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
          onOrderChange={handleOrderChange}
          onPlayerLongPress={setSelectedPlayer}
        />
      ) : (
        <PreviousTeamsView
          key={`previous-${resetKey}`}
          players={players}
          savedOrders={currentPreviousOrders}
          positionFilter={activePosition}
          onOrderChange={handlePreviousOrderChange}
          onPlayerLongPress={setSelectedPlayer}
        />
      )}

      {selectedPlayer && (
        <LongPressMenu
          player={selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </>
  )
}
