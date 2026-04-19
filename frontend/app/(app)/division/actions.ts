"use server"

import { createClient } from "@/lib/supabase/server"

export async function getDivisions(
  associationId: string
): Promise<{ division: string, playerCount: number }[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from("tryout_players")
    .select("division")
    .eq("association_id", associationId)
    .is("deleted_at", null)

  if (!data) return []

  const counts: Record<string, number> = {}
  for (const row of data) {
    counts[row.division] = (counts[row.division] ?? 0) + 1
  }

  // Always include all standard age groups
  const allDivisions = ["U11", "U13", "U15", "U18"]
  for (const div of allDivisions) {
    if (!(div in counts)) counts[div] = 0
  }

  return Object.entries(counts)
    .map(([division, playerCount]) => ({ division, playerCount }))
    .sort((a, b) => a.division.localeCompare(b.division))
}

export async function getActiveDivision(
  associationId: string
): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from("user_tracked_groups")
    .select("division")
    .eq("user_id", user.id)
    .eq("association_id", associationId)
    .eq("is_active", true)
    .limit(1)
    .single()

  return data?.division ?? null
}

export async function setActiveDivision(
  associationId: string,
  division: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // Set all rows for this user+association to inactive
  await supabase
    .from("user_tracked_groups")
    .update({ is_active: false })
    .eq("user_id", user.id)
    .eq("association_id", associationId)

  // Upsert the selected division as active
  const { error } = await supabase
    .from("user_tracked_groups")
    .upsert(
      {
        user_id: user.id,
        association_id: associationId,
        division,
        label: division,
        is_active: true,
      },
      { onConflict: "user_id,association_id,division" }
    )

  if (error) return { error: error.message }
  return {}
}
