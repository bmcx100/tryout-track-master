import { requireAssociation } from "@/lib/auth"
import { getDivisions, getActiveDivision } from "@/app/(app)/division/actions"
import { getDashboardData } from "@/app/(app)/dashboard/actions"
import { DashboardClient } from "@/components/dashboard/dashboard-client"

export default async function DashboardPage() {
  const { associationId } = await requireAssociation()

  // Fetch divisions with player counts
  const divisions = await getDivisions(associationId)

  // Get user's active division preference, or default to division with most players
  const savedDivision = await getActiveDivision(associationId)
  const defaultDivision = divisions.length > 0
    ? divisions.reduce((a, b) => a.playerCount > b.playerCount ? a : b).division
    : ""
  const activeDivision = savedDivision ?? defaultDivision

  const { heroCards, favoriteStatuses } = await getDashboardData(associationId, activeDivision)

  return (
    <DashboardClient
      key={`${associationId}-${activeDivision}`}
      heroCards={heroCards}
      favoriteStatuses={favoriteStatuses}
    />
  )
}
