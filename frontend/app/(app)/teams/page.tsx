import { TeamsHeader } from "@/components/layout/teams-header"
import { TeamsPageClient } from "@/components/teams/teams-page-client"
import { mockPlayers, mockTeams, mockTrackedGroup } from "@/lib/mock-data"

export default function TeamsPage() {
  // TODO: Replace with Supabase query when backend is connected
  const players = mockPlayers
  const teams = mockTeams
  const group = mockTrackedGroup

  return (
    <>
      <TeamsHeader groupLabel={group.label} initials="JD" />
      <TeamsPageClient players={players} teams={teams} />
    </>
  )
}
