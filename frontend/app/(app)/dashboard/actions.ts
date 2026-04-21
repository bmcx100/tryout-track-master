"use server"

import { createClient } from "@/lib/supabase/server"

const LEVEL_ORDER = ["AA", "A", "BB", "B", "C"]

export type ActivityCard = {
  teamLevel: string
  roundNumber: number
  continuingCount: number
  cutCount: number
  publishedAt: string
  isFinalTeam: boolean
}

export type FavoriteStatus = {
  playerId: string
  playerName: string
  jerseyNumber: string
  position: string
  statusText: string
  statusType: "continuing" | "cut" | "made_team" | "missing" | "registered"
  division: string
  originalName: string | null
}

export async function getDashboardData(
  associationId: string,
  division: string
): Promise<{
  activityCards: ActivityCard[]
  favoriteStatuses: FavoriteStatus[]
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { activityCards: [], favoriteStatuses: [] }

  // 1. All published rounds for this division
  const { data: rounds } = await supabase
    .from("continuation_rounds")
    .select("*")
    .eq("association_id", associationId)
    .eq("division", division)
    .eq("status", "published")
    .order("round_number", { ascending: false })

  const allRounds = rounds ?? []

  // 2. User's favorite annotations joined with players
  const { data: favData } = await supabase
    .from("player_annotations")
    .select("player_id, is_favorite, custom_name, tryout_players!inner(id, name, jersey_number, position, division, status, team_id, association_id, deleted_at)")
    .eq("user_id", user.id)
    .eq("is_favorite", true)
    .eq("tryout_players.association_id", associationId)
    .eq("tryout_players.division", division)
    .is("tryout_players.deleted_at", null)

  // 3. Teams for made_team display names
  const { data: teamsData } = await supabase
    .from("teams")
    .select("id, name, division")
    .eq("association_id", associationId)
    .eq("division", division)

  const teamsMap = new Map((teamsData ?? []).map((t) => [t.id, t]))

  // --- Build activity cards ---
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()

  // Group rounds by team level
  const roundsByLevel = new Map<string, typeof allRounds>()
  for (const r of allRounds) {
    const existing = roundsByLevel.get(r.team_level) ?? []
    existing.push(r)
    roundsByLevel.set(r.team_level, existing)
  }

  const activityCards: ActivityCard[] = []
  for (const level of LEVEL_ORDER) {
    const levelRounds = roundsByLevel.get(level)
    if (!levelRounds || levelRounds.length === 0) continue

    // Rounds are already sorted desc by round_number
    const latest = levelRounds[0]
    if (latest.created_at < fiveDaysAgo) continue

    const previous = levelRounds.length > 1 ? levelRounds[1] : null
    const cutCount = previous
      ? previous.jersey_numbers.filter((jn: string) => !latest.jersey_numbers.includes(jn)).length
      : 0

    activityCards.push({
      teamLevel: level,
      roundNumber: latest.round_number,
      continuingCount: latest.jersey_numbers.length,
      cutCount,
      publishedAt: latest.created_at,
      isFinalTeam: latest.is_final_team,
    })
  }

  // --- Build favorite statuses ---
  const favoriteStatuses: FavoriteStatus[] = []

  for (const fav of favData ?? []) {
    const player = fav.tryout_players as unknown as {
      id: string
      name: string
      jersey_number: string
      position: string
      division: string
      status: string
      team_id: string | null
      association_id: string
      deleted_at: string | null
    }

    const displayName = fav.custom_name || player.name
    const originalName = fav.custom_name && fav.custom_name !== player.name
      ? player.name
      : null

    // Check made_team first
    if (player.status === "made_team" && player.team_id) {
      const team = teamsMap.get(player.team_id)
      favoriteStatuses.push({
        playerId: player.id,
        playerName: displayName,
        jerseyNumber: player.jersey_number,
        position: player.position ?? "?",
        statusText: `Made ${team?.name ?? "Team"}`,
        statusType: "made_team",
        division: player.division,
        originalName,
      })
      continue
    }

    // Derive status from rounds
    const playerStatus = derivePlayerStatus(
      player.jersey_number,
      allRounds,
      player.status
    )

    favoriteStatuses.push({
      playerId: player.id,
      playerName: displayName,
      jerseyNumber: player.jersey_number,
      position: player.position ?? "?",
      statusText: playerStatus.statusText,
      statusType: playerStatus.statusType,
      division: player.division,
      originalName,
    })
  }

  // Sort: missing first, then by level rank, then jersey number
  favoriteStatuses.sort((a, b) => {
    const aMissing = a.statusType === "missing" ? 0 : 1
    const bMissing = b.statusType === "missing" ? 0 : 1
    if (aMissing !== bMissing) return aMissing - bMissing

    const jA = parseInt(a.jerseyNumber ?? "999", 10)
    const jB = parseInt(b.jerseyNumber ?? "999", 10)
    return jA - jB
  })

  return { activityCards, favoriteStatuses }
}

function derivePlayerStatus(
  jerseyNumber: string,
  allRounds: { team_level: string, round_number: number, jersey_numbers: string[], created_at: string }[],
  playerDbStatus: string
): { statusText: string, statusType: "continuing" | "cut" | "missing" | "registered" } {
  // Group rounds by level
  const roundsByLevel = new Map<string, typeof allRounds>()
  for (const r of allRounds) {
    const existing = roundsByLevel.get(r.team_level) ?? []
    existing.push(r)
    roundsByLevel.set(r.team_level, existing)
  }

  // For each level (AA → C), find where the player appears
  let latestAppearance: { level: string, roundNumber: number, createdAt: string } | null = null
  let wasCut = false
  let cutLevel: string | null = null
  let cutRoundNumber = 0

  for (const level of LEVEL_ORDER) {
    const levelRounds = roundsByLevel.get(level)
    if (!levelRounds || levelRounds.length === 0) continue

    // Rounds are sorted desc by round_number already
    // Find last round where player appears
    const appearsIn = levelRounds.filter((r) =>
      r.jersey_numbers.includes(jerseyNumber)
    )

    if (appearsIn.length === 0) continue

    // Latest round where player appears at this level
    const latestInLevel = appearsIn[0] // highest round_number (desc sorted)
    const latestRoundAtLevel = levelRounds[0] // overall latest round at this level

    // Check if cut: appears in an earlier round but not in the latest round at this level
    if (latestRoundAtLevel.round_number > latestInLevel.round_number) {
      // Player was cut from this level
      if (!latestAppearance || latestInLevel.created_at > latestAppearance.createdAt) {
        wasCut = true
        cutLevel = level
        cutRoundNumber = latestRoundAtLevel.round_number
        latestAppearance = {
          level,
          roundNumber: latestInLevel.round_number,
          createdAt: latestInLevel.created_at,
        }
      }
    } else {
      // Player is continuing at this level
      if (!latestAppearance || latestInLevel.created_at > latestAppearance.createdAt) {
        wasCut = false
        cutLevel = null
        latestAppearance = {
          level,
          roundNumber: latestInLevel.round_number,
          createdAt: latestInLevel.created_at,
        }
      }
    }
  }

  if (!latestAppearance) {
    // No rounds data — use DB status
    const label = playerDbStatus === "trying_out" ? "Trying Out"
      : playerDbStatus === "registered" ? "Registered"
      : playerDbStatus.charAt(0).toUpperCase() + playerDbStatus.slice(1).replace(/_/g, " ")
    return { statusText: label, statusType: "registered" }
  }

  if (wasCut && cutLevel) {
    // Check if missing from next level
    const levelIdx = LEVEL_ORDER.indexOf(cutLevel)
    const nextLevel = levelIdx < LEVEL_ORDER.length - 1 ? LEVEL_ORDER[levelIdx + 1] : null

    let statusText = `Cut R${cutRoundNumber} (${cutLevel})`
    let statusType: "cut" | "missing" = "cut"

    if (nextLevel) {
      const nextLevelRounds = roundsByLevel.get(nextLevel)
      const seenAtNextLevel = nextLevelRounds?.some((r) =>
        r.jersey_numbers.includes(jerseyNumber)
      )
      if (!seenAtNextLevel) {
        statusText += ` \u00b7 Not at ${nextLevel}`
        statusType = "missing"
      }
    }

    return { statusText, statusType }
  }

  // Continuing
  return {
    statusText: `Continuing R${latestAppearance.roundNumber} (${latestAppearance.level})`,
    statusType: "continuing",
  }
}
