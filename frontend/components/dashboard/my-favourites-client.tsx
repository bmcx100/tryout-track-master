"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import { Heart, ChevronLeft } from "lucide-react"
import { LongPressMenu } from "@/components/teams/long-press-menu"
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
              {STATUS_LABELS[group.statusType]} {group.players.length}
            </div>
            {group.players.map((fav, rowIdx) => {
              const isUnhearted = unhearted.has(fav.playerId)
              const isCut = fav.statusType === "cut"
              const isMissing = fav.statusType === "missing"
              const missingLevel = isMissing ? getMissingLevel(fav.statusText) : ""

              const rowClasses = [
                "my-favourites-row",
                isCut ? "my-favourites-row-cut" : "",
                isMissing ? "my-favourites-row-missing" : "",
                isUnhearted ? "my-favourites-row-unhearted" : "",
                rowIdx % 2 === 0 ? "my-favourites-row-even" : "my-favourites-row-odd",
              ].filter(Boolean).join(" ")

              return (
                <div
                  key={fav.playerId}
                  className={rowClasses}
                  onClick={() => setSelectedPlayer(fav)}
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
                      handleToggleHeart(fav.playerId)
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
