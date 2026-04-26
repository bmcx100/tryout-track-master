import { requireAssociation } from "@/lib/auth"
import { getMyCorrections } from "@/app/(app)/corrections/actions"
import { MyCorrectionsList } from "@/components/settings/my-corrections-list"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

export default async function MyCorrectionsPage() {
  const { associationId } = await requireAssociation()
  const corrections = await getMyCorrections(associationId)

  return (
    <div className="corrections-page">
      <div className="corrections-page-header">
        <Link href="/settings" className="corrections-back">
          <ChevronLeft size={20} />
        </Link>
        <h1 className="corrections-page-title">My Corrections</h1>
      </div>
      <MyCorrectionsList corrections={corrections} />
    </div>
  )
}
