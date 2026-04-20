"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

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

type CorrectionRow = {
  id: string
  player_id: string
  field_name: string
  old_value: string
  new_value: string
  status: string
  created_at: string
  user_id: string
  player_jersey: string
  player_name: string
  player_division: string
  submitter_email: string
}

export async function getPendingCorrections(
  associationId: string
): Promise<CorrectionRow[]> {
  const supabase = await createClient()

  const { data: corrections } = await supabase
    .from("corrections")
    .select("*, tryout_players!inner(jersey_number, name, division)")
    .eq("association_id", associationId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })

  if (!corrections || corrections.length === 0) return []

  // Batch-fetch submitter emails via admin client
  const uniqueUserIds = [...new Set(corrections.map((c) => c.user_id))]
  const emailMap = new Map<string, string>()

  const admin = createAdminClient()
  for (const uid of uniqueUserIds) {
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
    }
    return {
      id: c.id,
      player_id: c.player_id,
      field_name: c.field_name,
      old_value: c.old_value,
      new_value: c.new_value,
      status: c.status,
      created_at: c.created_at,
      user_id: c.user_id,
      player_jersey: player.jersey_number,
      player_name: player.name,
      player_division: player.division,
      submitter_email: emailMap.get(c.user_id) ?? c.user_id.substring(0, 8),
    }
  })
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
