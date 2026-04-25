"use client"

import { useState, useCallback, useRef } from "react"
import { Plus } from "lucide-react"
import type { TryoutPlayer, Team, Annotations } from "@/types"
import { ViewToggle } from "./view-toggle"
import { PositionFilter } from "./position-filter"
import { PredictionBoard } from "./prediction-board"
import { PreviousTeamsView } from "./previous-teams-view"
import { LongPressMenu } from "./long-press-menu"
import { AddPlayerSheet } from "./add-player-sheet"
import {
  savePredictionOrder,
  savePreviousTeamOrder,
  saveTeamGroupOrder,
  resetPredictionOrders,
  resetPreviousTeamOrders,
  resetTeamGroupOrders,
} from "@/app/(app)/teams/actions"
import { toggleFavorite, bulkToggleFavorite, savePlayerAnnotations, savePlayerNote } from "@/app/(app)/annotations/actions"
import { submitCorrection, suggestPlayer } from "@/app/(app)/corrections/actions"
import { adminUpdatePlayer, adminDeletePlayer } from "@/app/(app)/players/actions"

type TeamsPageClientProps = {
  players: TryoutPlayer[]
  teams: Team[]
  savedOrders: Record<string, string[]>
  savedPreviousOrders: Record<string, string[]>
  savedTeamGroupOrder: string[]
  associationId: string
  division: string
  annotations: Annotations
  role: string
}

const EMPTY_ANN = { isFavorite: false, notes: null, customName: null, customJersey: null, customPosition: null, customPreviousTeam: null, customTeam: null } as const

export function TeamsPageClient({
  players: initialPlayers,
  teams,
  savedOrders,
  savedPreviousOrders,
  savedTeamGroupOrder,
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
  const [currentTeamGroupOrder, setCurrentTeamGroupOrder] = useState<string[]>(savedTeamGroupOrder)
  const [isResetting, setIsResetting] = useState(false)
  const [annotations, setAnnotations] = useState<Annotations>(initialAnnotations)
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const savePreviousTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const teamGroupTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hasCustomOrder = activeView === "predictions"
    ? Object.keys(currentPredictionOrders).length > 0
    : Object.keys(currentPreviousOrders).length > 0 || currentTeamGroupOrder.length > 0

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

  const handleTeamGroupOrderChange = useCallback((teamOrder: string[]) => {
    setCurrentTeamGroupOrder(teamOrder)
    if (teamGroupTimer.current) clearTimeout(teamGroupTimer.current)
    teamGroupTimer.current = setTimeout(() => {
      saveTeamGroupOrder(associationId, division, teamOrder)
    }, 1000)
  }, [associationId, division])

  const handleReset = useCallback(() => {
    setIsResetting(true)
    setTimeout(() => setIsResetting(false), 500)

    setActivePosition(null)

    if (activePosition === null) {
      if (activeView === "predictions") {
        resetPredictionOrders(associationId)
        setCurrentPredictionOrders({})
      } else {
        resetPreviousTeamOrders(associationId)
        resetTeamGroupOrders(associationId)
        setCurrentPreviousOrders({})
        setCurrentTeamGroupOrder([])
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
      return { ...prev, [playerId]: { ...EMPTY_ANN, isFavorite: true } }
    })
    toggleFavorite(playerId)
  }, [])

  const handleBulkToggleFavorite = useCallback((playerIds: string[], setFavorite: boolean) => {
    setAnnotations((prev) => {
      const next = { ...prev }
      for (const id of playerIds) {
        const existing = next[id]
        if (existing) {
          next[id] = { ...existing, isFavorite: setFavorite }
        } else {
          next[id] = { ...EMPTY_ANN, isFavorite: setFavorite }
        }
      }
      return next
    })
    bulkToggleFavorite(playerIds, setFavorite)
  }, [])

  const handleSaveAnnotations = useCallback((playerId: string, annots: {
    customName?: string | null
    customJersey?: string | null
    customPosition?: string | null
    customPreviousTeam?: string | null
    customTeam?: string | null
  }) => {
    setAnnotations((prev) => {
      const existing = prev[playerId] ?? { ...EMPTY_ANN }
      return {
        ...prev,
        [playerId]: {
          ...existing,
          customName: annots.customName !== undefined ? (annots.customName || null) : existing.customName,
          customJersey: annots.customJersey !== undefined ? (annots.customJersey || null) : existing.customJersey,
          customPosition: annots.customPosition !== undefined ? (annots.customPosition || null) : existing.customPosition,
          customPreviousTeam: annots.customPreviousTeam !== undefined ? (annots.customPreviousTeam || null) : existing.customPreviousTeam,
          customTeam: annots.customTeam !== undefined ? (annots.customTeam || null) : existing.customTeam,
        },
      }
    })
    savePlayerAnnotations(playerId, annots)
  }, [])

  const handleSaveNote = useCallback((playerId: string, note: string) => {
    setAnnotations((prev) => {
      const existing = prev[playerId]
      const noteValue = note || null
      if (existing) {
        return { ...prev, [playerId]: { ...existing, notes: noteValue } }
      }
      return { ...prev, [playerId]: { ...EMPTY_ANN, notes: noteValue } }
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
    previousTeam: string,
  ) => {
    const result = await suggestPlayer(associationId, division, name, jerseyNumber, position, previousTeam)
    if (result.player) {
      setPlayers((prev) => [...prev, result.player!])
      setShowAddPlayer(false)
    }
    return result
  }, [associationId, division])

  const selectedAnn = selectedPlayer ? annotations[selectedPlayer.id] : null

  const dragHint = activeView === "previous"
    ? "Drag players to reorder in their\u00a0team"
    : "Drag players up and down between\u00a0teams"
  const instructionText = activePosition
    ? `Showing ${activePosition === "F" ? "forwards" : activePosition === "D" ? "defensemen" : "goalies"} only \u2014 drag to\u00a0reorder`
    : dragHint

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
          savedTeamGroupOrder={currentTeamGroupOrder}
          positionFilter={activePosition}
          annotations={annotations}
          onOrderChange={handleOrderChange}
          onPlayerEdit={setSelectedPlayer}
          onToggleFavorite={handleToggleFavorite}
        />
      ) : (
        <PreviousTeamsView
          key={`previous-${resetKey}`}
          players={players}
          savedOrders={currentPreviousOrders}
          savedTeamGroupOrder={currentTeamGroupOrder}
          positionFilter={activePosition}
          annotations={annotations}
          onOrderChange={handlePreviousOrderChange}
          onTeamGroupOrderChange={handleTeamGroupOrderChange}
          onPlayerEdit={setSelectedPlayer}
          onToggleFavorite={handleToggleFavorite}
          onBulkToggleFavorite={handleBulkToggleFavorite}
        />
      )}

      {!isAdmin && (
        <button className="add-player-row" onClick={() => setShowAddPlayer(true)}>
          <Plus size={14} />
          <span>Add a player</span>
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
          customJersey={selectedAnn?.customJersey ?? null}
          customPosition={selectedAnn?.customPosition ?? null}
          customPreviousTeam={selectedAnn?.customPreviousTeam ?? null}
          customTeam={selectedAnn?.customTeam ?? null}
          note={selectedAnn?.notes ?? null}
          onClose={() => setSelectedPlayer(null)}
          onToggleFavorite={() => handleToggleFavorite(selectedPlayer.id)}
          onSaveAnnotations={(annots) => handleSaveAnnotations(selectedPlayer.id, annots)}
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
