import { requireAdmin } from "@/lib/auth"
import { getActiveDivision, getDivisions } from "@/app/(app)/division/actions"
import { getDraftRounds, getContinuationsUrl } from "@/app/(app)/continuations/scraper-actions"
import { getAllRounds } from "./actions"
import { AdminContinuationsClient } from "@/components/admin/admin-continuations-client"

export default async function AdminContinuationsPage() {
  const { associationId } = await requireAdmin()

  const divisions = await getDivisions(associationId)
  const savedDivision = await getActiveDivision(associationId)
  const defaultDivision = divisions.length > 0
    ? divisions.reduce((a, b) => a.playerCount > b.playerCount ? a : b).division
    : ""
  const activeDivision = savedDivision ?? defaultDivision

  const [drafts, { url }, allRounds] = await Promise.all([
    getDraftRounds(associationId, activeDivision),
    getContinuationsUrl(associationId, activeDivision),
    getAllRounds(associationId, activeDivision),
  ])

  // Compute defaultTeamLevel from most recent published round
  const publishedRounds = allRounds.filter((r) => r.status === "published")
  const mostRecent = publishedRounds.length > 0
    ? publishedRounds.reduce((a, b) =>
        new Date(a.created_at) > new Date(b.created_at) ? a : b
      )
    : null
  const defaultTeamLevel = mostRecent?.team_level ?? "AA"

  return (
    <AdminContinuationsClient
      associationId={associationId}
      division={activeDivision}
      sourceUrl={url}
      existingDrafts={drafts}
      publishedRounds={publishedRounds}
      defaultTeamLevel={defaultTeamLevel}
    />
  )
}
