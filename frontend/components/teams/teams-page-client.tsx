"use client"

import { useState } from "react"
import type { Player, Team } from "@/types"
import { ViewToggle } from "./view-toggle"
import { PredictionBoard } from "./prediction-board"
import { PreviousTeamsView } from "./previous-teams-view"

type TeamsPageClientProps = {
  players: Player[]
  teams: Team[]
}

export function TeamsPageClient({ players, teams }: TeamsPageClientProps) {
  const [activeView, setActiveView] = useState<"predictions" | "previous">("predictions")

  return (
    <>
      <ViewToggle activeView={activeView} onViewChange={setActiveView} />
      <p className="instruction-line">
        Drag players up and down between&nbsp;teams
      </p>
      {activeView === "predictions" ? (
        <PredictionBoard players={players} teams={teams} />
      ) : (
        <PreviousTeamsView players={players} />
      )}
    </>
  )
}
