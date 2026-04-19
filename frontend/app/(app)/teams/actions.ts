"use server"

import { createClient } from "@/lib/supabase/server"

export async function savePredictionOrder(
  associationId: string,
  division: string,
  playerOrder: string[]
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("player_predictions")
    .upsert(
      {
        user_id: user.id,
        association_id: associationId,
        division,
        player_order: playerOrder,
      },
      { onConflict: "user_id,association_id,division" }
    )

  if (error) return { error: error.message }
  return {}
}
