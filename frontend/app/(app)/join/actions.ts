"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export async function joinAssociation(
  joinCode: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // Find association by join code
  const { data: association } = await supabase
    .from("associations")
    .select("id, name, join_enabled")
    .eq("join_code", joinCode.trim().toUpperCase())
    .single()

  if (!association) {
    return { error: "Invalid join code. Check with your association&nbsp;admin." }
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
