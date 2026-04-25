"use server"

import { createClient } from "@/lib/supabase/server"
import type { TryoutPlayer } from "@/types"

export async function toggleFavorite(playerId: string): Promise<{ isFavorite: boolean, error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { isFavorite: false, error: "Not authenticated" }

  const { data: existing } = await supabase
    .from("player_annotations")
    .select("id, is_favorite")
    .eq("user_id", user.id)
    .eq("player_id", playerId)
    .maybeSingle()

  if (existing) {
    const newValue = !existing.is_favorite
    const { error } = await supabase
      .from("player_annotations")
      .update({ is_favorite: newValue })
      .eq("id", existing.id)
    if (error) return { isFavorite: existing.is_favorite, error: error.message }
    return { isFavorite: newValue }
  } else {
    const { error } = await supabase
      .from("player_annotations")
      .insert({ user_id: user.id, player_id: playerId, is_favorite: true })
    if (error) return { isFavorite: false, error: error.message }
    return { isFavorite: true }
  }
}

export async function getPlayerAnnotations(
  associationId: string
): Promise<Record<string, { isFavorite: boolean, notes: string | null, customName: string | null, customJersey: string | null, customPosition: string | null, customPreviousTeam: string | null, customTeam: string | null }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return {}

  const { data: annotations } = await supabase
    .from("player_annotations")
    .select("player_id, is_favorite, notes, custom_name, custom_jersey, custom_position, custom_previous_team, custom_team, tryout_players!inner(association_id)")
    .eq("user_id", user.id)
    .eq("tryout_players.association_id", associationId)

  const result: Record<string, { isFavorite: boolean, notes: string | null, customName: string | null, customJersey: string | null, customPosition: string | null, customPreviousTeam: string | null, customTeam: string | null }> = {}
  for (const ann of annotations ?? []) {
    result[ann.player_id] = {
      isFavorite: ann.is_favorite,
      notes: ann.notes,
      customName: ann.custom_name,
      customJersey: (ann as Record<string, unknown>).custom_jersey as string | null,
      customPosition: (ann as Record<string, unknown>).custom_position as string | null,
      customPreviousTeam: (ann as Record<string, unknown>).custom_previous_team as string | null,
      customTeam: (ann as Record<string, unknown>).custom_team as string | null,
    }
  }
  return result
}

export async function bulkToggleFavorite(
  playerIds: string[],
  setFavorite: boolean,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const rows = playerIds.map((playerId) => ({
    user_id: user.id,
    player_id: playerId,
    is_favorite: setFavorite,
  }))

  const { error } = await supabase
    .from("player_annotations")
    .upsert(rows, { onConflict: "user_id,player_id", ignoreDuplicates: false })

  if (error) return { error: error.message }
  return {}
}

export async function savePlayerAnnotations(
  playerId: string,
  annotations: {
    customName?: string | null
    customJersey?: string | null
    customPosition?: string | null
    customPreviousTeam?: string | null
    customTeam?: string | null
  }
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const row: Record<string, unknown> = {
    user_id: user.id,
    player_id: playerId,
  }
  if (annotations.customName !== undefined) row.custom_name = annotations.customName || null
  if (annotations.customJersey !== undefined) row.custom_jersey = annotations.customJersey || null
  if (annotations.customPosition !== undefined) row.custom_position = annotations.customPosition || null
  if (annotations.customPreviousTeam !== undefined) row.custom_previous_team = annotations.customPreviousTeam || null
  if (annotations.customTeam !== undefined) row.custom_team = annotations.customTeam || null

  const { error } = await supabase
    .from("player_annotations")
    .upsert(row, { onConflict: "user_id,player_id" })

  if (error) return { error: error.message }
  return {}
}

export async function saveCustomName(
  playerId: string,
  customName: string
): Promise<{ error?: string }> {
  return savePlayerAnnotations(playerId, { customName })
}

export async function getMyPlayers(
  associationId: string
): Promise<{ player: TryoutPlayer, annotation: { isFavorite: boolean, customName: string | null } }[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: annotations } = await supabase
    .from("player_annotations")
    .select("player_id, is_favorite, custom_name, custom_jersey, custom_position, custom_previous_team, custom_team, tryout_players!inner(*)")
    .eq("user_id", user.id)
    .eq("tryout_players.association_id", associationId)
    .or("is_favorite.eq.true,custom_name.neq.,custom_jersey.neq.,custom_position.neq.,custom_previous_team.neq.,custom_team.neq.")

  if (!annotations || annotations.length === 0) return []

  const result = annotations.map((ann) => {
    const player = ann.tryout_players as unknown as TryoutPlayer
    return {
      player,
      annotation: {
        isFavorite: ann.is_favorite,
        customName: ann.custom_name,
      },
    }
  })

  // Sort by division then jersey number
  result.sort((a, b) => {
    const divA = a.player.division ?? ""
    const divB = b.player.division ?? ""
    if (divA !== divB) return divA.localeCompare(divB)
    const jA = parseInt(a.player.jersey_number ?? "999", 10)
    const jB = parseInt(b.player.jersey_number ?? "999", 10)
    return jA - jB
  })

  return result
}

export async function savePlayerNote(
  playerId: string,
  note: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("player_annotations")
    .upsert(
      {
        user_id: user.id,
        player_id: playerId,
        notes: note || null,
      },
      { onConflict: "user_id,player_id" }
    )

  if (error) return { error: error.message }
  return {}
}

export async function getMyPlayersCount(
  associationId: string
): Promise<number> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0

  const { count } = await supabase
    .from("player_annotations")
    .select("player_id, tryout_players!inner(association_id)", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("tryout_players.association_id", associationId)
    .or("is_favorite.eq.true,custom_name.neq.,custom_jersey.neq.,custom_position.neq.,custom_previous_team.neq.,custom_team.neq.")

  return count ?? 0
}
