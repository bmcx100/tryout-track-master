import { requireAssociation } from "@/lib/auth"
import { DivisionSwitcher } from "@/components/layout/division-switcher"
import { getDivisions, getActiveDivision } from "@/app/(app)/division/actions"
import { getAllAssociations } from "@/app/(app)/association/actions"
import { getPendingCorrectionsCount } from "@/app/(app)/corrections/actions"
import { getDashboardData } from "@/app/(app)/dashboard/actions"
import { DashboardClient } from "@/components/dashboard/dashboard-client"

export default async function DashboardPage() {
  const { user, associationId, association, role } = await requireAssociation()

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

  const [{ activityCards, favoriteStatuses }, associations] = await Promise.all([
    getDashboardData(associationId, activeDivision),
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
        title="Home"
        hasPendingCorrections={hasPendingCorrections}
        associations={associations}
      />
      <DashboardClient
        key={`${associationId}-${activeDivision}`}
        activityCards={activityCards}
        favoriteStatuses={favoriteStatuses}
      />
    </>
  )
}
