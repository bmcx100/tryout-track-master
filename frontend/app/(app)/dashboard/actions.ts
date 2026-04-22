"use server"

import { createClient } from "@/lib/supabase/server"

const LEVEL_ORDER = ["AA", "A", "BB", "B", "C"]

export type HeroCard = {
  division: string
  teamLevel: string
  roundNumber: number
  isFinalTeam: boolean
  publishedAt: string
  continuingCount: number
  cutCount: number
  missingCount: number
  totalPlayers: number
  isRoundOne: boolean
  favouritesOnTeam: number
  favouritesCutFinal: number
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
  previousTeam: string | null
}

export async function getDashboardData(
  associationId: string,
  division: string
): Promise<{
  heroCards: HeroCard[]
  favoriteStatuses: FavoriteStatus[]
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { heroCards: [], favoriteStatuses: [] }

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
    .select("player_id, is_favorite, custom_name, notes, tryout_players!inner(id, name, jersey_number, position, division, status, team_id, association_id, deleted_at, previous_team)")
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

  // --- Group rounds by team level ---
  const roundsByLevel = new Map<string, typeof allRounds>()
  for (const r of allRounds) {
    const existing = roundsByLevel.get(r.team_level) ?? []
    existing.push(r)
    roundsByLevel.set(r.team_level, existing)
  }

  // --- Build hero cards ---
  // Collect favourite jersey numbers for finalized team counts
  const favJerseyNumbers = new Set(
    (favData ?? []).map((fav) => {
      const player = fav.tryout_players as unknown as { jersey_number: string }
      return player.jersey_number
    })
  )

  const heroCards: HeroCard[] = []
  for (const level of LEVEL_ORDER) {
    const levelRounds = roundsByLevel.get(level)
    if (!levelRounds || levelRounds.length === 0) continue

    // Rounds are already sorted desc by round_number
    const latest = levelRounds[0]
    const previous = levelRounds.length > 1 ? levelRounds[1] : null
    const isRoundOne = !previous

    const totalPlayers = latest.jersey_numbers.length
    const continuingCount = totalPlayers
    const cutCount = previous
      ? previous.jersey_numbers.filter((jn: string) => !latest.jersey_numbers.includes(jn)).length
      : 0

    // Missing count: players cut from the level above who don't appear at ANY round at this level
    // Only compute if this level has rounds WITH posted jersey numbers
    let missingCount = 0
    const levelIdx = LEVEL_ORDER.indexOf(level)
    const thisLevelHasNumbers = levelRounds.some((r) => r.jersey_numbers.length > 0)
    if (levelIdx > 0 && thisLevelHasNumbers) {
      const levelAbove = LEVEL_ORDER[levelIdx - 1]
      const aboveRounds = roundsByLevel.get(levelAbove)
      if (aboveRounds && aboveRounds.length > 0) {
        const latestAbove = aboveRounds[0]
        // Players who were on a previous above-round but NOT on the latest above-round = cut from above
        const allAboveJerseys = new Set<string>()
        for (const r of aboveRounds) {
          for (const jn of r.jersey_numbers) {
            allAboveJerseys.add(jn)
          }
        }
        const stillAtAbove = new Set<string>(latestAbove.jersey_numbers)
        const cutFromAbove = [...allAboveJerseys].filter((jn) => !stillAtAbove.has(jn))

        // Check which of those cut players appear at ANY round at this level
        const allThisLevelJerseys = new Set<string>()
        for (const r of levelRounds) {
          for (const jn of r.jersey_numbers) {
            allThisLevelJerseys.add(jn)
          }
        }

        missingCount = cutFromAbove.filter((jn) => !allThisLevelJerseys.has(jn)).length
      }
    }

    // Finalized team: count favourites on roster vs cut
    let favouritesOnTeam = 0
    let favouritesCutFinal = 0
    if (latest.is_final_team) {
      const finalJerseys = new Set<string>(latest.jersey_numbers)
      for (const jn of favJerseyNumbers) {
        if (finalJerseys.has(jn)) {
          favouritesOnTeam++
        }
      }
      if (previous) {
        const prevJerseys = new Set<string>(previous.jersey_numbers)
        for (const jn of favJerseyNumbers) {
          if (prevJerseys.has(jn) && !finalJerseys.has(jn)) {
            favouritesCutFinal++
          }
        }
      }
    }

    heroCards.push({
      division,
      teamLevel: level,
      roundNumber: latest.round_number,
      isFinalTeam: latest.is_final_team,
      publishedAt: latest.created_at,
      continuingCount,
      cutCount,
      missingCount,
      totalPlayers,
      isRoundOne,
      favouritesOnTeam,
      favouritesCutFinal,
    })
  }

  // Sort: finalized first, then by LEVEL_ORDER
  heroCards.sort((a, b) => {
    if (a.isFinalTeam !== b.isFinalTeam) return a.isFinalTeam ? -1 : 1
    return LEVEL_ORDER.indexOf(a.teamLevel) - LEVEL_ORDER.indexOf(b.teamLevel)
  })

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
      previous_team: string | null
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
        previousTeam: player.previous_team,
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
      previousTeam: player.previous_team,
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

  return { heroCards, favoriteStatuses }
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

  // For each level (AA -> C), compare latest round to the immediately previous round
  // (same logic as the Sessions page: cuts = in previous round but not in latest)
  let latestAppearance: { level: string, roundNumber: number, createdAt: string } | null = null
  let wasCut = false
  let cutLevel: string | null = null
  let cutRoundNumber = 0

  for (const level of LEVEL_ORDER) {
    const levelRounds = roundsByLevel.get(level)
    if (!levelRounds || levelRounds.length === 0) continue

    // Rounds are sorted desc by round_number already
    const latest = levelRounds[0]
    const previous = levelRounds.length > 1 ? levelRounds[1] : null

    // Player is in the latest round at this level → continuing
    if (latest.jersey_numbers.includes(jerseyNumber)) {
      if (!latestAppearance || latest.created_at > latestAppearance.createdAt) {
        wasCut = false
        cutLevel = null
        latestAppearance = {
          level,
          roundNumber: latest.round_number,
          createdAt: latest.created_at,
        }
      }
    }
    // Player was in the previous round but not the latest → just cut
    else if (previous && previous.jersey_numbers.includes(jerseyNumber)) {
      if (!latestAppearance || previous.created_at > latestAppearance.createdAt) {
        wasCut = true
        cutLevel = level
        cutRoundNumber = latest.round_number
        latestAppearance = {
          level,
          roundNumber: previous.round_number,
          createdAt: previous.created_at,
        }
      }
    }
    // Player not in the latest two rounds → was cut earlier, not a current cut at this level
  }

  if (!latestAppearance) {
    // No rounds data for this player
    const label = playerDbStatus === "trying_out" ? "Trying Out"
      : playerDbStatus === "registered" ? "Registered"
      : playerDbStatus.charAt(0).toUpperCase() + playerDbStatus.slice(1).replace(/_/g, " ")
    // Only show "registered" if no rounds exist at all (tryouts haven't started).
    // If rounds exist but player isn't in any, their level likely hasn't started yet — show as continuing.
    const anyRoundsExist = allRounds.length > 0
    return { statusText: label, statusType: anyRoundsExist ? "continuing" : "registered" }
  }

  if (wasCut && cutLevel) {
    // Check if missing from next level
    const levelIdx = LEVEL_ORDER.indexOf(cutLevel)
    const nextLevel = levelIdx < LEVEL_ORDER.length - 1 ? LEVEL_ORDER[levelIdx + 1] : null

    let statusText = `Cut R${cutRoundNumber} (${cutLevel})`
    let statusType: "cut" | "missing" = "cut"

    if (nextLevel) {
      const nextLevelRounds = roundsByLevel.get(nextLevel)
      // Only check for missing if next level has rounds WITH posted jersey numbers
      const nextLevelHasNumbers = nextLevelRounds?.some((r) => r.jersey_numbers.length > 0)
      if (nextLevelHasNumbers) {
        const seenAtNextLevel = nextLevelRounds?.some((r) =>
          r.jersey_numbers.includes(jerseyNumber)
        )
        if (!seenAtNextLevel) {
          statusText += ` \u00b7 Not at ${nextLevel}`
          statusType = "missing"
        }
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

export type FavouritePagePlayer = FavoriteStatus & {
  notes: string | null
  customName: string | null
  playerRawName: string
}

export async function getMyFavouritesPageData(
  associationId: string,
  division: string
): Promise<FavouritePagePlayer[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // 1. All published rounds for this division
  const { data: rounds } = await supabase
    .from("continuation_rounds")
    .select("*")
    .eq("association_id", associationId)
    .eq("division", division)
    .eq("status", "published")
    .order("round_number", { ascending: false })

  const allRounds = rounds ?? []

  // 2. User's favourite annotations joined with players
  const { data: favData } = await supabase
    .from("player_annotations")
    .select("player_id, is_favorite, custom_name, notes, tryout_players!inner(id, name, jersey_number, position, division, status, team_id, association_id, deleted_at, previous_team)")
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

  const result: FavouritePagePlayer[] = []

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
      previous_team: string | null
    }

    const displayName = fav.custom_name || player.name
    const originalName = fav.custom_name && fav.custom_name !== player.name
      ? player.name
      : null

    let statusText: string
    let statusType: FavoriteStatus["statusType"]

    if (player.status === "made_team" && player.team_id) {
      const team = teamsMap.get(player.team_id)
      statusText = `Made ${team?.name ?? "Team"}`
      statusType = "made_team"
    } else {
      const derived = derivePlayerStatus(player.jersey_number, allRounds, player.status)
      statusText = derived.statusText
      statusType = derived.statusType
    }

    result.push({
      playerId: player.id,
      playerName: displayName,
      jerseyNumber: player.jersey_number,
      position: player.position ?? "?",
      statusText,
      statusType,
      division: player.division,
      originalName,
      previousTeam: player.previous_team,
      notes: fav.notes ?? null,
      customName: fav.custom_name ?? null,
      playerRawName: player.name,
    })
  }

  // Sort by jersey number within each status group
  result.sort((a, b) => {
    const jA = parseInt(a.jerseyNumber ?? "999", 10)
    const jB = parseInt(b.jerseyNumber ?? "999", 10)
    return jA - jB
  })

  return result
}
