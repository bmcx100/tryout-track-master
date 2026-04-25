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

export async function resetPredictionOrders(
  associationId: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("player_predictions")
    .delete()
    .eq("user_id", user.id)
    .eq("association_id", associationId)

  if (error) return { error: error.message }
  return {}
}

export async function resetPreviousTeamOrders(
  associationId: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("previous_team_orders")
    .delete()
    .eq("user_id", user.id)
    .eq("association_id", associationId)

  if (error) return { error: error.message }
  return {}
}

export async function savePreviousTeamOrder(
  associationId: string,
  previousTeam: string,
  playerOrder: string[]
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("previous_team_orders")
    .upsert(
      {
        user_id: user.id,
        association_id: associationId,
        previous_team: previousTeam,
        player_order: playerOrder,
      },
      { onConflict: "user_id,association_id,previous_team" }
    )

  if (error) return { error: error.message }
  return {}
}

export async function saveTeamGroupOrder(
  associationId: string,
  division: string,
  teamOrder: string[]
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("team_group_orders")
    .upsert(
      {
        user_id: user.id,
        association_id: associationId,
        division,
        team_order: teamOrder,
      },
      { onConflict: "user_id,association_id,division" }
    )

  if (error) return { error: error.message }
  return {}
}

export async function resetTeamGroupOrders(
  associationId: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("team_group_orders")
    .delete()
    .eq("user_id", user.id)
    .eq("association_id", associationId)

  if (error) return { error: error.message }
  return {}
}
