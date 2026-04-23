"use server"

import { createClient } from "@/lib/supabase/server"

export async function getAllAssociations(): Promise<
  { id: string, name: string, abbreviation: string }[]
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Get all public associations
  const { data: publicAssocs } = await supabase
    .from("associations")
    .select("id, name, abbreviation")
    .eq("join_enabled", true)
    .order("name")

  // Get associations the user belongs to (includes hidden ones like sandbox)
  let memberAssocs: { id: string, name: string, abbreviation: string }[] = []
  if (user) {
    const { data: memberships } = await supabase
      .from("user_associations")
      .select("associations(id, name, abbreviation)")
      .eq("user_id", user.id)

    memberAssocs = (memberships ?? [])
      .map((m) => m.associations as unknown as { id: string, name: string, abbreviation: string })
      .filter(Boolean)
  }

  // Merge and deduplicate by id
  const merged = new Map<string, { id: string, name: string, abbreviation: string }>()
  for (const a of [...(publicAssocs ?? []), ...memberAssocs]) {
    merged.set(a.id, a)
  }

  return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name))
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
