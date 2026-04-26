import { requireAssociation } from "@/lib/auth"
import { SettingsPageClient } from "@/components/settings/settings-page-client"
import { getPendingCorrectionsCount, getMyCorrectionsCount } from "@/app/(app)/corrections/actions"

export default async function SettingsPage() {
  const { user, associationId, role, association } = await requireAssociation()

  const email = user.email ?? ""
  const initials = email.substring(0, 2).toUpperCase()

  const isAdmin = role === "group_admin" || role === "admin"
  const pendingCorrectionsCount = isAdmin
    ? await getPendingCorrectionsCount(associationId)
    : 0
  const myCorrectionsCount = !isAdmin
    ? await getMyCorrectionsCount(associationId)
    : 0

  return (
    <SettingsPageClient
      email={email}
      initials={initials}
      role={role}
      associationName={association.name}
      associationId={associationId}
      pendingCorrectionsCount={pendingCorrectionsCount}
      myCorrectionsCount={myCorrectionsCount}
    />
  )
}
