"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { normalizePreviousTeam } from "@/lib/normalize-previous-team"
import type { TryoutPlayer } from "@/types"

export async function submitCorrection(
  playerId: string,
  fieldName: string,
  oldValue: string,
  newValue: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // Get the player's association_id
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
      field_name: fieldName,
      old_value: oldValue,
      new_value: newValue,
      status: "pending",
    })

  if (error) return { error: error.message }
  return {}
}

export async function getPendingCorrectionsCount(
  associationId: string
): Promise<number> {
  const supabase = await createClient()
  const { count } = await supabase
    .from("corrections")
    .select("id", { count: "exact", head: true })
    .eq("association_id", associationId)
    .eq("status", "pending")

  return count ?? 0
}

export type CorrectionRow = {
  id: string
  player_id: string
  field_name: string
  old_value: string
  new_value: string
  status: string
  created_at: string
  reviewed_at: string | null
  user_id: string
  player_jersey: string
  player_name: string
  player_division: string
  player_position?: string
  submitter_email: string
  current_value: string | null
  reviewed_by_email: string | null
}

export async function getCorrections(
  associationId: string,
  status: "pending" | "resolved"
): Promise<CorrectionRow[]> {
  const supabase = await createClient()

  let query = supabase
    .from("corrections")
    .select("*, tryout_players!inner(jersey_number, name, division, position, previous_team, team_id, teams(name))")
    .eq("association_id", associationId)

  if (status === "pending") {
    query = query.eq("status", "pending").order("created_at", { ascending: false })
  } else {
    query = query.in("status", ["approved", "rejected"]).order("reviewed_at", { ascending: false }).limit(50)
  }

  const { data: corrections } = await query

  if (!corrections || corrections.length === 0) return []

  // Batch-fetch submitter emails via admin client
  const uniqueUserIds = [...new Set(corrections.map((c) => c.user_id))]
  // Also collect reviewer IDs for resolved corrections
  const reviewerIds = status === "resolved"
    ? [...new Set(corrections.map((c) => c.reviewed_by).filter(Boolean))]
    : []
  const allUserIds = [...new Set([...uniqueUserIds, ...reviewerIds])]

  const emailMap = new Map<string, string>()
  const admin = createAdminClient()
  for (const uid of allUserIds) {
    const { data } = await admin.auth.admin.getUserById(uid)
    if (data?.user?.email) {
      emailMap.set(uid, data.user.email)
    }
  }

  return corrections.map((c) => {
    const player = c.tryout_players as unknown as {
      jersey_number: string
      name: string
      division: string
      position: string
      previous_team: string | null
      team_id: string | null
      teams: { name: string } | null
    }

    // Determine current value based on field_name
    let currentValue: string | null = null
    switch (c.field_name) {
      case "name":
        currentValue = player.name
        break
      case "jersey_number":
        currentValue = player.jersey_number
        break
      case "position":
        currentValue = player.position
        break
      case "previous_team":
        currentValue = player.previous_team
        break
      case "team":
        currentValue = player.teams?.name ?? null
        break
    }

    return {
      id: c.id,
      player_id: c.player_id,
      field_name: c.field_name,
      old_value: c.old_value,
      new_value: c.new_value,
      status: c.status,
      created_at: c.created_at,
      reviewed_at: c.reviewed_at ?? null,
      user_id: c.user_id,
      player_jersey: player.jersey_number,
      player_name: player.name,
      player_division: player.division,
      player_position: player.position,
      submitter_email: emailMap.get(c.user_id) ?? c.user_id.substring(0, 8),
      current_value: currentValue,
      reviewed_by_email: c.reviewed_by ? (emailMap.get(c.reviewed_by) ?? null) : null,
    }
  })
}

// Keep backward compat alias
export async function getPendingCorrections(
  associationId: string
): Promise<CorrectionRow[]> {
  return getCorrections(associationId, "pending")
}

export type MyCorrectionsRow = {
  id: string
  player_id: string
  field_name: string
  old_value: string
  new_value: string
  status: string
  created_at: string
  reviewed_at: string | null
  player_jersey: string
  player_name: string
  player_division: string
}

export async function getMyCorrections(
  associationId: string
): Promise<MyCorrectionsRow[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: corrections } = await supabase
    .from("corrections")
    .select("*, tryout_players!inner(jersey_number, name, division)")
    .eq("association_id", associationId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50)

  if (!corrections || corrections.length === 0) return []

  return corrections.map((c) => {
    const player = c.tryout_players as unknown as {
      jersey_number: string
      name: string
      division: string
    }
    return {
      id: c.id,
      player_id: c.player_id,
      field_name: c.field_name,
      old_value: c.old_value,
      new_value: c.new_value,
      status: c.status,
      created_at: c.created_at,
      reviewed_at: c.reviewed_at ?? null,
      player_jersey: player.jersey_number,
      player_name: player.name,
      player_division: player.division,
    }
  })
}

export async function getMyCorrectionsCount(
  associationId: string
): Promise<number> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0

  const { count } = await supabase
    .from("corrections")
    .select("id", { count: "exact", head: true })
    .eq("association_id", associationId)
    .eq("user_id", user.id)
    .eq("status", "pending")

  return count ?? 0
}

export async function reviewCorrection(
  correctionId: string,
  action: "approved" | "rejected"
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // Fetch the correction
  const { data: correction } = await supabase
    .from("corrections")
    .select("*")
    .eq("id", correctionId)
    .single()

  if (!correction) return { error: "Correction not found" }
  if (correction.status !== "pending") return { error: "Correction already reviewed" }

  // If approving, apply the change
  if (action === "approved") {
    if (correction.field_name === "jersey_number") {
      // Check for duplicate jersey number
      const { data: player } = await supabase
        .from("tryout_players")
        .select("division, association_id")
        .eq("id", correction.player_id)
        .single()

      if (player) {
        const { data: duplicate } = await supabase
          .from("tryout_players")
          .select("id")
          .eq("association_id", player.association_id)
          .eq("division", player.division)
          .eq("jersey_number", correction.new_value)
          .neq("id", correction.player_id)
          .is("deleted_at", null)
          .maybeSingle()

        if (duplicate) {
          return { error: `Jersey #${correction.new_value} already exists in this division` }
        }
      }

      const { error: updateError } = await supabase
        .from("tryout_players")
        .update({ jersey_number: correction.new_value })
        .eq("id", correction.player_id)

      if (updateError) return { error: updateError.message }
    } else if (correction.field_name === "name") {
      const { error: updateError } = await supabase
        .from("tryout_players")
        .update({ name: correction.new_value })
        .eq("id", correction.player_id)

      if (updateError) return { error: updateError.message }
    } else if (correction.field_name === "position") {
      const valid = ["F", "D", "G"]
      if (!valid.includes(correction.new_value)) {
        return { error: `Invalid position: ${correction.new_value}. Must be F, D, or G.` }
      }
      const { error: updateError } = await supabase
        .from("tryout_players")
        .update({ position: correction.new_value })
        .eq("id", correction.player_id)

      if (updateError) return { error: updateError.message }
    } else if (correction.field_name === "previous_team") {
      const { error: updateError } = await supabase
        .from("tryout_players")
        .update({ previous_team: normalizePreviousTeam(correction.new_value) })
        .eq("id", correction.player_id)

      if (updateError) return { error: updateError.message }
    } else if (correction.field_name === "team") {
      // Look up team by name for this player's association+division
      const { data: player } = await supabase
        .from("tryout_players")
        .select("division, association_id")
        .eq("id", correction.player_id)
        .single()

      if (player) {
        const { data: team } = await supabase
          .from("teams")
          .select("id")
          .eq("association_id", player.association_id)
          .eq("division", player.division)
          .ilike("name", correction.new_value)
          .maybeSingle()

        if (!team) {
          return { error: `Team "${correction.new_value}" not found in this division` }
        }

        const { error: updateError } = await supabase
          .from("tryout_players")
          .update({ team_id: team.id })
          .eq("id", correction.player_id)

        if (updateError) return { error: updateError.message }
      }
    }
  }

  // Update correction status
  const { error } = await supabase
    .from("corrections")
    .update({
      status: action,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", correctionId)

  if (error) return { error: error.message }
  return {}
}

export async function suggestPlayer(
  associationId: string,
  division: string,
  name: string,
  jerseyNumber: string,
  position: string,
  previousTeam: string,
): Promise<{ error?: string, player?: TryoutPlayer }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data: player, error: insertError } = await supabase
    .from("tryout_players")
    .insert({
      association_id: associationId,
      division,
      name,
      jersey_number: jerseyNumber,
      position,
      previous_team: previousTeam ? normalizePreviousTeam(previousTeam) : null,
      suggested_by: user.id,
      status: "trying_out",
    })
    .select()
    .single()

  if (insertError) return { error: insertError.message }

  const { error: correctionError } = await supabase
    .from("corrections")
    .insert({
      player_id: player.id,
      user_id: user.id,
      association_id: associationId,
      field_name: "add_player",
      old_value: "",
      new_value: `${name} #${jerseyNumber} (${position})`,
      status: "pending",
    })

  if (correctionError) return { error: correctionError.message }
  return { player: player as TryoutPlayer }
}

export async function reviewSuggestedPlayer(
  correctionId: string,
  action: "approved" | "rejected",
  updates?: { name?: string, jersey_number?: string, position?: string }
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // Fetch the correction
  const { data: correction } = await supabase
    .from("corrections")
    .select("*")
    .eq("id", correctionId)
    .single()

  if (!correction) return { error: "Correction not found" }
  if (correction.status !== "pending") return { error: "Correction already reviewed" }
  if (correction.field_name !== "add_player") return { error: "Not an add_player correction" }

  if (action === "approved") {
    // Apply any edits the admin made
    if (updates && Object.keys(updates).length > 0) {
      // Check for duplicate jersey number if changing it
      if (updates.jersey_number) {
        const { data: player } = await supabase
          .from("tryout_players")
          .select("division, association_id")
          .eq("id", correction.player_id)
          .single()

        if (player) {
          const { data: duplicate } = await supabase
            .from("tryout_players")
            .select("id")
            .eq("association_id", player.association_id)
            .eq("division", player.division)
            .eq("jersey_number", updates.jersey_number)
            .neq("id", correction.player_id)
            .is("deleted_at", null)
            .maybeSingle()

          if (duplicate) {
            return { error: `Jersey #${updates.jersey_number} already exists in this division` }
          }
        }
      }

      const { error: updateError } = await supabase
        .from("tryout_players")
        .update(updates)
        .eq("id", correction.player_id)

      if (updateError) return { error: updateError.message }
    }

    // Clear suggested_by to make player visible to everyone
    const { error: clearError } = await supabase
      .from("tryout_players")
      .update({ suggested_by: null })
      .eq("id", correction.player_id)

    if (clearError) return { error: clearError.message }
  } else {
    // Rejected: soft-delete the suggested player
    const { error: deleteError } = await supabase
      .from("tryout_players")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", correction.player_id)

    if (deleteError) return { error: deleteError.message }
  }

  // Update correction status
  const { error: statusError } = await supabase
    .from("corrections")
    .update({
      status: action,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", correctionId)

  if (statusError) return { error: statusError.message }
  return {}
}
