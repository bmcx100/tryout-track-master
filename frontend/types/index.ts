import type { Tables } from "./database"

// Database row types aliased for convenience
export type TryoutPlayer = Tables<"tryout_players">
export type Team = Tables<"teams">
export type Association = Tables<"associations">
export type UserAssociation = Tables<"user_associations">
export type PlayerPrediction = Tables<"player_predictions">
export type PlayerHeart = Tables<"player_hearts">
export type ContinuationRound = Tables<"continuation_rounds">
export type PlayerAnnotation = Tables<"player_annotations">
export type ContinuationsUrl = Tables<"continuations_urls">

// UI-specific display types (extend DB types with computed fields)
export type PlayerWithTeam = TryoutPlayer & {
  teams: { name: string } | null
}

// Status display labels
export const STATUS_LABELS: Record<string, string> = {
  registered: "Registered",
  trying_out: "Trying Out",
  cut: "Cut",
  made_team: "Made Team",
  moved_up: "Moved Up",
  moved_down: "Moved Down",
  withdrew: "Withdrew",
}
