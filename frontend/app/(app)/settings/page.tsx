import { requireAssociation } from "@/lib/auth"
import { SettingsPageClient } from "@/components/settings/settings-page-client"

export default async function SettingsPage() {
  const { user, associationId, role, association } = await requireAssociation()

  const email = user.email ?? ""
  const initials = email.substring(0, 2).toUpperCase()

  return (
    <SettingsPageClient
      email={email}
      initials={initials}
      role={role}
      associationName={association.name}
      associationId={associationId}
    />
  )
}
