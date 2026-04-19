"use server"

import { createClient } from "@/lib/supabase/server"
import type { ParsedPlayer } from "@/components/import/csv-upload"

export async function importPlayers(
  associationId: string,
  rows: ParsedPlayer[]
): Promise<{ count: number, error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { count: 0, error: "Not authenticated" }

  // Verify user is admin for this association
  const { data: membership } = await supabase
    .from("user_associations")
    .select("role")
    .eq("user_id", user.id)
    .eq("association_id", associationId)
    .single()

  if (!membership || (membership.role !== "group_admin" && membership.role !== "admin")) {
    return { count: 0, error: "Not authorized" }
  }

  const insertRows = rows
    .filter((r) => !r.error && r.name && r.jersey_number && r.division)
    .map((r) => ({
      association_id: associationId,
      name: r.name,
      jersey_number: r.jersey_number,
      division: r.division,
      status: r.status as "registered" | "trying_out" | "cut" | "made_team" | "moved_up" | "moved_down" | "withdrew",
      previous_team: r.previous_team || null,
    }))

  if (insertRows.length === 0) {
    return { count: 0, error: "No valid rows to import" }
  }

  const { error } = await supabase
    .from("tryout_players")
    .insert(insertRows)

  if (error) {
    return { count: 0, error: error.message }
  }

  return { count: insertRows.length }
}
