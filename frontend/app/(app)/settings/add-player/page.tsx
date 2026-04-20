import { requireAdmin } from "@/lib/auth"
import { getActiveDivision, getDivisions } from "@/app/(app)/division/actions"
import { AddPlayerForm } from "@/components/settings/add-player-form"

export default async function AddPlayerPage() {
  const { associationId } = await requireAdmin()

  const divisions = await getDivisions(associationId)
  const savedDivision = await getActiveDivision(associationId)
  const defaultDivision = divisions.length > 0
    ? divisions.reduce((a, b) => a.playerCount > b.playerCount ? a : b).division
    : ""
  const activeDivision = savedDivision ?? defaultDivision

  return (
    <AddPlayerForm
      associationId={associationId}
      divisions={divisions.map((d) => d.division)}
      activeDivision={activeDivision}
    />
  )
}
