import { requireAssociation } from "@/lib/auth"
import { getDivisions, getActiveDivision } from "@/app/(app)/division/actions"
import { ContinuationsPageClient } from "@/components/continuations/continuations-page-client"
import { getAllPublishedRounds, getPlayerAnnotations, getContinuationOrders } from "./actions"
import type { TryoutPlayer } from "@/types"

export default async function ContinuationsPage() {
  const { supabase, associationId, role } = await requireAssociation()

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

  const players: TryoutPlayer[] = playersData ?? []

  // Fetch all published rounds for the active division (newest first)
  const rounds = await getAllPublishedRounds(associationId, activeDivision)

  // Fetch user's annotations
  const annotations = await getPlayerAnnotations(associationId)

  // Fetch user's saved continuation orders
  const roundIds = rounds.map((r) => r.id)
  const savedOrders = await getContinuationOrders(roundIds)

  return (
    <ContinuationsPageClient
      key={`${associationId}-${activeDivision}`}
      players={players}
      rounds={rounds}
      annotations={annotations}
      associationId={associationId}
      division={activeDivision}
      isAdmin={role === "group_admin" || role === "admin"}
      savedOrders={savedOrders}
    />
  )
}
