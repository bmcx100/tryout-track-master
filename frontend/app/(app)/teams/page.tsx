import { requireAssociation } from "@/lib/auth"
import { DivisionSwitcher } from "@/components/layout/division-switcher"
import { getDivisions, getActiveDivision } from "@/app/(app)/division/actions"
import { getPlayerAnnotations } from "@/app/(app)/annotations/actions"
import { getPendingCorrectionsCount } from "@/app/(app)/corrections/actions"
import { TeamsPageClient } from "@/components/teams/teams-page-client"
import type { TryoutPlayer, Team } from "@/types"

export default async function TeamsPage() {
  const { supabase, user, associationId, association, role } = await requireAssociation()

  const email = user.email ?? ""
  const initials = email.substring(0, 2).toUpperCase()

  // Fetch divisions with player counts
  const divisions = await getDivisions(associationId)

  // Get user's active division preference, or default to division with most players
  const savedDivision = await getActiveDivision(associationId)
  const defaultDivision = divisions.length > 0
    ? divisions.reduce((a, b) => a.playerCount > b.playerCount ? a : b).division
    : ""
  const activeDivision = savedDivision ?? defaultDivision

  // Fetch players filtered by active division
  const { data: playersData } = await supabase
    .from("tryout_players")
    .select("*")
    .eq("association_id", associationId)
    .eq("division", activeDivision)
    .is("deleted_at", null)
    .order("name")

  // Fetch teams filtered by active division
  const { data: teamsData } = await supabase
    .from("teams")
    .select("*")
    .eq("association_id", associationId)
    .eq("division", activeDivision)
    .eq("is_archived", false)
    .order("display_order")

  const allPlayers: TryoutPlayer[] = playersData ?? []
  const allTeams: Team[] = teamsData ?? []

  // Fetch user's saved predictions for active division
  const { data: predictions } = await supabase
    .from("player_predictions")
    .select("division, player_order")
    .eq("user_id", user.id)
    .eq("association_id", associationId)
    .eq("division", activeDivision)

  const savedOrders: Record<string, string[]> = {}
  for (const pred of predictions ?? []) {
    savedOrders[pred.division] = pred.player_order
  }

  // Fetch user's saved previous-team sort orders
  const { data: previousOrders } = await supabase
    .from("previous_team_orders")
    .select("previous_team, player_order")
    .eq("user_id", user.id)
    .eq("association_id", associationId)

  const savedPreviousOrders: Record<string, string[]> = {}
  for (const order of previousOrders ?? []) {
    savedPreviousOrders[order.previous_team] = order.player_order
  }

  // Fetch user's player annotations (hearts, names)
  const annotations = await getPlayerAnnotations(associationId)

  const hasPendingCorrections = (role === "group_admin" || role === "admin")
    ? (await getPendingCorrectionsCount(associationId)) > 0
    : false

  return (
    <>
      <DivisionSwitcher
        divisions={divisions}
        activeDivision={activeDivision}
        associationId={associationId}
        abbreviation={association.abbreviation}
        initials={initials}
        hasPendingCorrections={hasPendingCorrections}
      />
      <TeamsPageClient
        key={activeDivision}
        players={allPlayers}
        teams={allTeams}
        savedOrders={savedOrders}
        savedPreviousOrders={savedPreviousOrders}
        associationId={associationId}
        annotations={annotations}
      />
    </>
  )
}
