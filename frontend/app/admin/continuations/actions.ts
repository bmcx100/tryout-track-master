"use server"

import { createClient } from "@/lib/supabase/server"
import type { ContinuationRound, ContinuationLevelStatus } from "@/types"

export async function getAllRounds(
  associationId: string,
  division: string
): Promise<ContinuationRound[]> {
  const supabase = await createClient()

  const { data: rounds } = await supabase
    .from("continuation_rounds")
    .select("*")
    .eq("association_id", associationId)
    .eq("division", division)
    .order("team_level", { ascending: true })
    .order("round_number", { ascending: false })

  return rounds ?? []
}

export async function updateRound(
  roundId: string,
  updates: {
    jersey_numbers?: string[]
    ip_players?: string[]
    session_info?: string | null
    team_level?: string
    round_number?: number
    is_final_team?: boolean
    estimated_players?: number | null
  }
): Promise<{ error?: string }> {
  const supabase = await createClient()

  // If jersey_numbers changes, clean stale ip_players
  const updatePayload: Record<string, unknown> = { ...updates }
  if (updates.jersey_numbers && updates.ip_players) {
    const jerseySet = new Set(updates.jersey_numbers)
    updatePayload.ip_players = updates.ip_players.filter((ip: string) => jerseySet.has(ip))
  }

  const { error } = await supabase
    .from("continuation_rounds")
    .update(updatePayload)
    .eq("id", roundId)

  if (error) return { error: error.message }
  return {}
}

export async function deleteRound(
  roundId: string
): Promise<{ error?: string, revertedCount?: number }> {
  const supabase = await createClient()

  // Fetch the round
  const { data: round, error: roundError } = await supabase
    .from("continuation_rounds")
    .select("*")
    .eq("id", roundId)
    .single()

  if (roundError || !round) return { error: "Round not found" }

  let revertedCount = 0

  // If final team round, revert players
  if (round.is_final_team) {
    // Find the team
    const { data: team } = await supabase
      .from("teams")
      .select("id")
      .eq("association_id", round.association_id)
      .eq("division", round.division)
      .eq("name", round.team_level)
      .single()

    if (team) {
      // Find players to revert
      const { data: players } = await supabase
        .from("tryout_players")
        .select("id")
        .eq("association_id", round.association_id)
        .eq("division", round.division)
        .eq("team_id", team.id)
        .eq("status", "made_team")
        .in("jersey_number", round.jersey_numbers)
        .is("deleted_at", null)

      if (players && players.length > 0) {
        const playerIds = players.map((p) => p.id)
        const { error: revertError } = await supabase
          .from("tryout_players")
          .update({ status: "trying_out" as const, team_id: null })
          .in("id", playerIds)

        if (revertError) return { error: revertError.message }
        revertedCount = playerIds.length
      }
    }
  }

  // Delete associated continuation_orders
  await supabase
    .from("continuation_orders")
    .delete()
    .eq("round_id", roundId)

  // Delete the round
  const { error: deleteError } = await supabase
    .from("continuation_rounds")
    .delete()
    .eq("id", roundId)

  if (deleteError) return { error: deleteError.message }
  return { revertedCount }
}

export async function createEmptyRound(
  associationId: string,
  division: string,
  teamLevel: string,
  roundNumber: number,
  sessionInfo?: string
): Promise<{ roundId: string, error?: string }> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("continuation_rounds")
    .insert({
      association_id: associationId,
      division,
      team_level: teamLevel,
      round_number: roundNumber,
      jersey_numbers: [],
      ip_players: [],
      sessions: [],
      status: "published",
      session_info: sessionInfo || null,
    })
    .select("id")
    .single()

  if (error) return { roundId: "", error: error.message }
  return { roundId: data.id }
}

export async function getRevertablePlayerCount(
  roundId: string
): Promise<number> {
  const supabase = await createClient()

  const { data: round } = await supabase
    .from("continuation_rounds")
    .select("association_id, division, team_level, jersey_numbers, is_final_team")
    .eq("id", roundId)
    .single()

  if (!round || !round.is_final_team) return 0

  const { data: team } = await supabase
    .from("teams")
    .select("id")
    .eq("association_id", round.association_id)
    .eq("division", round.division)
    .eq("name", round.team_level)
    .single()

  if (!team) return 0

  const { data: players } = await supabase
    .from("tryout_players")
    .select("id")
    .eq("association_id", round.association_id)
    .eq("division", round.division)
    .eq("team_id", team.id)
    .eq("status", "made_team")
    .in("jersey_number", round.jersey_numbers)
    .is("deleted_at", null)

  return players?.length ?? 0
}

export async function getCompletedLevels(
  associationId: string,
  division: string
): Promise<Pick<ContinuationLevelStatus, "team_level" | "completed_at" | "completed_by">[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from("continuation_level_status")
    .select("team_level, completed_at, completed_by")
    .eq("association_id", associationId)
    .eq("division", division)
    .eq("is_completed", true)

  return data ?? []
}

export async function completeLevel(
  associationId: string,
  division: string,
  teamLevel: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // Safety check: verify a Final Team round exists for this level
  const { data: finalRound } = await supabase
    .from("continuation_rounds")
    .select("id")
    .eq("association_id", associationId)
    .eq("division", division)
    .eq("team_level", teamLevel)
    .eq("is_final_team", true)
    .eq("status", "published")
    .limit(1)
    .single()

  if (!finalRound) {
    return { error: "No Final Team round exists for this level" }
  }

  // Upsert level status
  const { error } = await supabase
    .from("continuation_level_status")
    .upsert({
      association_id: associationId,
      division,
      team_level: teamLevel,
      is_completed: true,
      completed_at: new Date().toISOString(),
      completed_by: user.id,
    }, { onConflict: "association_id,division,team_level" })

  if (error) return { error: error.message }

  // Audit log
  await supabase.from("audit_log").insert({
    action: "complete_level",
    association_id: associationId,
    target_table: "continuation_level_status",
    target_id: associationId,
    user_id: user.id,
    new_values: { division, team_level: teamLevel },
  })

  return {}
}

export async function uncompleteLevel(
  associationId: string,
  division: string,
  teamLevel: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("continuation_level_status")
    .update({
      is_completed: false,
      completed_at: null,
      completed_by: null,
    })
    .eq("association_id", associationId)
    .eq("division", division)
    .eq("team_level", teamLevel)

  if (error) return { error: error.message }

  // Audit log
  await supabase.from("audit_log").insert({
    action: "uncomplete_level",
    association_id: associationId,
    target_table: "continuation_level_status",
    target_id: associationId,
    user_id: user.id,
    new_values: { division, team_level: teamLevel },
  })

  return {}
}
