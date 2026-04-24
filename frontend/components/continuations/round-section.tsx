"use client"

import { useState, useCallback, useMemo } from "react"
import { ChevronDown } from "lucide-react"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable"
import type { ContinuationRound, TryoutPlayer } from "@/types"
import { ContinuationPlayerRow } from "./continuation-player-row"

type SessionData = {
  session_number: number
  date: string
  start_time: string
  end_time: string
  jersey_numbers: string[]
}

type Annotations = Record<string, { isFavorite: boolean, notes: string | null, customName: string | null }>

type RoundSectionProps = {
  teamLevel: string
  division: string
  activeRound: ContinuationRound
  previousRound: ContinuationRound | null
  playerMap: Record<string, TryoutPlayer>
  annotations: Annotations
  activeView: "continuing" | "cuts"
  positionFilter?: string | null
  savedOrder?: string[]
  newPlayers?: string[]
  onToggleFavorite: (playerId: string) => void
  onPlayerEdit?: (player: TryoutPlayer) => void
  onLinkUnknown?: (jerseyNumber: string) => void
  onOrderChange?: (jerseyNumbers: string[]) => void
}

const POSITION_ORDER: Record<string, number> = { F: 0, D: 1, G: 2 }
const TIER_ORDER: Record<string, number> = { AA: 0, A: 1, BB: 2, B: 3, C: 4 }

function getPositionRank(player: TryoutPlayer | null): number {
  if (!player?.position || player.position === "?") return 3
  return POSITION_ORDER[player.position] ?? 3
}

// Blended rank: tier first (AA > A > BB > B > C), then age desc within tier (U15 > U13 > U11)
function getBlendedTeamRank(player: TryoutPlayer | null): number {
  if (!player?.previous_team) return 9999
  const match = player.previous_team.match(/U(\d+)(.+)/)
  if (!match) return 9999
  const age = parseInt(match[1])
  const tier = TIER_ORDER[match[2]] ?? 99
  // tier * 100 gives major grouping, subtract age so higher age sorts first
  return tier * 100 - age
}

function sortByPositionThenTeam(
  a: { player: TryoutPlayer | null },
  b: { player: TryoutPlayer | null }
): number {
  const posA = getPositionRank(a.player)
  const posB = getPositionRank(b.player)
  if (posA !== posB) return posA - posB
  return getBlendedTeamRank(a.player) - getBlendedTeamRank(b.player)
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00")
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
}

function formatTime(time: string): string {
  const [h, m] = time.split(":")
  const hour = parseInt(h)
  const ampm = hour >= 12 ? "pm" : "am"
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  return `${displayHour}:${m}${ampm}`
}

export function getSessionInfo(sessions: SessionData[]): string {
  if (!sessions || sessions.length === 0) return ""
  const sessionCount = sessions.length
  const dates = [...new Set(sessions.map((s) => s.date))]
  const dateStr = dates.length === 1
    ? formatDate(dates[0])
    : `${formatDate(dates[0])} – ${formatDate(dates[dates.length - 1])}`
  return `${sessionCount} session${sessionCount > 1 ? "s" : ""} · ${dateStr}`
}

type PlayerEntry = {
  jerseyNumber: string
  player: TryoutPlayer | null
  isFavorite: boolean
  noteText: string | null
  isInjured: boolean
  customName: string | null
}

function buildPlayerList(
  jerseyNumbers: string[],
  playerMap: Record<string, TryoutPlayer>,
  annotations: Annotations,
  ipPlayers: string[]
): PlayerEntry[] {
  return jerseyNumbers.map((jn) => {
    const player = playerMap[jn] ?? null
    const ann = player ? annotations[player.id] : undefined
    return {
      jerseyNumber: jn,
      player,
      isFavorite: ann?.isFavorite ?? false,
      noteText: ann?.notes ?? null,
      isInjured: ipPlayers.includes(jn),
      customName: ann?.customName ?? null,
    }
  })
}

function buildAndSortPlayerList(
  jerseyNumbers: string[],
  playerMap: Record<string, TryoutPlayer>,
  annotations: Annotations,
  ipPlayers: string[],
  savedOrder?: string[]
): PlayerEntry[] {
  const list = buildPlayerList(jerseyNumbers, playerMap, annotations, ipPlayers)
  if (savedOrder && savedOrder.length > 0) {
    return applySavedOrder(list, savedOrder)
  }
  list.sort(sortByPositionThenTeam)
  return list
}

function applySavedOrder(list: PlayerEntry[], savedOrder: string[]): PlayerEntry[] {
  const byJersey = new Map(list.map((p) => [p.jerseyNumber, p]))
  const ordered: PlayerEntry[] = []
  for (const jn of savedOrder) {
    const entry = byJersey.get(jn)
    if (entry) {
      ordered.push(entry)
      byJersey.delete(jn)
    }
  }
  // Append any new players not in the saved order
  const remaining = [...byJersey.values()]
  remaining.sort(sortByPositionThenTeam)
  return [...ordered, ...remaining]
}

/** After a drag, re-enforce position grouping while preserving intra-position order */
function enforcePositionGroups(list: PlayerEntry[]): PlayerEntry[] {
  const groups: Record<number, PlayerEntry[]> = {}
  for (const entry of list) {
    const rank = getPositionRank(entry.player)
    if (!groups[rank]) groups[rank] = []
    groups[rank].push(entry)
  }
  const result: PlayerEntry[] = []
  for (const rank of [0, 1, 2, 3]) {
    if (groups[rank]) result.push(...groups[rank])
  }
  return result
}

function matchesPositionFilter(entry: PlayerEntry, filter: string | null): boolean {
  if (!filter) return true
  if (filter === "?") {
    return !entry.player || !entry.player.position || entry.player.position === "?"
  }
  return entry.player?.position === filter
}

export function RoundSection({
  activeRound,
  previousRound,
  playerMap,
  annotations,
  activeView,
  positionFilter,
  savedOrder,
  newPlayers,
  onToggleFavorite,
  onPlayerEdit,
  onLinkUnknown,
  onOrderChange,
}: RoundSectionProps) {
  const sessions = useMemo(
    () => (activeRound.sessions ?? []) as SessionData[],
    [activeRound.sessions]
  )
  const ipPlayers = useMemo(
    () => activeRound.ip_players ?? [],
    [activeRound.ip_players]
  )

  const newPlayersSet = useMemo(
    () => new Set(newPlayers ?? []),
    [newPlayers]
  )

  // Build the full round's ordered list (all jersey numbers)
  const fullOrderedList = useMemo(
    () => buildAndSortPlayerList(
      activeRound.jersey_numbers,
      playerMap,
      annotations,
      ipPlayers,
      savedOrder
    ),
    [activeRound.jersey_numbers, playerMap, annotations, ipPlayers, savedOrder]
  )

  // Mutable ordered state for drag updates
  const [orderedList, setOrderedList] = useState<PlayerEntry[]>(fullOrderedList)

  // Build per-session player lists from the ordered list
  const sessionLists = useMemo(() => {
    return sessions
      .filter((s) => Array.isArray(s.jersey_numbers) && s.session_number != null)
      .map((s) => {
        const sessionJerseys = new Set(s.jersey_numbers)
        const players = orderedList.filter((p) => sessionJerseys.has(p.jerseyNumber))
        return { session: s, players }
      })
  }, [sessions, orderedList])

  // Session expand/collapse state
  const [sessionExpanded, setSessionExpanded] = useState<Record<number, boolean>>(
    () => Object.fromEntries(sessions.map((s) => [s.session_number, true]))
  )

  // Compute cuts (players in previous round of same team level not in this round)
  const cutPlayers = useMemo(() => {
    const cutJerseys = previousRound
      ? previousRound.jersey_numbers.filter((jn) => !activeRound.jersey_numbers.includes(jn))
      : []
    const list = buildPlayerList(cutJerseys, playerMap, annotations, [])
    list.sort(sortByPositionThenTeam)
    return list
  }, [previousRound, activeRound.jersey_numbers, playerMap, annotations])

  const toggleSession = (num: number) => {
    setSessionExpanded((prev) => ({ ...prev, [num]: !prev[num] }))
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setOrderedList((prev) => {
      const activeEntry = prev.find((p) => p.jerseyNumber === active.id)
      const overEntry = prev.find((p) => p.jerseyNumber === over.id)
      if (!activeEntry || !overEntry) return prev

      const activePos = getPositionRank(activeEntry.player)
      const overPos = getPositionRank(overEntry.player)

      let result: PlayerEntry[]
      if (activePos === overPos) {
        // Same position: normal reorder
        const oldIndex = prev.findIndex((p) => p.jerseyNumber === active.id)
        const newIndex = prev.findIndex((p) => p.jerseyNumber === over.id)
        result = enforcePositionGroups(arrayMove(prev, oldIndex, newIndex))
      } else {
        // Cross-position: move to top or bottom of position group
        const groups: Record<number, PlayerEntry[]> = {}
        for (const p of prev) {
          const rank = getPositionRank(p.player)
          if (!groups[rank]) groups[rank] = []
          groups[rank].push(p)
        }
        const posGroup = [...(groups[activePos] ?? [])]
        const idx = posGroup.findIndex((p) => p.jerseyNumber === activeEntry.jerseyNumber)
        if (idx === -1) return prev
        posGroup.splice(idx, 1)

        if (overPos < activePos) {
          // Dropped on higher position — overshot up → TOP
          posGroup.unshift(activeEntry)
        } else {
          // Dropped on lower position — overshot down → BOTTOM
          posGroup.push(activeEntry)
        }
        groups[activePos] = posGroup
        result = []
        for (const rank of [0, 1, 2, 3]) {
          if (groups[rank]) result.push(...groups[rank])
        }
      }

      onOrderChange?.(result.map((p) => p.jerseyNumber))
      return result
    })
  }, [onOrderChange])

  // Mutable ordered state for cuts drag updates
  const [cutOrderedList, setCutOrderedList] = useState<PlayerEntry[]>(cutPlayers)

  const handleCutDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setCutOrderedList((prev) => {
      const activeEntry = prev.find((p) => p.jerseyNumber === active.id)
      const overEntry = prev.find((p) => p.jerseyNumber === over.id)
      if (!activeEntry || !overEntry) return prev

      const activePos = getPositionRank(activeEntry.player)
      const overPos = getPositionRank(overEntry.player)

      if (activePos === overPos) {
        const oldIndex = prev.findIndex((p) => p.jerseyNumber === active.id)
        const newIndex = prev.findIndex((p) => p.jerseyNumber === over.id)
        return enforcePositionGroups(arrayMove(prev, oldIndex, newIndex))
      } else {
        const groups: Record<number, PlayerEntry[]> = {}
        for (const p of prev) {
          const rank = getPositionRank(p.player)
          if (!groups[rank]) groups[rank] = []
          groups[rank].push(p)
        }
        const posGroup = [...(groups[activePos] ?? [])]
        const idx = posGroup.findIndex((p) => p.jerseyNumber === activeEntry.jerseyNumber)
        if (idx === -1) return prev
        posGroup.splice(idx, 1)
        if (overPos < activePos) {
          posGroup.unshift(activeEntry)
        } else {
          posGroup.push(activeEntry)
        }
        groups[activePos] = posGroup
        const result: PlayerEntry[] = []
        for (const rank of [0, 1, 2, 3]) {
          if (groups[rank]) result.push(...groups[rank])
        }
        return result
      }
    })
  }, [])

  if (activeView === "cuts") {
    const displayCuts = positionFilter
      ? cutOrderedList.filter((p) => matchesPositionFilter(p, positionFilter))
      : cutOrderedList

    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleCutDragEnd}
      >
        <div className="continuations-cuts-list">
          {displayCuts.length === 0 ? (
            <p className="continuations-empty-cuts">No cuts yet</p>
          ) : (
            <SortableContext
              items={displayCuts.map((p) => p.jerseyNumber)}
              strategy={verticalListSortingStrategy}
            >
              {displayCuts.map((p) => {
                const ann = p.player ? annotations[p.player.id] : undefined
                return (
                  <ContinuationPlayerRow
                    key={p.jerseyNumber}
                    jerseyNumber={p.jerseyNumber}
                    player={p.player}
                    isFavorite={ann?.isFavorite ?? false}
                    noteText={ann?.notes ?? null}
                    isInjured={false}
                    isCut={false}
                    customName={ann?.customName ?? null}
                    sortableId={p.jerseyNumber}
                    onToggleFavorite={() => {
                      if (p.player) onToggleFavorite(p.player.id)
                    }}
                    onEdit={onPlayerEdit}
                    onLinkUnknown={!p.player && onLinkUnknown
                      ? () => onLinkUnknown(p.jerseyNumber)
                      : undefined
                    }
                  />
                )
              })}
            </SortableContext>
          )}
        </div>
      </DndContext>
    )
  }

  // Continuing view — with drag support
  const renderPlayerList = (players: PlayerEntry[]) => {
    const displayPlayers = positionFilter
      ? players.filter((p) => matchesPositionFilter(p, positionFilter))
      : players

    return (
      <SortableContext
        items={displayPlayers.map((p) => p.jerseyNumber)}
        strategy={verticalListSortingStrategy}
      >
        {displayPlayers.map((p) => {
          const ann = p.player ? annotations[p.player.id] : undefined
          return (
            <ContinuationPlayerRow
              key={p.jerseyNumber}
              jerseyNumber={p.jerseyNumber}
              player={p.player}
              isFavorite={ann?.isFavorite ?? false}
              noteText={ann?.notes ?? null}
              isInjured={p.isInjured}
              isNew={newPlayersSet.has(p.jerseyNumber)}
              isCut={false}
              customName={ann?.customName ?? null}
              sortableId={p.jerseyNumber}
              onToggleFavorite={() => {
                if (p.player) onToggleFavorite(p.player.id)
              }}
              onEdit={onPlayerEdit}
              onLinkUnknown={!p.player && onLinkUnknown
                ? () => onLinkUnknown(p.jerseyNumber)
                : undefined
              }
            />
          )
        })}
      </SortableContext>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      {sessionLists.length > 0 ? (
        sessionLists.map(({ session, players }) => (
          <div key={session.session_number}>
            <button
              className="continuations-session-subheader"
              onClick={() => toggleSession(session.session_number)}
            >
              <ChevronDown
                size={12}
                style={{
                  transform: sessionExpanded[session.session_number] ? "rotate(0deg)" : "rotate(-90deg)",
                  transition: "transform 200ms",
                }}
              />
              <span>
                Session {session.session_number} · {formatTime(session.start_time)}–{formatTime(session.end_time)}
              </span>
              <span className="continuations-session-count">({players.length})</span>
            </button>
            {sessionExpanded[session.session_number] && (
              <div className="continuations-session-players">
                {renderPlayerList(players)}
              </div>
            )}
          </div>
        ))
      ) : (
        <div className="continuations-session-players">
          {renderPlayerList(orderedList)}
        </div>
      )}
    </DndContext>
  )
}
