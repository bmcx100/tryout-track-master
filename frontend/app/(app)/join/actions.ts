"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export async function getAvailableAssociations() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // Get associations the user has NOT already joined
  const { data: memberships } = await supabase
    .from("user_associations")
    .select("association_id")
    .eq("user_id", user.id)

  const joinedIds = (memberships ?? []).map((m) => m.association_id)

  let query = supabase
    .from("associations")
    .select("id, name, abbreviation")
    .eq("join_enabled", true)
    .order("name")

  if (joinedIds.length > 0) {
    query = query.not("id", "in", `(${joinedIds.join(",")})`)
  }

  const { data: associations } = await query
  return associations ?? []
}

export async function joinAssociation(
  associationId: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // Verify association exists and is accepting members
  const { data: association } = await supabase
    .from("associations")
    .select("id, name, join_enabled")
    .eq("id", associationId)
    .single()

  if (!association) {
    return { error: "Association not found." }
  }

  if (!association.join_enabled) {
    return { error: "This association is not currently accepting new&nbsp;members." }
  }

  // Check if already a member
  const { data: existing } = await supabase
    .from("user_associations")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("association_id", association.id)
    .single()

  if (existing) {
    redirect("/dashboard")
  }

  // Insert membership
  const { error } = await supabase
    .from("user_associations")
    .insert({
      user_id: user.id,
      association_id: association.id,
      role: "member",
    })

  if (error) {
    return { error: "Failed to join. Please try&nbsp;again." }
  }

  redirect("/dashboard")
}
