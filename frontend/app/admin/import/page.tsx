import { requireAdmin } from "@/lib/auth"
import { ImportPageClient } from "./import-page-client"

export default async function ImportPage() {
  const { associationId, association } = await requireAdmin()

  return (
    <div className="import-page">
      <h1 className="import-page-title">Import Players</h1>
      <p className="import-page-desc">
        Upload a CSV file to add players to {association.name}
      </p>
      <ImportPageClient associationId={associationId} />
    </div>
  )
}
