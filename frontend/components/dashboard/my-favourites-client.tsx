"use client"

import { useState, useCallback, useRef, useEffect, useContext, useMemo } from "react"
import Link from "next/link"
import { Heart, ChevronLeft } from "lucide-react"
import { LongPressMenu } from "@/components/teams/long-press-menu"
import { SwipeContext } from "@/components/teams/player-row"
import { toggleFavorite } from "@/app/(app)/annotations/actions"
import { saveCustomName, savePlayerNote } from "@/app/(app)/annotations/actions"
import { submitCorrection } from "@/app/(app)/corrections/actions"
import type { FavouritePagePlayer } from "@/app/(app)/dashboard/actions"
import type { TryoutPlayer } from "@/types"

type MyFavouritesClientProps = {
  favourites: FavouritePagePlayer[]
}

const STATUS_ORDER = ["continuing", "cut", "missing", "made_team", "registered"]

const STATUS_LABELS: Record<string, string> = {
  continuing: "Continuing",
  cut: "Cut",
  missing: "Missing",
  made_team: "Made Team",
  registered: "Registered",
}

type StatusGroup = {
  statusType: string
  players: FavouritePagePlayer[]
}

function buildStatusGroups(favs: FavouritePagePlayer[]): StatusGroup[] {
  const grouped = new Map<string, FavouritePagePlayer[]>()
  for (const f of favs) {
    const existing = grouped.get(f.statusType) ?? []
    existing.push(f)
    grouped.set(f.statusType, existing)
  }
  const groups: StatusGroup[] = []
  for (const st of STATUS_ORDER) {
    const players = grouped.get(st)
    if (players && players.length > 0) {
      groups.push({ statusType: st, players })
    }
  }
  return groups
}

function getMissingLevel(statusText: string): string {
  const match = statusText.match(/Not at (\w+)/)
  return match ? match[1] : ""
}

function buildTryoutPlayer(fav: FavouritePagePlayer): TryoutPlayer {
  return {
    id: fav.playerId,
    name: fav.playerRawName,
    jersey_number: fav.jerseyNumber,
    position: fav.position,
    division: fav.division,
    previous_team: fav.previousTeam,
    status: fav.statusType === "made_team" ? "made_team" : "trying_out",
    association_id: "",
    deleted_at: null,
    team_id: null,
    created_at: "",
    status_updated_at: "",
    suggested_by: null,
    updated_at: "",
  } as unknown as TryoutPlayer
}

/* ── Swipeable Favourite Row ─────────────────────── */

const SWIPE_THRESHOLD = 50
const DIRECTION_LOCK_RATIO = 1.5
const DIRECTION_LOCK_MIN = 15

function FavSwipeRow({
  fav,
  rowIdx,
  isUnhearted,
  isCut,
  isMissing,
  missingLevel,
  onToggleHeart,
  onEdit,
}: {
  fav: FavouritePagePlayer
  rowIdx: number
  isUnhearted: boolean
  isCut: boolean
  isMissing: boolean
  missingLevel: string
  onToggleHeart: (id: string) => void
  onEdit: (fav: FavouritePagePlayer) => void
}) {
  const { openRowId, setOpenRowId } = useContext(SwipeContext)
  const isSwiped = openRowId === fav.playerId

  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const swipeOffsetRef = useRef(0)
  const directionLockedRef = useRef<"horizontal" | "vertical" | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // Reset inline transform when another row opens (isSwiped becomes false)
  useEffect(() => {
    if (!isSwiped && contentRef.current) {
      contentRef.current.style.transition = "transform 200ms ease-out"
      contentRef.current.style.transform = "translateX(0px)"
    }
  }, [isSwiped])

  useEffect(() => {
    if (!isSwiped) return
    const handleScroll = () => setOpenRowId(null)
    window.addEventListener("scroll", handleScroll, { passive: true, capture: true })
    return () => window.removeEventListener("scroll", handleScroll, true)
  }, [isSwiped, setOpenRowId])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
    swipeOffsetRef.current = isSwiped ? -80 : 0
    directionLockedRef.current = null
  }, [isSwiped])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return
    const touch = e.touches[0]
    const dx = touch.clientX - touchStartRef.current.x
    const dy = touch.clientY - touchStartRef.current.y
    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)

    if (!directionLockedRef.current) {
      if (absDx < DIRECTION_LOCK_MIN && absDy < DIRECTION_LOCK_MIN) return
      directionLockedRef.current = absDx > absDy * DIRECTION_LOCK_RATIO ? "horizontal" : "vertical"
    }

    if (directionLockedRef.current !== "horizontal") return

    e.preventDefault()
    const offset = Math.min(0, Math.max(-80, swipeOffsetRef.current + dx))
    if (contentRef.current) {
      contentRef.current.style.transition = "none"
      contentRef.current.style.transform = `translateX(${offset}px)`
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (!touchStartRef.current || !contentRef.current) {
      touchStartRef.current = null
      return
    }

    const currentTransform = contentRef.current.style.transform
    const match = currentTransform.match(/translateX\((-?\d+(?:\.\d+)?)px\)/)
    const currentOffset = match ? parseFloat(match[1]) : 0

    contentRef.current.style.transition = "transform 200ms ease-out"

    if (currentOffset < -SWIPE_THRESHOLD) {
      contentRef.current.style.transform = "translateX(-80px)"
      setOpenRowId(fav.playerId)
    } else {
      contentRef.current.style.transform = "translateX(0px)"
      if (isSwiped) setOpenRowId(null)
    }

    touchStartRef.current = null
    directionLockedRef.current = null
  }, [isSwiped, fav.playerId, setOpenRowId])

  const handleClick = useCallback(() => {
    if (isSwiped) {
      setOpenRowId(null)
      return
    }
    onEdit(fav)
  }, [isSwiped, onEdit, fav, setOpenRowId])

  const handleEditAction = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setOpenRowId(null)
    onEdit(fav)
  }, [onEdit, fav, setOpenRowId])

  const rowClasses = [
    "my-favourites-row",
    isCut ? "my-favourites-row-cut" : "",
    isMissing ? "my-favourites-row-missing" : "",
    isUnhearted ? "my-favourites-row-unhearted" : "",
    rowIdx % 2 === 0 ? "my-favourites-row-even" : "my-favourites-row-odd",
  ].filter(Boolean).join(" ")

  return (
    <div className="player-row-swipe-container">
      <div
        ref={contentRef}
        className={`${rowClasses} player-row-swipe-content${isSwiped ? " swiped" : ""}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        aria-label={`Edit player ${fav.playerName}`}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onEdit(fav)
          }
        }}
      >
        <span className={isCut ? "player-jersey my-favourites-jersey-cut" : "player-jersey"}>
          #{fav.jerseyNumber}
        </span>
        {fav.position !== "?" && (
          <span className="player-position">{fav.position}</span>
        )}
        <button
          className={isUnhearted ? "favorite-btn" : "favorite-btn favorite-btn-active"}
          onClick={(e) => {
            e.stopPropagation()
            onToggleHeart(fav.playerId)
          }}
        >
          <Heart size={14} fill={isUnhearted ? "none" : "currentColor"} />
        </button>
        <span className="player-name">
          {fav.playerName}
          {fav.originalName && (
            <span className="custom-name-indicator">{fav.originalName}</span>
          )}
        </span>
        {missingLevel && (
          <span className="my-favourites-missing-level">Not at {missingLevel}</span>
        )}
        {fav.previousTeam && (
          <span className="player-prev-team">{fav.previousTeam}</span>
        )}
      </div>
      <button
        className="player-row-swipe-action"
        onClick={handleEditAction}
        aria-label={`Edit ${fav.playerName}`}
      >
        Edit
      </button>
    </div>
  )
}

/* ── Main component ──────────────────────────────── */

export function MyFavouritesClient({ favourites }: MyFavouritesClientProps) {
  const [unhearted, setUnhearted] = useState<Set<string>>(new Set())
  const [selectedPlayer, setSelectedPlayer] = useState<FavouritePagePlayer | null>(null)
  const [localFavourites, setLocalFavourites] = useState(favourites)
  const [swipeOpenRowId, setSwipeOpenRowId] = useState<string | null>(null)
  const swipeCtx = useMemo(() => ({ openRowId: swipeOpenRowId, setOpenRowId: setSwipeOpenRowId }), [swipeOpenRowId])

  const statusGroups = buildStatusGroups(localFavourites)
  const totalCount = localFavourites.length

  const handleToggleHeart = useCallback(async (playerId: string) => {
    setUnhearted((prev) => {
      const next = new Set(prev)
      if (next.has(playerId)) {
        next.delete(playerId)
      } else {
        next.add(playerId)
      }
      return next
    })
    await toggleFavorite(playerId)
  }, [])

  const handleSaveName = useCallback((playerId: string, name: string) => {
    setLocalFavourites((prev) =>
      prev.map((f) => {
        if (f.playerId !== playerId) return f
        const nameValue = name || null
        const displayName = name || f.playerRawName
        const originalName = nameValue && nameValue !== f.playerRawName ? f.playerRawName : null
        return { ...f, customName: nameValue, playerName: displayName, originalName }
      })
    )
    saveCustomName(playerId, name)
  }, [])

  const handleSaveNote = useCallback((playerId: string, note: string) => {
    setLocalFavourites((prev) =>
      prev.map((f) => f.playerId === playerId ? { ...f, notes: note || null } : f)
    )
    savePlayerNote(playerId, note)
  }, [])

  const handleSubmitCorrection = useCallback((playerId: string, fieldName: string, oldValue: string, newValue: string) => {
    submitCorrection(playerId, fieldName, oldValue, newValue)
  }, [])

  const handleDetailSheetToggleFavorite = useCallback(() => {
    if (!selectedPlayer) return
    handleToggleHeart(selectedPlayer.playerId)
  }, [selectedPlayer, handleToggleHeart])

  const handleEdit = useCallback((fav: FavouritePagePlayer) => {
    setSelectedPlayer(fav)
  }, [])

  if (totalCount === 0) {
    return (
      <div className="my-favourites-page">
        <Link href="/dashboard" className="my-favourites-back-line">
          <ChevronLeft size={12} />
          Back
        </Link>
        <div className="dashboard-empty">
          <Heart size={32} />
          <p>
            Heart players on the{" "}
            <Link href="/teams" className="dashboard-empty-link">Teams</Link>
            {" "}page to track them&nbsp;here.
          </p>
        </div>
      </div>
    )
  }

  return (
    <SwipeContext.Provider value={swipeCtx}>
      <div className="my-favourites-page">
        <Link href="/dashboard" className="my-favourites-back-line">
          <ChevronLeft size={12} />
          Back
        </Link>

        {statusGroups.map((group, groupIdx) => (
          <div key={group.statusType}>
            {groupIdx > 0 && <div className="my-favourites-group-divider" />}
            <div className="my-favourites-group">
              <div className={`my-favourites-group-header my-favourites-group-header-${group.statusType}`}>
                {group.statusType === "missing" && "\u26A0 "}
                {STATUS_LABELS[group.statusType]} ({group.players.length})
              </div>
              {group.players.map((fav, rowIdx) => {
                const isUnhearted = unhearted.has(fav.playerId)
                const isCut = fav.statusType === "cut"
                const isMissing = fav.statusType === "missing"
                const missingLevel = isMissing ? getMissingLevel(fav.statusText) : ""

                return (
                  <FavSwipeRow
                    key={fav.playerId}
                    fav={fav}
                    rowIdx={rowIdx}
                    isUnhearted={isUnhearted}
                    isCut={isCut}
                    isMissing={isMissing}
                    missingLevel={missingLevel}
                    onToggleHeart={handleToggleHeart}
                    onEdit={handleEdit}
                  />
                )
              })}
            </div>
          </div>
        ))}

        <div className="my-favourites-footer">
          {totalCount} player{totalCount !== 1 ? "s" : ""} tracked
        </div>

        {selectedPlayer && (
          <LongPressMenu
            player={buildTryoutPlayer(selectedPlayer)}
            isFavorite={!unhearted.has(selectedPlayer.playerId)}
            customName={selectedPlayer.customName}
            note={selectedPlayer.notes}
            onClose={() => setSelectedPlayer(null)}
            onToggleFavorite={handleDetailSheetToggleFavorite}
            onSaveName={(name) => handleSaveName(selectedPlayer.playerId, name)}
            onSaveNote={(note) => handleSaveNote(selectedPlayer.playerId, note)}
            onSubmitCorrection={(fieldName, oldValue, newValue) =>
              handleSubmitCorrection(selectedPlayer.playerId, fieldName, oldValue, newValue)
            }
          />
        )}
      </div>
    </SwipeContext.Provider>
  )
}
