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

export async function linkUnknownPlayer(
  selectedPlayerId: string,
  newJerseyNumber: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // Fetch player to check association
  const { data: player } = await supabase
    .from("tryout_players")
    .select("association_id, division")
    .eq("id", selectedPlayerId)
    .single()

  if (!player) return { error: "Player not found" }

  // Verify admin role
  const { data: membership } = await supabase
    .from("user_associations")
    .select("role")
    .eq("user_id", user.id)
    .eq("association_id", player.association_id)
    .single()

  if (!membership || (membership.role !== "group_admin" && membership.role !== "admin")) {
    return { error: "Unauthorized" }
  }

  // Check for duplicate jersey number
  const { data: duplicate } = await supabase
    .from("tryout_players")
    .select("id")
    .eq("association_id", player.association_id)
    .eq("division", player.division)
    .eq("jersey_number", newJerseyNumber)
    .neq("id", selectedPlayerId)
    .is("deleted_at", null)
    .maybeSingle()

  if (duplicate) {
    return { error: `Jersey #${newJerseyNumber} already exists in this division` }
  }

  const { error } = await supabase
    .from("tryout_players")
    .update({ jersey_number: newJerseyNumber })
    .eq("id", selectedPlayerId)

  if (error) return { error: error.message }
  return {}
}

export async function suggestPlayerLink(
  selectedPlayerId: string,
  newJerseyNumber: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // Fetch player's current jersey number
  const { data: player } = await supabase
    .from("tryout_players")
    .select("jersey_number, association_id")
    .eq("id", selectedPlayerId)
    .single()

  if (!player) return { error: "Player not found" }

  // Submit a correction
  const { error } = await supabase
    .from("corrections")
    .insert({
      player_id: selectedPlayerId,
      user_id: user.id,
      association_id: player.association_id,
      field_name: "jersey_number",
      old_value: player.jersey_number,
      new_value: newJerseyNumber,
      status: "pending",
    })

  if (error) return { error: error.message }
  return {}
}

export async function createSuggestedPlayer(
  data: {
    association_id: string
    division: string
    jersey_number: string
    name: string
    position: string
  }
): Promise<{ error?: string, playerId?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data: newPlayer, error } = await supabase
    .from("tryout_players")
    .insert({
      association_id: data.association_id,
      division: data.division,
      jersey_number: data.jersey_number,
      name: data.name,
      position: data.position,
      status: "registered",
      suggested_by: user.id,
    })
    .select("id")
    .single()

  if (error) return { error: error.message }
  return { playerId: newPlayer.id }
}

export async function submitSuggestedPlayer(
  playerId: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // Fetch player's association
  const { data: player } = await supabase
    .from("tryout_players")
    .select("association_id")
    .eq("id", playerId)
    .single()

  if (!player) return { error: "Player not found" }

  const { error } = await supabase
    .from("corrections")
    .insert({
      player_id: playerId,
      user_id: user.id,
      association_id: player.association_id,
      field_name: "add_player",
      old_value: "",
      new_value: "suggested",
      status: "pending",
    })

  if (error) return { error: error.message }
  return {}
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
