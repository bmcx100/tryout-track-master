"use client"

import { useState, useMemo } from "react"
import type { TryoutPlayer } from "@/types"
import { StatusBadge } from "./status-badge"

type PlayerListProps = {
  players: TryoutPlayer[]
  divisions: string[]
}

export function PlayerList({ players, divisions }: PlayerListProps) {
  const [search, setSearch] = useState("")
  const [activeDivision, setActiveDivision] = useState<string>(divisions[0] ?? "")

  const filtered = useMemo(() => {
    let result = players.filter((p) => p.division === activeDivision)
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.jersey_number.includes(q)
      )
    }
    return result.sort((a, b) => a.name.localeCompare(b.name))
  }, [players, activeDivision, search])

  return (
    <>
      <div className="division-tabs">
        {divisions.map((div) => (
          <button
            key={div}
            className={div === activeDivision ? "division-tab-active" : "division-tab"}
            onClick={() => setActiveDivision(div)}
          >
            {div}
          </button>
        ))}
      </div>

      <div className="player-search-wrapper">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or jersey&hellip;"
          className="player-search"
        />
      </div>

      <div className="player-list-section">
        {filtered.length === 0 ? (
          <div className="player-list-empty">
            <p className="player-list-empty-text">
              {search ? "No players match your\u00a0search" : "No players in this\u00a0division"}
            </p>
          </div>
        ) : (
          filtered.map((player) => (
            <div key={player.id} className="player-list-card">
              <span className="player-list-jersey">#{player.jersey_number}</span>
              <span className="player-list-name">{player.name}</span>
              <StatusBadge status={player.status} />
            </div>
          ))
        )}
      </div>
    </>
  )
}
