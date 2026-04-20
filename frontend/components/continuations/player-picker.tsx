"use client"

import { useState, useMemo } from "react"
import { X, UserPlus, Search } from "lucide-react"
import type { TryoutPlayer } from "@/types"

type PlayerPickerProps = {
  jerseyNumber: string
  players: TryoutPlayer[]
  onLinkPlayer: (playerId: string) => void
  onAddPlayer: () => void
  onClose: () => void
}

const POSITION_ORDER: Record<string, number> = { F: 0, D: 1, G: 2 }

export function PlayerPicker({
  jerseyNumber,
  players,
  onLinkPlayer,
  onAddPlayer,
  onClose,
}: PlayerPickerProps) {
  const [search, setSearch] = useState("")
  const [confirmPlayer, setConfirmPlayer] = useState<TryoutPlayer | null>(null)

  // Filter and group players by previous team
  const grouped = useMemo(() => {
    const query = search.toLowerCase().trim()
    const filtered = players.filter((p) => {
      if (!query) return true
      return (
        p.name.toLowerCase().includes(query) ||
        p.jersey_number.includes(query)
      )
    })

    // Sort by previous team (alpha), then position, then jersey number
    filtered.sort((a, b) => {
      const teamA = a.previous_team ?? "zzz"
      const teamB = b.previous_team ?? "zzz"
      if (teamA !== teamB) return teamA.localeCompare(teamB)
      const posA = POSITION_ORDER[a.position] ?? 99
      const posB = POSITION_ORDER[b.position] ?? 99
      if (posA !== posB) return posA - posB
      return Number(a.jersey_number) - Number(b.jersey_number)
    })

    // Group by previous_team
    const groups: { team: string, players: TryoutPlayer[] }[] = []
    let currentTeam = ""
    for (const p of filtered) {
      const team = p.previous_team ?? "Unknown"
      if (team !== currentTeam) {
        groups.push({ team, players: [] })
        currentTeam = team
      }
      groups[groups.length - 1].players.push(p)
    }
    return groups
  }, [players, search])

  const handleConfirm = () => {
    if (confirmPlayer) {
      onLinkPlayer(confirmPlayer.id)
    }
  }

  return (
    <>
      <div className="player-picker-overlay" onClick={onClose} />
      <div className="player-picker">
        <div className="detail-sheet-handle" />
        <div className="player-picker-header">
          <span className="player-picker-title">Link #{jerseyNumber}</span>
          <div className="player-picker-header-actions">
            <button className="player-picker-add-btn" onClick={onAddPlayer}>
              <UserPlus size={14} />
              <span>Add Player</span>
            </button>
            <button className="detail-sheet-close" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="player-picker-search-wrap">
          <Search size={14} className="player-picker-search-icon" />
          <input
            className="player-picker-search"
            type="text"
            placeholder="Search by name or jersey #"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        <div className="player-picker-list">
          {grouped.length === 0 ? (
            <p className="player-picker-empty">No players found</p>
          ) : (
            grouped.map((group) => (
              <div key={group.team} className="player-picker-group">
                {group.players.map((p) => (
                  <button
                    key={p.id}
                    className="player-picker-row"
                    onClick={() => setConfirmPlayer(p)}
                  >
                    {p.position && p.position !== "?" && (
                      <span className="player-position">{p.position}</span>
                    )}
                    <span className="player-jersey">#{p.jersey_number}</span>
                    <span className="player-picker-row-name">{p.name}</span>
                    {p.previous_team && (
                      <span className="player-prev-team">{p.previous_team}</span>
                    )}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>

        {/* Confirmation overlay */}
        {confirmPlayer && (
          <div className="player-picker-confirm">
            <p className="player-picker-confirm-text">
              Change {confirmPlayer.name}&apos;s number
              from&nbsp;#{confirmPlayer.jersey_number}
              to&nbsp;#{jerseyNumber}?
            </p>
            <div className="player-picker-confirm-actions">
              <button
                className="player-picker-confirm-yes"
                onClick={handleConfirm}
              >
                Confirm
              </button>
              <button
                className="player-picker-confirm-no"
                onClick={() => setConfirmPlayer(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
