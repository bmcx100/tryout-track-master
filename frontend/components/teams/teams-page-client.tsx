"use client"

import { useState } from "react"
import type { Player, Team } from "@/types"
import { ViewToggle } from "./view-toggle"
import { PredictionBoard } from "./prediction-board"
import { PreviousTeamsView } from "./previous-teams-view"
import { LongPressMenu } from "./long-press-menu"

type TeamsPageClientProps = {
  players: Player[]
  teams: Team[]
}

export function TeamsPageClient({ players, teams }: TeamsPageClientProps) {
  const [activeView, setActiveView] = useState<"predictions" | "previous">("predictions")
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)

  return (
    <>
      <ViewToggle activeView={activeView} onViewChange={setActiveView} />
      <p className="instruction-line">
        Drag players up and down between&nbsp;teams
      </p>
      {activeView === "predictions" ? (
        <PredictionBoard
          players={players}
          teams={teams}
          onPlayerLongPress={setSelectedPlayer}
        />
      ) : (
        <PreviousTeamsView players={players} />
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
