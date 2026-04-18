export type PlayerPosition = "F" | "D" | "G"

export type PlayerStatus =
  | "registered"
  | "trying_out"
  | "cut"
  | "made_team"
  | "moved_up"
  | "moved_down"
  | "withdrew"

export type Player = {
  id: string
  name: string
  jersey_number: string
  division: string
  status: PlayerStatus
  position: PlayerPosition | null
  previous_team: string | null
  team_id: string | null
  association_id: string
}

export type Team = {
  id: string
  name: string
  division: string
  display_order: number
  max_roster_size: number
  association_id: string
  is_official: boolean
}

export type TrackedGroup = {
  label: string
  association_id: string
  division: string
}
