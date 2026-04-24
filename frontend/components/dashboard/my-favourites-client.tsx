"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import { Heart, ChevronLeft, GripVertical, SquarePen } from "lucide-react"
import { LongPressMenu } from "@/components/teams/long-press-menu"
import { toggleFavorite } from "@/app/(app)/annotations/actions"
import { saveCustomName, savePlayerNote } from "@/app/(app)/annotations/actions"
import { submitCorrection } from "@/app/(app)/corrections/actions"
import type { FavouritePagePlayer } from "@/app/(app)/dashboard/actions"
import type { TryoutPlayer } from "@/types"

type MyFavouritesClientProps = {
  favourites: FavouritePagePlayer[]
}

const STATUS_ORDER = ["continuing", "made_team", "cut", "missing", "registered"]

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
  const match = statusText.match(/(?:Missing|Not) at (\w+)/)
  return match ? match[1] : ""
}

function getStatusLabel(statusType: string, players: FavouritePagePlayer[]): string {
  if (statusType === "cut") {
    const isFinal = players.some((p) => p.roundType === "final")
    return isFinal ? "Final Cut" : "Cut"
  }
  return STATUS_LABELS[statusType] ?? statusType
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

/* ── Favourite Row ────────────────────────────────── */

function FavRow({
  fav,
  isUnhearted,
  isCut,
  isMissing,
  missingLevel,
  onToggleHeart,
  onEdit,
}: {
  fav: FavouritePagePlayer
  isUnhearted: boolean
  isCut: boolean
  isMissing: boolean
  missingLevel: string
  onToggleHeart: (id: string) => void
  onEdit: (fav: FavouritePagePlayer) => void
}) {
  const rowClass = [
    "continuation-player-row",
    isCut ? "continuation-player-row-cut" : "",
    isMissing ? "my-favourites-row-missing" : "",
    isUnhearted ? "my-favourites-row-unhearted" : "",
  ].filter(Boolean).join(" ")

  return (
    <div
      className={rowClass}
      onClick={() => onEdit(fav)}
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
      <span className="player-drag-handle">
        <GripVertical size={20} />
      </span>
      <span className={isCut ? "player-jersey continuation-jersey-cut" : "player-jersey"}>
        #{fav.jerseyNumber}
      </span>
      {fav.position !== "?" && (
        <span className="player-position">{fav.position}</span>
      )}
      <span className="player-name">
        {fav.playerName}
        {fav.originalName && (
          <span className="custom-name-indicator">{fav.originalName}</span>
        )}
      </span>
      {missingLevel && (
        <span className="my-favourites-missing-level">Not at {missingLevel}</span>
      )}
      <span className="continuation-row-right">
        <span
          className={fav.notes ? "note-btn note-btn-active" : "note-btn"}
          title={fav.notes || undefined}
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation()
            onEdit(fav)
          }}
        >
          <SquarePen size={14} />
        </span>
        <button
          className={isUnhearted ? "favorite-btn" : "favorite-btn favorite-btn-active"}
          onClick={(e) => {
            e.stopPropagation()
            onToggleHeart(fav.playerId)
          }}
        >
          <Heart size={14} fill={isUnhearted ? "none" : "currentColor"} />
        </button>
        {fav.previousTeam && (
          <span className="player-prev-team">{fav.previousTeam}</span>
        )}
      </span>
    </div>
  )
}

/* ── Main component ──────────────────────────────── */

export function MyFavouritesClient({ favourites }: MyFavouritesClientProps) {
  const [unhearted, setUnhearted] = useState<Set<string>>(new Set())
  const [selectedPlayer, setSelectedPlayer] = useState<FavouritePagePlayer | null>(null)
  const [localFavourites, setLocalFavourites] = useState(favourites)

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
                {getStatusLabel(group.statusType, group.players)} ({group.players.length})
              </div>
              {group.players.map((fav, rowIdx) => {
                const isUnhearted = unhearted.has(fav.playerId)
                const isCut = fav.statusType === "cut"
                const isMissing = fav.statusType === "missing"
                const missingLevel = isMissing ? getMissingLevel(fav.statusText) : ""

                return (
                  <FavRow
                    key={fav.playerId}
                    fav={fav}
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
  )
}
