import { requireAdmin } from "@/lib/auth"
import { getPendingCorrections } from "@/app/(app)/corrections/actions"
import { CorrectionsList } from "@/components/settings/corrections-list"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

export default async function CorrectionsPage() {
  const { associationId } = await requireAdmin()
  const corrections = await getPendingCorrections(associationId)

  return (
    <div className="corrections-page">
      <div className="corrections-page-header">
        <Link href="/settings" className="corrections-back">
          <ChevronLeft size={20} />
        </Link>
        <h1 className="corrections-page-title">Pending Corrections</h1>
      </div>
      <CorrectionsList initialCorrections={corrections} />
    </div>
  )
}
