import { requireAssociation } from "@/lib/auth"
import { DivisionSwitcher } from "@/components/layout/division-switcher"
import { getDivisions, getActiveDivision } from "@/app/(app)/division/actions"
import { getAllAssociations } from "@/app/(app)/association/actions"
import { getPendingCorrectionsCount } from "@/app/(app)/corrections/actions"
import { ContinuationsPageClient } from "@/components/continuations/continuations-page-client"
import { getAllPublishedRounds, getPlayerAnnotations } from "./actions"
import type { TryoutPlayer } from "@/types"

export default async function ContinuationsPage() {
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

  const players: TryoutPlayer[] = playersData ?? []

  // Fetch all published rounds for the active division (newest first)
  const rounds = await getAllPublishedRounds(associationId, activeDivision)

  // Fetch user's annotations
  const [annotations, associations] = await Promise.all([
    getPlayerAnnotations(associationId),
    getAllAssociations(),
  ])
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
        title="Sessions"
        hasPendingCorrections={hasPendingCorrections}
        associations={associations}
      />
      <ContinuationsPageClient
        key={`${associationId}-${activeDivision}`}
        players={players}
        rounds={rounds}
        annotations={annotations}
        associationId={associationId}
        division={activeDivision}
        isAdmin={role === "group_admin" || role === "admin"}
      />
    </>
  )
}
