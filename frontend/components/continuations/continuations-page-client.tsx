"use client"

import { useState, useCallback, useEffect, useRef, useMemo } from "react"
import { useRouter } from "next/navigation"
import type { ContinuationRound, TryoutPlayer } from "@/types"
import { RoundSection, getSessionInfo } from "./round-section"
import { SessionsToggle } from "./sessions-toggle"
import { PositionFilter } from "@/components/teams/position-filter"
import { LongPressMenu } from "@/components/teams/long-press-menu"
import { PlayerPicker } from "./player-picker"
import { SwipeContext } from "@/components/teams/player-row"
import { AddPlayerSheet } from "./add-player-sheet"
import {
  toggleFavorite,
  savePlayerNote,
  linkUnknownPlayer,
  suggestPlayerLink,
  saveContinuationOrder,
  resetContinuationOrder,
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
  savedOrders?: Record<string, string[]>
}

export function ContinuationsPageClient({
  players,
  rounds,
  annotations: initialAnnotations,
  associationId,
  division,
  isAdmin,
  savedOrders: initialSavedOrders,
}: ContinuationsPageClientProps) {
  const router = useRouter()
  const [localPlayers, setLocalPlayers] = useState(players)
  const [annotations, setAnnotations] = useState(initialAnnotations)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [activeView, setActiveView] = useState<"continuing" | "cuts">("continuing")
  const [activePosition, setActivePosition] = useState<string | null>(null)
  const [isResetting, setIsResetting] = useState(false)
  const [currentOrders, setCurrentOrders] = useState<Record<string, string[]>>(initialSavedOrders ?? {})
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync local state when server props change (e.g. division switch)
  useEffect(() => { setLocalPlayers(players) }, [players])
  useEffect(() => { setAnnotations(initialAnnotations) }, [initialAnnotations])
  useEffect(() => { setCurrentOrders(initialSavedOrders ?? {}) }, [initialSavedOrders])
  const [selectedPlayer, setSelectedPlayer] = useState<TryoutPlayer | null>(null)
  const [linkingJerseyNumber, setLinkingJerseyNumber] = useState<string | null>(null)
  const [swipeOpenRowId, setSwipeOpenRowId] = useState<string | null>(null)
  const swipeCtx = useMemo(() => ({ openRowId: swipeOpenRowId, setOpenRowId: setSwipeOpenRowId }), [swipeOpenRowId])
  const [addingPlayer, setAddingPlayer] = useState<{ jerseyNumber: string } | null>(null)

  // Build jersey-number-to-player lookup (keyed by jersey_number)
  const playerMap: Record<string, TryoutPlayer> = {}
  for (const player of localPlayers) {
    if (player.jersey_number) {
      playerMap[player.jersey_number] = player
    }
  }

  // Reset toggle and position filter when round changes
  const handleRoundChange = (index: number) => {
    setSelectedIndex(index)
    setActiveView("continuing")
    setActivePosition(null)
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

  // Drag order handling with debounced save
  const handleOrderChange = useCallback((jerseyNumbers: string[]) => {
    const roundId = rounds[selectedIndex]?.id
    if (!roundId) return

    setCurrentOrders((prev) => ({ ...prev, [roundId]: jerseyNumbers }))

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      saveContinuationOrder(roundId, jerseyNumbers)
    }, 1000)
  }, [rounds, selectedIndex])

  // Reset handler
  const handleReset = useCallback(async () => {
    const roundId = rounds[selectedIndex]?.id
    if (!roundId) return

    setIsResetting(true)
    setCurrentOrders((prev) => {
      const next = { ...prev }
      delete next[roundId]
      return next
    })

    await resetContinuationOrder(roundId)
    setTimeout(() => setIsResetting(false), 500)
  }, [rounds, selectedIndex])

  const selectedAnn = selectedPlayer ? annotations[selectedPlayer.id] : null

  if (rounds.length === 0) {
    return (
      <div className="continuations-empty">
        <p className="continuations-empty-text">No tryout results posted&nbsp;yet</p>
      </div>
    )
  }

  const activeRound = rounds[selectedIndex]
  const hasCustomOrder = !!(currentOrders[activeRound.id] && currentOrders[activeRound.id].length > 0)

  // Find the previous round for the SAME team level (for computing cuts)
  const previousRound = rounds.find(
    (r, idx) => idx > selectedIndex && r.team_level === activeRound.team_level
  ) ?? null

  // Compute summary stats
  const totalContinuing = activeRound.jersey_numbers.length
  const cuts = previousRound
    ? previousRound.jersey_numbers.filter((jn) => !activeRound.jersey_numbers.includes(jn))
    : []
  const cutCount = cuts.length
  const newPlayers = previousRound
    ? activeRound.jersey_numbers.filter((jn) => !previousRound.jersey_numbers.includes(jn))
    : []
  const newCount = newPlayers.length
  const sessions = (activeRound.sessions ?? []) as { session_number: number, date: string, start_time: string, end_time: string, jersey_numbers: string[] }[]
  const computedSessionInfo = getSessionInfo(sessions)
  const sessionInfo = activeRound.session_info || computedSessionInfo

  // Build dropdown label for each round
  const getRoundLabel = (round: ContinuationRound) => {
    const label = round.is_final_team ? "Final Team" : `Round ${round.round_number}`
    return `${division} ${round.team_level} - ${label}`
  }

  // Compute position counts for the active round
  const positionCounts: Record<string, number> = { F: 0, D: 0, G: 0, "?": 0 }
  for (const jn of activeRound.jersey_numbers) {
    const p = playerMap[jn]
    const pos = p?.position && p.position !== "?" ? p.position : "?"
    positionCounts[pos] = (positionCounts[pos] ?? 0) + 1
  }

  // Compute IP count
  const ipPlayers = activeRound.ip_players ?? []
  const ipCount = ipPlayers.length

  return (
    <SwipeContext.Provider value={swipeCtx}>
    <div className="continuations-page">
      {/* Summary card with dropdown + badges */}
      <div className="sessions-summary-card">
        <div className="sessions-summary-row">
          {rounds.length > 1 ? (
            <select
              className="continuations-round-select"
              value={selectedIndex}
              onChange={(e) => handleRoundChange(Number(e.target.value))}
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
          <div className="sessions-summary-badges">
            {newCount > 0 && (
              <span className="sessions-badge sessions-badge-new">
                {newCount} new
              </span>
            )}
            {ipCount > 0 && (
              <span className="sessions-badge sessions-badge-ip">
                {ipCount} IP
              </span>
            )}
          </div>
        </div>
        {sessionInfo && (
          <div className="sessions-summary-session-info">{sessionInfo}</div>
        )}
      </div>

      {/* Continuing / Cuts toggle */}
      <SessionsToggle
        activeView={activeView}
        onViewChange={setActiveView}
        continuingCount={totalContinuing}
        cutCount={cutCount}
        isFinalTeam={activeRound.is_final_team}
      />

      {/* Position filter */}
      <PositionFilter
        activePosition={activePosition}
        onPositionChange={setActivePosition}
        onReset={handleReset}
        isResetting={isResetting}
        hasCustomOrder={hasCustomOrder}
        showUnknown={true}
        positionCounts={positionCounts}
      />

      <RoundSection
        key={`${activeRound.id}-${activeView}-${hasCustomOrder}`}
        teamLevel={activeRound.team_level}
        division={division}
        activeRound={activeRound}
        previousRound={previousRound}
        playerMap={playerMap}
        annotations={annotations}
        activeView={activeView}
        positionFilter={activePosition}
        savedOrder={currentOrders[activeRound.id]}
        newPlayers={newPlayers}
        onToggleFavorite={handleToggleFavorite}
        onPlayerEdit={setSelectedPlayer}
        onLinkUnknown={handleLinkUnknown}
        onOrderChange={handleOrderChange}
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
    </SwipeContext.Provider>
  )
}
