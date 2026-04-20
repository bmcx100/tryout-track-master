import { requireAssociation } from "@/lib/auth"
import { DivisionSwitcher } from "@/components/layout/division-switcher"
import { getDivisions, getActiveDivision } from "@/app/(app)/division/actions"
import { getMyPlayers } from "@/app/(app)/annotations/actions"
import { getPendingCorrectionsCount } from "@/app/(app)/corrections/actions"
import { Heart } from "lucide-react"

export default async function MyPlayersPage() {
  const { user, associationId, association, role } = await requireAssociation()

  const email = user.email ?? ""
  const initials = email.substring(0, 2).toUpperCase()

  const divisions = await getDivisions(associationId)
  const savedDivision = await getActiveDivision(associationId)
  const defaultDivision = divisions.length > 0
    ? divisions.reduce((a, b) => a.playerCount > b.playerCount ? a : b).division
    : ""
  const activeDivision = savedDivision ?? defaultDivision

  const myPlayers = await getMyPlayers(associationId)
  const hasPendingCorrections = (role === "group_admin" || role === "admin")
    ? (await getPendingCorrectionsCount(associationId)) > 0
    : false

  // Group by division, then by previous_team within each division
  const grouped = new Map<string, Map<string, typeof myPlayers>>()
  for (const entry of myPlayers) {
    const div = entry.player.division ?? "Unknown"
    const prevTeam = entry.player.previous_team ?? "Unknown"
    if (!grouped.has(div)) grouped.set(div, new Map())
    const divMap = grouped.get(div)!
    if (!divMap.has(prevTeam)) divMap.set(prevTeam, [])
    divMap.get(prevTeam)!.push(entry)
  }

  const divisionKeys = Array.from(grouped.keys()).sort()

  return (
    <>
      <DivisionSwitcher
        divisions={divisions}
        activeDivision={activeDivision}
        associationId={associationId}
        abbreviation={association.abbreviation}
        initials={initials}
        title="My Players"
        hasPendingCorrections={hasPendingCorrections}
      />
      <div className="my-players-page">
        {myPlayers.length === 0 ? (
          <div className="my-players-empty">
            <Heart size={32} />
            <p>No tracked players yet</p>
            <p className="my-players-empty-hint">
              Heart players or set custom names on the Teams page
              to&nbsp;track&nbsp;them&nbsp;here
            </p>
          </div>
        ) : (
          divisionKeys.map((div) => {
            const teamGroups = grouped.get(div)!
            const sortedTeams = Array.from(teamGroups.keys()).sort()
            return (
              <div key={div} className="my-players-division">
                <h2 className="my-players-division-title">{div}</h2>
                {sortedTeams.map((team, teamIdx) => {
                  const players = teamGroups.get(team)!
                  return (
                    <div key={team} className={teamIdx > 0 ? "my-players-team-gap" : undefined}>
                      {players.map(({ player, annotation }) => (
                        <div key={player.id} className="my-players-row">
                          <span className="player-jersey">#{player.jersey_number}</span>
                          {player.position && player.position !== "?" && (
                            <span className="player-position">{player.position}</span>
                          )}
                          {annotation.isFavorite && (
                            <span className="my-players-heart">
                              <Heart size={14} fill="currentColor" />
                            </span>
                          )}
                          <span className="player-name">
                            {annotation.customName || player.name}
                            {annotation.customName && player.name && annotation.customName !== player.name && (
                              <span className="custom-name-indicator">{player.name}</span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            )
          })
        )}
      </div>
    </>
  )
}
