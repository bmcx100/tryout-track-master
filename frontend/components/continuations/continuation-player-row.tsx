"use client"

import { useRef, useCallback, useEffect, useContext } from "react"
import { Heart, SquarePen, Link2, GripVertical } from "lucide-react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import type { TryoutPlayer } from "@/types"
import { SwipeContext } from "@/components/teams/player-row"

type ContinuationPlayerRowProps = {
  jerseyNumber: string
  player: TryoutPlayer | null
  isFavorite: boolean
  noteText?: string | null
  isInjured: boolean
  isCut: boolean
  customName?: string | null
  sortableId?: string
  onToggleFavorite: () => void
  onEdit?: (player: TryoutPlayer) => void
  onLinkUnknown?: () => void
}

const SWIPE_THRESHOLD = 50
const DIRECTION_LOCK_RATIO = 1.5
const DIRECTION_LOCK_MIN = 15

export function ContinuationPlayerRow({
  jerseyNumber,
  player,
  isFavorite,
  noteText,
  isInjured,
  isCut,
  customName,
  sortableId,
  onToggleFavorite,
  onEdit,
  onLinkUnknown,
}: ContinuationPlayerRowProps) {
  const rowId = player?.id ?? `unknown-${jerseyNumber}`
  const { openRowId, setOpenRowId } = useContext(SwipeContext)
  const isSwiped = openRowId === rowId

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
    id: sortableId ?? jerseyNumber,
    disabled: !sortableId,
  })

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
      setOpenRowId(rowId)
    } else {
      contentRef.current.style.transform = "translateX(0px)"
      if (isSwiped) setOpenRowId(null)
    }

    touchStartRef.current = null
    directionLockedRef.current = null
  }, [isSwiped, rowId, setOpenRowId])

  const handleClick = useCallback(() => {
    if (isSwiped) {
      setOpenRowId(null)
      return
    }
    if (player && onEdit) {
      onEdit(player)
    } else if (!player && onLinkUnknown) {
      onLinkUnknown()
    }
  }, [isSwiped, player, onEdit, onLinkUnknown, setOpenRowId])

  const handleEditAction = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setOpenRowId(null)
    if (player && onEdit) {
      onEdit(player)
    } else if (!player && onLinkUnknown) {
      onLinkUnknown()
    }
  }, [player, onEdit, onLinkUnknown, setOpenRowId])

  const isUnknownInteractive = !player && !!onLinkUnknown
  const rowClass = [
    "continuation-player-row",
    isCut ? "continuation-player-row-cut" : "",
    isUnknownInteractive ? "unknown-interactive" : "",
  ].filter(Boolean).join(" ")

  const displayName = player
    ? (customName || player.name)
    : "Unknown"

  const sortableStyle = sortableId
    ? {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined

  return (
    <div
      ref={sortableId ? setNodeRef : undefined}
      style={sortableStyle}
      className="player-row-swipe-container"
    >
      <div
        ref={contentRef}
        className={`${rowClass} player-row-swipe-content${isSwiped ? " swiped" : ""}`}
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
            if (player && onEdit) onEdit(player)
            else if (!player && onLinkUnknown) onLinkUnknown()
          }
        }}
      >
        {sortableId && (
          <span
            className="player-drag-handle"
            {...attributes}
            {...listeners}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <GripVertical size={20} />
          </span>
        )}
        <span className={isCut ? "player-jersey continuation-jersey-cut" : "player-jersey"}>
          #{jerseyNumber}
        </span>
        {player && player.position && player.position !== "?" && (
          <span className="player-position">{player.position}</span>
        )}
        <span className="player-name">
          {displayName}
          {isUnknownInteractive && (
            <Link2 size={10} className="unknown-link-icon" />
          )}
          {customName && player && customName !== player.name && (
            <span className="custom-name-indicator">{player.name}</span>
          )}
          {isInjured && <span className="ip-badge">IP</span>}
        </span>
        <span className="continuation-row-right">
          <span
            className={noteText ? "note-btn note-btn-active" : "note-btn"}
            title={noteText || undefined}
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation()
              if (player && onEdit) onEdit(player)
            }}
          >
            <SquarePen size={14} />
          </span>
          <button
            className={isFavorite ? "favorite-btn favorite-btn-active" : "favorite-btn"}
            onClick={(e) => {
              e.stopPropagation()
              onToggleFavorite()
            }}
          >
            <Heart size={14} fill={isFavorite ? "currentColor" : "none"} />
          </button>
          {player?.previous_team && (
            <span className="player-prev-team">{player.previous_team}</span>
          )}
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
