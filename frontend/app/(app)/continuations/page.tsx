import { requireAssociation } from "@/lib/auth"
import { TeamsHeader } from "@/components/layout/teams-header"
import { ContinuationsPageClient } from "@/components/continuations/continuations-page-client"
import { getLatestRounds, getPlayerAnnotations } from "./actions"
import type { TryoutPlayer } from "@/types"

export default async function ContinuationsPage() {
  const { supabase, user, associationId, association } = await requireAssociation()

  const email = user.email ?? ""
  const initials = email.substring(0, 2).toUpperCase()

  // Fetch all players for the association (for jersey number lookup)
  const { data: playersData } = await supabase
    .from("tryout_players")
    .select("*")
    .eq("association_id", associationId)
    .is("deleted_at", null)

  const players: TryoutPlayer[] = playersData ?? []

  // Determine active division(s)
  const divisions = [...new Set(players.map((p) => p.division))].sort()
  const activeDivision = divisions[0] ?? ""

  // Fetch latest rounds for the active division
  const rounds = await getLatestRounds(associationId, activeDivision)

  // Fetch user's annotations
  const annotations = await getPlayerAnnotations(associationId)

  return (
    <>
      <TeamsHeader
        groupLabel={association.abbreviation}
        division={activeDivision}
        initials={initials}
        title="Sessions"
      />
      <ContinuationsPageClient
        players={players}
        rounds={rounds}
        annotations={annotations}
        associationId={associationId}
        division={activeDivision}
      />
    </>
  )
}
