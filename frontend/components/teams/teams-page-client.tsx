"use client"

import { useState, useCallback, useRef } from "react"
import { Plus, Clock } from "lucide-react"
import type { TryoutPlayer, Team } from "@/types"
import { ViewToggle } from "./view-toggle"
import { PositionFilter } from "./position-filter"
import { PredictionBoard } from "./prediction-board"
import { PreviousTeamsView } from "./previous-teams-view"
import { LongPressMenu } from "./long-press-menu"
import { AddPlayerSheet } from "./add-player-sheet"
import {
  savePredictionOrder,
  savePreviousTeamOrder,
  resetPredictionOrders,
  resetPreviousTeamOrders,
} from "@/app/(app)/teams/actions"
import { toggleFavorite, saveCustomName, savePlayerNote } from "@/app/(app)/annotations/actions"
import { submitCorrection, suggestPlayer } from "@/app/(app)/corrections/actions"
import { adminUpdatePlayer, adminDeletePlayer } from "@/app/(app)/players/actions"

type Annotations = Record<string, { isFavorite: boolean, notes: string | null, customName: string | null }>

type TeamsPageClientProps = {
  players: TryoutPlayer[]
  teams: Team[]
  savedOrders: Record<string, string[]>
  savedPreviousOrders: Record<string, string[]>
  associationId: string
  division: string
  annotations: Annotations
  role: string
}

export function TeamsPageClient({
  players: initialPlayers,
  teams,
  savedOrders,
  savedPreviousOrders,
  associationId,
  division,
  annotations: initialAnnotations,
  role,
}: TeamsPageClientProps) {
  const isAdmin = role === "group_admin" || role === "admin"
  const [players, setPlayers] = useState(initialPlayers)
  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [activeView, setActiveView] = useState<"predictions" | "previous">("previous")
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
    setAnnotations((prev) => {
      const existing = prev[playerId]
      if (existing) {
        return { ...prev, [playerId]: { ...existing, isFavorite: !existing.isFavorite } }
      }
      return { ...prev, [playerId]: { isFavorite: true, notes: null, customName: null } }
    })
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
      // Optimistic update of local player data
      setPlayers((prev) =>
        prev.map((p) => p.id === playerId ? { ...p, ...updates } : p)
      )
    }
    return result
  }, [])

  const handleDelete = useCallback(async (playerId: string) => {
    const result = await adminDeletePlayer(playerId)
    if (!result.error) {
      setPlayers((prev) => prev.filter((p) => p.id !== playerId))
      setSelectedPlayer(null)
    }
  }, [])

  const handleSuggestPlayer = useCallback(async (
    name: string,
    jerseyNumber: string,
    position: string,
  ) => {
    const result = await suggestPlayer(associationId, division, name, jerseyNumber, position)
    if (result.player) {
      setPlayers((prev) => [...prev, result.player!])
      setShowAddPlayer(false)
    }
    return result
  }, [associationId, division])

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

      {!isAdmin && (
        <button className="add-player-row" onClick={() => setShowAddPlayer(true)}>
          <Plus size={14} />
          <span>Add a player</span>
          <Clock size={10} className="add-player-row-hint" />
          <span className="add-player-row-hint">Requires approval</span>
        </button>
      )}

      {showAddPlayer && (
        <AddPlayerSheet
          onClose={() => setShowAddPlayer(false)}
          onSubmit={handleSuggestPlayer}
        />
      )}

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
          onAdminUpdate={(updates) => handleAdminUpdate(selectedPlayer.id, updates)}
          onDelete={() => handleDelete(selectedPlayer.id)}
        />
      )}
    </>
  )
}
