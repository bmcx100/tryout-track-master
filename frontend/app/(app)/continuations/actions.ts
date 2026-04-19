"use server"

import { createClient } from "@/lib/supabase/server"
import type { ContinuationRound } from "@/types"

const TEAM_TIER_ORDER = ["AA", "A", "BB", "B", "C"]

export async function getLatestRounds(
  associationId: string,
  division: string
): Promise<{ teamLevel: string, latestRound: ContinuationRound, previousRound: ContinuationRound | null }[]> {
  const supabase = await createClient()

  const { data: rounds } = await supabase
    .from("continuation_rounds")
    .select("*")
    .eq("association_id", associationId)
    .eq("division", division)
    .order("round_number", { ascending: false })

  if (!rounds || rounds.length === 0) return []

  // Group by team_level
  const byTeam: Record<string, ContinuationRound[]> = {}
  for (const round of rounds) {
    if (!byTeam[round.team_level]) byTeam[round.team_level] = []
    byTeam[round.team_level].push(round)
  }

  // For each team_level, get latest and previous
  const result: { teamLevel: string, latestRound: ContinuationRound, previousRound: ContinuationRound | null }[] = []
  for (const [teamLevel, teamRounds] of Object.entries(byTeam)) {
    const latest = teamRounds[0]
    const previous = teamRounds.length > 1 ? teamRounds[1] : null
    result.push({ teamLevel, latestRound: latest, previousRound: previous })
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

export async function toggleFavorite(playerId: string): Promise<{ isFavorite: boolean, error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { isFavorite: false, error: "Not authenticated" }

  // Check if annotation exists
  const { data: existing } = await supabase
    .from("player_annotations")
    .select("id, is_favorite")
    .eq("user_id", user.id)
    .eq("player_id", playerId)
    .maybeSingle()

  if (existing) {
    const newValue = !existing.is_favorite
    const { error } = await supabase
      .from("player_annotations")
      .update({ is_favorite: newValue })
      .eq("id", existing.id)
    if (error) return { isFavorite: existing.is_favorite, error: error.message }
    return { isFavorite: newValue }
  } else {
    const { error } = await supabase
      .from("player_annotations")
      .insert({ user_id: user.id, player_id: playerId, is_favorite: true })
    if (error) return { isFavorite: false, error: error.message }
    return { isFavorite: true }
  }
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

export async function getPlayerAnnotations(
  associationId: string
): Promise<Record<string, { isFavorite: boolean, notes: string | null }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return {}

  // Fetch all annotations for current user where the player belongs to this association
  const { data: annotations } = await supabase
    .from("player_annotations")
    .select("player_id, is_favorite, notes, tryout_players!inner(association_id)")
    .eq("user_id", user.id)
    .eq("tryout_players.association_id", associationId)

  const result: Record<string, { isFavorite: boolean, notes: string | null }> = {}
  for (const ann of annotations ?? []) {
    result[ann.player_id] = { isFavorite: ann.is_favorite, notes: ann.notes }
  }
  return result
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
