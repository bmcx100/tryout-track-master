"use client"

import { useState, useCallback, useRef } from "react"
import type { TryoutPlayer, Team } from "@/types"
import { ViewToggle } from "./view-toggle"
import { PredictionBoard } from "./prediction-board"
import { PreviousTeamsView } from "./previous-teams-view"
import { LongPressMenu } from "./long-press-menu"
import { savePredictionOrder } from "@/app/(app)/teams/actions"

type TeamsPageClientProps = {
  players: TryoutPlayer[]
  teams: Team[]
  divisions: string[]
  initialDivision: string
  savedOrder: string[] | null
  associationId: string
}

export function TeamsPageClient({
  players,
  teams,
  divisions,
  initialDivision,
  savedOrder,
  associationId,
}: TeamsPageClientProps) {
  const [activeView, setActiveView] = useState<"predictions" | "previous">("predictions")
  const [activeDivision, setActiveDivision] = useState(initialDivision)
  const [selectedPlayer, setSelectedPlayer] = useState<TryoutPlayer | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const divisionPlayers = players.filter((p) => p.division === activeDivision)
  const divisionTeams = teams.filter((t) => t.division === activeDivision)

  const handleOrderChange = useCallback((playerIds: string[]) => {
    // Debounced save — 1 second after last drag
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      savePredictionOrder(associationId, activeDivision, playerIds)
    }, 1000)
  }, [associationId, activeDivision])

  return (
    <>
      {divisions.length > 1 && (
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
      )}

      <ViewToggle activeView={activeView} onViewChange={setActiveView} />
      <p className="instruction-line">
        Drag players up and down between&nbsp;teams
      </p>

      {activeView === "predictions" ? (
        <PredictionBoard
          key={activeDivision}
          players={divisionPlayers}
          teams={divisionTeams}
          savedOrder={savedOrder}
          onOrderChange={handleOrderChange}
          onPlayerLongPress={setSelectedPlayer}
        />
      ) : (
        <PreviousTeamsView players={divisionPlayers} />
      )}

      {selectedPlayer && (
        <LongPressMenu
          player={selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </>
  )
}
