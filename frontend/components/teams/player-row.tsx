"use client"

import { useRef, useCallback, useEffect, createContext, useContext } from "react"
import { GripVertical, Check, Heart, SquarePen, Clock } from "lucide-react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import type { TryoutPlayer } from "@/types"

/* ── Swipe state context ─────────────────────────── */

type SwipeContextType = {
  openRowId: string | null
  setOpenRowId: (id: string | null) => void
}

const SwipeContext = createContext<SwipeContextType>({
  openRowId: null,
  setOpenRowId: () => {},
})

export { SwipeContext }

/* ── Component ───────────────────────────────────── */

type PlayerRowProps = {
  player: TryoutPlayer
  isLocked: boolean
  isFavorite?: boolean
  isSuggested?: boolean
  customName?: string | null
  noteText?: string | null
  onEdit?: (player: TryoutPlayer) => void
  onToggleFavorite?: () => void
}

const SWIPE_THRESHOLD = 50
const DIRECTION_LOCK_RATIO = 1.5
const DIRECTION_LOCK_MIN = 15

export function PlayerRow({
  player,
  isLocked,
  isFavorite,
  isSuggested,
  customName,
  noteText,
  onEdit,
  onToggleFavorite,
}: PlayerRowProps) {
  const { openRowId, setOpenRowId } = useContext(SwipeContext)
  const isSwiped = openRowId === player.id

  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const swipeOffsetRef = useRef(0)
  const directionLockedRef = useRef<"horizontal" | "vertical" | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: player.id,
    disabled: isLocked,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  // Reset inline transform when another row opens (isSwiped becomes false)
  useEffect(() => {
    if (!isSwiped && contentRef.current) {
      contentRef.current.style.transition = "transform 200ms ease-out"
      contentRef.current.style.transform = "translateX(0px)"
    }
  }, [isSwiped])

  // Close on scroll
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
      setOpenRowId(player.id)
    } else {
      contentRef.current.style.transform = "translateX(0px)"
      if (isSwiped) setOpenRowId(null)
    }

    touchStartRef.current = null
    directionLockedRef.current = null
  }, [isSwiped, player.id, setOpenRowId])

  const handleClick = useCallback(() => {
    if (isSwiped) {
      setOpenRowId(null)
      return
    }
    onEdit?.(player)
  }, [isSwiped, onEdit, player, setOpenRowId])

  const handleEditAction = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setOpenRowId(null)
    onEdit?.(player)
  }, [onEdit, player, setOpenRowId])

  const displayName = customName || player.name

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="player-row-swipe-container"
    >
      <div
        ref={contentRef}
        className={`${isSuggested ? "player-row player-row-suggested" : "player-row"} player-row-swipe-content${isSwiped ? " swiped" : ""}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        aria-label={`Edit player ${displayName}`}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onEdit?.(player)
          }
        }}
      >
        <span
          className="player-drag-handle"
          {...(isLocked ? {} : { ...attributes, ...listeners })}
          onTouchStart={(e) => e.stopPropagation()}
        >
          {isLocked ? <Check size={14} /> : <GripVertical size={20} />}
        </span>
        <span className="player-jersey">#{player.jersey_number}</span>
        {player.position && player.position !== "?" && (
          <span className="player-position">{player.position}</span>
        )}
        <span className="player-name">
          {displayName}
          {customName && player.name && customName !== player.name && (
            <span className="custom-name-indicator">{player.name}</span>
          )}
        </span>
        <span className="continuation-row-right">
          <span
            className={noteText ? "note-btn note-btn-active" : "note-btn"}
            title={noteText || undefined}
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation()
              onEdit?.(player)
            }}
          >
            <SquarePen size={14} />
          </span>
          {onToggleFavorite && (
            <button
              className={isFavorite ? "favorite-btn favorite-btn-active" : "favorite-btn"}
              onClick={(e) => {
                e.stopPropagation()
                onToggleFavorite()
              }}
            >
              <Heart size={14} fill={isFavorite ? "currentColor" : "none"} />
            </button>
          )}
          {isSuggested ? (
            <span className="player-pending-badge">
              <Clock size={10} />
              Pending
            </span>
          ) : player.previous_team ? (
            <span className="player-prev-team">{player.previous_team}</span>
          ) : null}
        </span>
      </div>
      <button
        className="player-row-swipe-action"
        onClick={handleEditAction}
        aria-label={`Edit ${displayName}`}
      >
        Edit
      </button>
    </div>
  )
}
