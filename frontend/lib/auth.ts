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

  const { data: memberships } = await supabase
    .from("user_associations")
    .select("association_id, role, associations(id, name, abbreviation)")
    .eq("user_id", user.id)

  if (!memberships || memberships.length === 0) {
    redirect("/join")
  }

  const active = memberships[0]

  return {
    supabase,
    user,
    associationId: active.association_id,
    role: active.role,
    association: active.associations as unknown as { id: string, name: string, abbreviation: string },
  }
}

export async function requireAdmin() {
  const result = await requireAssociation()

  if (result.role !== "group_admin" && result.role !== "admin") {
    redirect("/dashboard")
  }

  return result
}
