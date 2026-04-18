import type { Player, PlayerPosition, Team, TrackedGroup } from "@/types"

export const mockTrackedGroup: TrackedGroup = {
  label: "Rangers U13",
  association_id: "a1000000-0000-0000-0000-000000000001",
  division: "U13",
}

export const mockTeams: Team[] = [
  {
    id: "t1000000-0000-0000-0000-000000000003",
    name: "AA",
    division: "U13",
    display_order: 1,
    max_roster_size: 17,
    association_id: "a1000000-0000-0000-0000-000000000001",
    is_official: true,
  },
  {
    id: "t1000000-0000-0000-0000-000000000004",
    name: "A",
    division: "U13",
    display_order: 2,
    max_roster_size: 17,
    association_id: "a1000000-0000-0000-0000-000000000001",
    is_official: false,
  },
]

function p(
  id: string,
  name: string,
  jersey: string,
  pos: PlayerPosition,
  prev: string | null,
  status: Player["status"] = "trying_out",
  teamId: string | null = null,
): Player {
  return {
    id: `p100-${id}`,
    name,
    jersey_number: jersey,
    division: "U13",
    status,
    position: pos,
    previous_team: prev,
    team_id: teamId,
    association_id: "a1000000-0000-0000-0000-000000000001",
  }
}

export const mockPlayers: Player[] = [
  // AA official (17 players assigned to AA team)
  p("01", "Noah Williams", "7", "F", "U13AA", "made_team", "t1000000-0000-0000-0000-000000000003"),
  p("02", "Liam Johnson", "14", "F", "U13AA", "made_team", "t1000000-0000-0000-0000-000000000003"),
  p("03", "Ethan Brown", "19", "D", "U13AA", "made_team", "t1000000-0000-0000-0000-000000000003"),
  p("04", "Mason Davis", "4", "D", "U13AA", "made_team", "t1000000-0000-0000-0000-000000000003"),
  p("05", "Lucas Wilson", "22", "F", "U13AA", "made_team", "t1000000-0000-0000-0000-000000000003"),
  p("06", "Oliver Taylor", "9", "G", "U13AA", "made_team", "t1000000-0000-0000-0000-000000000003"),
  p("07", "James Anderson", "15", "F", "U13AA", "made_team", "t1000000-0000-0000-0000-000000000003"),
  p("08", "Benjamin Thomas", "33", "D", "U13AA", "made_team", "t1000000-0000-0000-0000-000000000003"),
  p("09", "Alexander Jackson", "11", "F", "U13AA", "made_team", "t1000000-0000-0000-0000-000000000003"),
  p("10", "William White", "8", "D", "U13AA", "made_team", "t1000000-0000-0000-0000-000000000003"),
  p("11", "Henry Harris", "27", "F", "U13AA", "made_team", "t1000000-0000-0000-0000-000000000003"),
  p("12", "Sebastian Martin", "3", "D", "U13AA", "made_team", "t1000000-0000-0000-0000-000000000003"),
  p("13", "Jack Garcia", "21", "F", "U13AA", "made_team", "t1000000-0000-0000-0000-000000000003"),
  p("14", "Daniel Martinez", "16", "F", "U11AA", "made_team", "t1000000-0000-0000-0000-000000000003"),
  p("15", "Matthew Robinson", "25", "D", "U11AA", "made_team", "t1000000-0000-0000-0000-000000000003"),
  p("16", "Owen Clark", "31", "G", "U11AA", "made_team", "t1000000-0000-0000-0000-000000000003"),
  p("17", "Samuel Rodriguez", "10", "F", "U11AA", "made_team", "t1000000-0000-0000-0000-000000000003"),
  // A-level predictions (17 players, not assigned to any team)
  p("18", "Aiden Lewis", "6", "F", "U13A"),
  p("19", "Jackson Lee", "17", "D", "U13A"),
  p("20", "Logan Walker", "23", "F", "U13A"),
  p("21", "Carter Hall", "2", "D", "U13A"),
  p("22", "Jayden Allen", "29", "G", "U13A"),
  p("23", "Dylan Young", "13", "F", "U13A"),
  p("24", "Luke King", "30", "F", "U11A"),
  p("25", "Ryan Wright", "5", "D", "U11A"),
  p("26", "Nathan Scott", "18", "F", "U11A"),
  p("27", "Caleb Adams", "24", "D", "U11A"),
  p("28", "Christian Baker", "26", "F", "U13A"),
  p("29", "Isaac Gonzalez", "20", "F", "U11A"),
  p("30", "Joshua Nelson", "28", "D", "U13A"),
  p("31", "Andrew Hill", "32", "G", "U11A"),
  p("32", "Christopher Moore", "34", "F", "U11BB"),
  p("33", "David Campbell", "35", "D", "U11BB"),
  p("34", "Joseph Mitchell", "36", "F", null),
]
