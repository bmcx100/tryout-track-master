import { requireAssociation } from "@/lib/auth"
import { getDivisions, getActiveDivision } from "@/app/(app)/division/actions"
import { getPlayerAnnotations } from "@/app/(app)/annotations/actions"
import { normalizePreviousTeam } from "@/lib/normalize-previous-team"
import { TeamsPageClient } from "@/components/teams/teams-page-client"
import type { TryoutPlayer, Team, SplitStatus } from "@/types"

export default async function TeamsPage() {
  const { supabase, user, associationId, role } = await requireAssociation()

  // Fetch divisions with player counts
  const divisions = await getDivisions(associationId)

  // Get user's active division preference, or default to division with most players
  const savedDivision = await getActiveDivision(associationId)
  const defaultDivision = divisions.length > 0
    ? divisions.reduce((a, b) => a.playerCount > b.playerCount ? a : b).division
    : ""
  const activeDivision = savedDivision ?? defaultDivision

  // Fetch approved players
  const { data: playersData } = await supabase
    .from("tryout_players")
    .select("*")
    .eq("association_id", associationId)
    .eq("division", activeDivision)
    .is("deleted_at", null)
    .is("suggested_by", null)
    .order("name")

  // Fetch the current user's suggested (pending) players
  const { data: suggestedData } = await supabase
    .from("tryout_players")
    .select("*")
    .eq("association_id", associationId)
    .eq("division", activeDivision)
    .is("deleted_at", null)
    .eq("suggested_by", user.id)
    .order("name")

  // Fetch teams filtered by active division
  const { data: teamsData } = await supabase
    .from("teams")
    .select("*")
    .eq("association_id", associationId)
    .eq("division", activeDivision)
    .eq("is_archived", false)
    .order("display_order")

  const allPlayers: TryoutPlayer[] = [...(playersData ?? []), ...(suggestedData ?? [])]
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
    savedPreviousOrders[normalizePreviousTeam(order.previous_team)] = order.player_order
  }

  // Fetch user's saved team group order for active division
  const { data: teamGroupOrderData } = await supabase
    .from("team_group_orders")
    .select("team_order")
    .eq("user_id", user.id)
    .eq("association_id", associationId)
    .eq("division", activeDivision)
    .maybeSingle()

  const savedTeamGroupOrder: string[] = (teamGroupOrderData?.team_order ?? []).map(normalizePreviousTeam)

  // Fetch split statuses for this division
  const { data: splitData } = await supabase
    .from("continuation_level_status")
    .select("team_level, is_completed, is_split, sub_team_1_name, sub_team_2_name")
    .eq("association_id", associationId)
    .eq("division", activeDivision)
    .eq("is_split", true)

  const splitStatuses: SplitStatus[] = (splitData ?? []).map((s) => ({
    team_level: s.team_level,
    is_completed: s.is_completed,
    is_split: s.is_split,
    sub_team_1_name: s.sub_team_1_name ?? "Team 1",
    sub_team_2_name: s.sub_team_2_name ?? "Team 2",
  }))

  // Fetch user's player annotations (hearts, names)
  const annotations = await getPlayerAnnotations(associationId)

  return (
    <>
      <TeamsPageClient
        key={`${associationId}-${activeDivision}`}
        players={allPlayers}
        teams={allTeams}
        savedOrders={savedOrders}
        savedPreviousOrders={savedPreviousOrders}
        savedTeamGroupOrder={savedTeamGroupOrder}
        splitStatuses={splitStatuses}
        associationId={associationId}
        division={activeDivision}
        annotations={annotations}
        role={role}
      />
    </>
  )
}
