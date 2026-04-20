"use server"

import { createClient } from "@/lib/supabase/server"
import type { ContinuationRound } from "@/types"

const TEAM_TIER_ORDER = ["AA", "A", "BB", "B", "C"]

export async function getLatestRounds(
  associationId: string,
  division: string
): Promise<{ teamLevel: string, allRounds: ContinuationRound[] }[]> {
  const supabase = await createClient()

  const { data: rounds } = await supabase
    .from("continuation_rounds")
    .select("*")
    .eq("association_id", associationId)
    .eq("division", division)
    .eq("status", "published")
    .order("round_number", { ascending: false })

  if (!rounds || rounds.length === 0) return []

  // Group by team_level (already sorted by round_number DESC)
  const byTeam: Record<string, ContinuationRound[]> = {}
  for (const round of rounds) {
    if (!byTeam[round.team_level]) byTeam[round.team_level] = []
    byTeam[round.team_level].push(round)
  }

  const result: { teamLevel: string, allRounds: ContinuationRound[] }[] = []
  for (const [teamLevel, teamRounds] of Object.entries(byTeam)) {
    result.push({ teamLevel, allRounds: teamRounds })
  }

  // Sort by tier order
  result.sort((a, b) => {
    const aIdx = TEAM_TIER_ORDER.indexOf(a.teamLevel)
    const bIdx = TEAM_TIER_ORDER.indexOf(b.teamLevel)
    return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx)
  })

  return result
}

export async function getAllRoundsForTeam(
  associationId: string,
  division: string,
  teamLevel: string
): Promise<ContinuationRound[]> {
  const supabase = await createClient()

  const { data: rounds } = await supabase
    .from("continuation_rounds")
    .select("*")
    .eq("association_id", associationId)
    .eq("division", division)
    .eq("team_level", teamLevel)
    .order("round_number", { ascending: false })

  return rounds ?? []
}

// Wrapper for shared annotation action (re-export doesn't work in "use server" files)
import { toggleFavorite as _toggleFavorite } from "@/app/(app)/annotations/actions"
export async function toggleFavorite(playerId: string) {
  return _toggleFavorite(playerId)
}

export async function savePlayerNote(
  playerId: string,
  note: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("player_annotations")
    .upsert(
      {
        user_id: user.id,
        player_id: playerId,
        notes: note || null,
      },
      { onConflict: "user_id,player_id" }
    )

  if (error) return { error: error.message }
  return {}
}

import { getPlayerAnnotations as _getPlayerAnnotations } from "@/app/(app)/annotations/actions"
export async function getPlayerAnnotations(associationId: string) {
  return _getPlayerAnnotations(associationId)
}

export async function lockFinalTeam(roundId: string): Promise<{ error?: string, count?: number }> {
  const supabase = await createClient()

  // Fetch the round
  const { data: round, error: roundError } = await supabase
    .from("continuation_rounds")
    .select("*")
    .eq("id", roundId)
    .single()

  if (roundError || !round) return { error: "Round not found" }
  if (!round.is_final_team) return { error: "Round is not marked as final team" }

  // Find the team
  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("id")
    .eq("association_id", round.association_id)
    .eq("division", round.division)
    .eq("name", round.team_level)
    .single()

  if (teamError || !team) return { error: `Team ${round.division} ${round.team_level} not found` }

  // Match jersey numbers to players
  const { data: players } = await supabase
    .from("tryout_players")
    .select("id, jersey_number")
    .eq("association_id", round.association_id)
    .eq("division", round.division)
    .in("jersey_number", round.jersey_numbers)
    .is("deleted_at", null)

  if (!players || players.length === 0) return { error: "No matching players found" }

  // Update each matched player
  const playerIds = players.map((p) => p.id)
  const { error: updateError } = await supabase
    .from("tryout_players")
    .update({ team_id: team.id, status: "made_team" as const })
    .in("id", playerIds)

  if (updateError) return { error: updateError.message }
  return { count: playerIds.length }
}
