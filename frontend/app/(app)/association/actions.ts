"use server"

import { createClient } from "@/lib/supabase/server"

export async function getAllAssociations(): Promise<
  { id: string, name: string, abbreviation: string }[]
> {
  const supabase = await createClient()

  const { data } = await supabase
    .from("associations")
    .select("id, name, abbreviation")
    .eq("join_enabled", true)
    .order("name")

  return data ?? []
}

export async function setActiveAssociation(
  associationId: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // Auto-join if not already a member
  const { data: existing } = await supabase
    .from("user_associations")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("association_id", associationId)
    .single()

  if (!existing) {
    const { error: joinError } = await supabase
      .from("user_associations")
      .insert({
        user_id: user.id,
        association_id: associationId,
        role: "member",
      })
    if (joinError) return { error: joinError.message }
  }

  // Clear all active tracked groups for this user
  await supabase
    .from("user_tracked_groups")
    .update({ is_active: false })
    .eq("user_id", user.id)

  // Set a default division as active for the new association
  // Find the division with the most players, or default to "U15"
  const { data: players } = await supabase
    .from("tryout_players")
    .select("division")
    .eq("association_id", associationId)
    .is("deleted_at", null)

  const counts: Record<string, number> = {}
  for (const row of players ?? []) {
    counts[row.division] = (counts[row.division] ?? 0) + 1
  }

  const defaultDivision = Object.entries(counts).length > 0
    ? Object.entries(counts).reduce((a, b) => a[1] > b[1] ? a : b)[0]
    : "U15"

  const { error } = await supabase
    .from("user_tracked_groups")
    .upsert(
      {
        user_id: user.id,
        association_id: associationId,
        division: defaultDivision,
        label: defaultDivision,
        is_active: true,
      },
      { onConflict: "user_id,association_id,division" }
    )

  if (error) return { error: error.message }
  return {}
}
