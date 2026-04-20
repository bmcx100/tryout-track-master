import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export async function requireAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  return { supabase, user }
}

export async function requireAssociation() {
  const { supabase, user } = await requireAuth()

  // Check if user has an active tracked group (tells us their active association)
  const { data: activeGroup } = await supabase
    .from("user_tracked_groups")
    .select("association_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .single()

  // Get user's existing memberships
  const { data: memberships } = await supabase
    .from("user_associations")
    .select("association_id, role, associations(id, name, abbreviation)")
    .eq("user_id", user.id)

  // Determine active association ID
  let activeAssociationId = activeGroup?.association_id
    ?? memberships?.[0]?.association_id
    ?? null

  // If no memberships at all, auto-join the first available association
  if (!memberships || memberships.length === 0) {
    const { data: firstAssoc } = await supabase
      .from("associations")
      .select("id, name, abbreviation")
      .eq("join_enabled", true)
      .order("name")
      .limit(1)
      .single()

    if (!firstAssoc) {
      // No associations exist in the system
      redirect("/login")
    }

    await supabase
      .from("user_associations")
      .insert({
        user_id: user.id,
        association_id: firstAssoc.id,
        role: "member",
      })

    return {
      supabase,
      user,
      associationId: firstAssoc.id,
      role: "member" as const,
      association: firstAssoc,
    }
  }

  // If active association from tracked groups doesn't match any membership, fall back
  const activeMembership = memberships.find(
    (m) => m.association_id === activeAssociationId
  ) ?? memberships[0]

  return {
    supabase,
    user,
    associationId: activeMembership.association_id,
    role: activeMembership.role,
    association: activeMembership.associations as unknown as { id: string, name: string, abbreviation: string },
  }
}

export async function requireAdmin() {
  const result = await requireAssociation()

  if (result.role !== "group_admin" && result.role !== "admin") {
    redirect("/dashboard")
  }

  return result
}
