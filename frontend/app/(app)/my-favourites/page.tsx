import { requireAssociation } from "@/lib/auth"
import { getDivisions, getActiveDivision } from "@/app/(app)/division/actions"
import { getMyFavouritesPageData } from "@/app/(app)/dashboard/actions"
import { MyFavouritesClient } from "@/components/dashboard/my-favourites-client"

export default async function MyFavouritesPage() {
  const { associationId } = await requireAssociation()

  const divisions = await getDivisions(associationId)
  const savedDivision = await getActiveDivision(associationId)
  const defaultDivision = divisions.length > 0
    ? divisions.reduce((a, b) => a.playerCount > b.playerCount ? a : b).division
    : ""
  const activeDivision = savedDivision ?? defaultDivision

  const favourites = await getMyFavouritesPageData(associationId, activeDivision)

  return (
    <MyFavouritesClient
      key={`${associationId}-${activeDivision}`}
      favourites={favourites}
    />
  )
}
