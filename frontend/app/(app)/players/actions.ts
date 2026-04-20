"use server"

import { createClient } from "@/lib/supabase/server"

export async function adminUpdatePlayer(
  playerId: string,
  updates: { name?: string, jersey_number?: string, position?: string, previous_team?: string }
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // Fetch player to check association
  const { data: player } = await supabase
    .from("tryout_players")
    .select("association_id, division")
    .eq("id", playerId)
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

  // Check for duplicate jersey number if changing it
  if (updates.jersey_number) {
    const { data: duplicate } = await supabase
      .from("tryout_players")
      .select("id")
      .eq("association_id", player.association_id)
      .eq("division", player.division)
      .eq("jersey_number", updates.jersey_number)
      .neq("id", playerId)
      .is("deleted_at", null)
      .maybeSingle()

    if (duplicate) {
      return { error: `Jersey #${updates.jersey_number} already exists in this division` }
    }
  }

  const { error } = await supabase
    .from("tryout_players")
    .update(updates)
    .eq("id", playerId)

  if (error) return { error: error.message }
  return {}
}

export async function adminDeletePlayer(
  playerId: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // Fetch player to check association
  const { data: player } = await supabase
    .from("tryout_players")
    .select("association_id")
    .eq("id", playerId)
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

  const { error } = await supabase
    .from("tryout_players")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", playerId)

  if (error) return { error: error.message }
  return {}
}

export async function adminCreatePlayer(
  data: {
    association_id: string
    division: string
    jersey_number: string
    name: string
    position: string
    previous_team?: string
  }
): Promise<{ error?: string, playerId?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // Verify admin role
  const { data: membership } = await supabase
    .from("user_associations")
    .select("role")
    .eq("user_id", user.id)
    .eq("association_id", data.association_id)
    .single()

  if (!membership || (membership.role !== "group_admin" && membership.role !== "admin")) {
    return { error: "Unauthorized" }
  }

  // Check for duplicate jersey number
  const { data: duplicate } = await supabase
    .from("tryout_players")
    .select("id")
    .eq("association_id", data.association_id)
    .eq("division", data.division)
    .eq("jersey_number", data.jersey_number)
    .is("deleted_at", null)
    .maybeSingle()

  if (duplicate) {
    return { error: `Jersey #${data.jersey_number} already exists in this division` }
  }

  const { data: newPlayer, error } = await supabase
    .from("tryout_players")
    .insert({
      association_id: data.association_id,
      division: data.division,
      jersey_number: data.jersey_number,
      name: data.name,
      position: data.position,
      previous_team: data.previous_team || null,
      status: "registered",
    })
    .select("id")
    .single()

  if (error) return { error: error.message }
  return { playerId: newPlayer.id }
}
