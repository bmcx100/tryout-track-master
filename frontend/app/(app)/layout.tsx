import { requireAssociation } from "@/lib/auth"
import { getDivisions, getActiveDivision } from "@/app/(app)/division/actions"
import { getAllAssociations } from "@/app/(app)/association/actions"
import { getPendingCorrectionsCount } from "@/app/(app)/corrections/actions"
import { DivisionSwitcher } from "@/components/layout/division-switcher"
import { BottomNav } from "@/components/layout/bottom-nav"
import { OnboardingManager } from "@/components/shared/onboarding-manager"
import { NavLoadingProvider, NavLoadingContent } from "@/components/shared/nav-loading-provider"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, associationId, association, role } = await requireAssociation()

  const email = user.email ?? ""
  const initials = email.substring(0, 2).toUpperCase()

  const [divisions, savedDivision, associations] = await Promise.all([
    getDivisions(associationId),
    getActiveDivision(associationId),
    getAllAssociations(),
  ])

  const defaultDivision = divisions.length > 0
    ? divisions.reduce((a, b) => a.playerCount > b.playerCount ? a : b).division
    : ""
  const activeDivision = savedDivision ?? defaultDivision

  const isAdmin = role === "group_admin" || role === "admin"
  const hasPendingCorrections = isAdmin
    ? (await getPendingCorrectionsCount(associationId)) > 0
    : false

  return (
    <NavLoadingProvider>
      <div className="app-shell">
        <div className="app-shell-content">
          <DivisionSwitcher
            divisions={divisions}
            activeDivision={activeDivision}
            associationId={associationId}
            abbreviation={association.abbreviation}
            initials={initials}
            hasPendingCorrections={hasPendingCorrections}
            associations={associations}
          />
          <NavLoadingContent>
            {children}
          </NavLoadingContent>
        </div>
        <BottomNav />
        <OnboardingManager />
      </div>
    </NavLoadingProvider>
  )
}
