"use server"

import { createClient } from "@/lib/supabase/server"
import type { ContinuationRound } from "@/types"

export async function getAllPublishedRounds(
  associationId: string,
  division: string
): Promise<ContinuationRound[]> {
  const supabase = await createClient()

  const { data: rounds } = await supabase
    .from("continuation_rounds")
    .select("*")
    .eq("association_id", associationId)
    .eq("division", division)
    .eq("status", "published")
    .order("created_at", { ascending: false })

  return rounds ?? []
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

import { savePlayerNote as _savePlayerNote } from "@/app/(app)/annotations/actions"
export async function savePlayerNote(playerId: string, note: string) {
  return _savePlayerNote(playerId, note)
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
