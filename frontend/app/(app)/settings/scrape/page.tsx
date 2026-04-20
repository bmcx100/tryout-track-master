import { requireAdmin } from "@/lib/auth"
import { getActiveDivision, getDivisions } from "@/app/(app)/division/actions"
import { getDraftRounds, getContinuationsUrl } from "@/app/(app)/continuations/scraper-actions"
import { ScrapePageClient } from "@/components/settings/scrape-page-client"

export default async function ScrapePage() {
  const { associationId, association } = await requireAdmin()

  const divisions = await getDivisions(associationId)
  const savedDivision = await getActiveDivision(associationId)
  const defaultDivision = divisions.length > 0
    ? divisions.reduce((a, b) => a.playerCount > b.playerCount ? a : b).division
    : ""
  const activeDivision = savedDivision ?? defaultDivision

  const drafts = await getDraftRounds(associationId, activeDivision)
  const { url } = await getContinuationsUrl(associationId, activeDivision)

  return (
    <ScrapePageClient
      associationId={associationId}
      division={activeDivision}
      abbreviation={association.abbreviation}
      sourceUrl={url}
      existingDrafts={drafts}
    />
  )
}
