import { requireAssociation } from "@/lib/auth"
import { HelpPageClient } from "@/components/help/help-page-client"

export default async function HelpPage() {
  const { association } = await requireAssociation()

  return <HelpPageClient abbreviation={association.abbreviation} />
}
