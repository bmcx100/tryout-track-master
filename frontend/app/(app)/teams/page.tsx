import { requireAssociation } from "@/lib/auth"
import { TeamsHeader } from "@/components/layout/teams-header"
import { TeamsPageClient } from "@/components/teams/teams-page-client"
import type { TryoutPlayer, Team } from "@/types"

export default async function TeamsPage() {
  const { supabase, user, associationId, association } = await requireAssociation()

  // Fetch players for this association (active only)
  const { data: playersData } = await supabase
    .from("tryout_players")
    .select("*")
    .eq("association_id", associationId)
    .is("deleted_at", null)
    .order("name")

  // Fetch teams for this association
  const { data: teamsData } = await supabase
    .from("teams")
    .select("*")
    .eq("association_id", associationId)
    .eq("is_archived", false)
    .order("display_order")

  // Get unique divisions
  const allPlayers: TryoutPlayer[] = playersData ?? []
  const allTeams: Team[] = teamsData ?? []
  const divisions = [...new Set(allPlayers.map((p) => p.division))].sort()
  const activeDivision = divisions[0] ?? ""

  // Fetch user's saved prediction for the active division
  const { data: prediction } = await supabase
    .from("player_predictions")
    .select("player_order")
    .eq("user_id", user.id)
    .eq("association_id", associationId)
    .eq("division", activeDivision)
    .single()

  const email = user.email ?? ""
  const initials = email.substring(0, 2).toUpperCase()

  return (
    <>
      <TeamsHeader groupLabel={`${association.abbreviation} ${activeDivision}`} initials={initials} />
      <TeamsPageClient
        players={allPlayers}
        teams={allTeams}
        divisions={divisions}
        initialDivision={activeDivision}
        savedOrder={prediction?.player_order ?? null}
        associationId={associationId}
      />
    </>
  )
}
