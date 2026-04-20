import { requireAssociation } from "@/lib/auth"
import { DivisionSwitcher } from "@/components/layout/division-switcher"
import { getDivisions, getActiveDivision } from "@/app/(app)/division/actions"
import { getMyPlayersCount } from "@/app/(app)/annotations/actions"
import { MyPlayersCard } from "@/components/dashboard/my-players-card"
import Link from "next/link"
import { Home, Users, ListChecks } from "lucide-react"

export default async function DashboardPage() {
  const { user, associationId, association } = await requireAssociation()

  const email = user.email ?? ""
  const initials = email.substring(0, 2).toUpperCase()

  // Fetch divisions with player counts
  const divisions = await getDivisions(associationId)

  // Get user's active division preference, or default to division with most players
  const savedDivision = await getActiveDivision(associationId)
  const defaultDivision = divisions.length > 0
    ? divisions.reduce((a, b) => a.playerCount > b.playerCount ? a : b).division
    : ""
  const activeDivision = savedDivision ?? defaultDivision

  const myPlayersCount = await getMyPlayersCount(associationId)

  return (
    <>
      <DivisionSwitcher
        divisions={divisions}
        activeDivision={activeDivision}
        associationId={associationId}
        abbreviation={association.abbreviation}
        initials={initials}
        title="Home"
      />
      <div className="dashboard-page">
        <div className="dashboard-header">
          <h1 className="dashboard-title">Header Buttons</h1>
        </div>
        <div className="dashboard-link-card">
          <div className="dashboard-link-card-icon dashboard-link-card-icon-text">
            {association.abbreviation}
          </div>
          <p className="dashboard-link-card-title">Age Picker</p>
          <p className="dashboard-link-card-desc">
            Switch between age groups to view tryout data
            for&nbsp;different&nbsp;divisions
          </p>
        </div>
        <Link href="/settings" className="dashboard-link-card dashboard-link-card-second">
          <div className="dashboard-link-card-icon dashboard-link-card-icon-text">
            {initials}
          </div>
          <p className="dashboard-link-card-title">Profile</p>
          <p className="dashboard-link-card-desc">
            View your account information, preferences,
            and&nbsp;app&nbsp;settings
          </p>
        </Link>

        <div className="dashboard-header dashboard-header-second">
          <h1 className="dashboard-title">Menu Buttons</h1>
        </div>
        <Link href="/dashboard" className="dashboard-link-card">
          <div className="dashboard-link-card-icon">
            <Home size={20} />
          </div>
          <p className="dashboard-link-card-title">Home</p>
          <p className="dashboard-link-card-desc">
            Return to this page to access header
            and&nbsp;menu&nbsp;buttons
          </p>
        </Link>
        <Link href="/teams" className="dashboard-link-card dashboard-link-card-second">
          <div className="dashboard-link-card-icon">
            <Users size={20} />
          </div>
          <p className="dashboard-link-card-title">Teams</p>
          <p className="dashboard-link-card-desc">
            View projected rosters and drag players
            to&nbsp;reorder&nbsp;your&nbsp;predictions
          </p>
        </Link>
        <Link href="/continuations" className="dashboard-link-card dashboard-link-card-second">
          <div className="dashboard-link-card-icon">
            <ListChecks size={20} />
          </div>
          <p className="dashboard-link-card-title">Tryout Sessions</p>
          <p className="dashboard-link-card-desc">
            See who&rsquo;s continuing and who&rsquo;s been cut
            from each&nbsp;team&nbsp;level
          </p>
        </Link>
        <MyPlayersCard count={myPlayersCount} />
      </div>
    </>
  )
}
