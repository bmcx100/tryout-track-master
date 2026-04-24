"use server"

import { createClient } from "@/lib/supabase/server"

const LEVEL_ORDER = ["AA", "A", "BB", "B", "C"]

export type HeroPlayerRow = {
  jerseyNumber: string
  name: string
  position: string
  isFavorite: boolean
  previousTeam: string | null
  playerId: string | null
}

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
  rosterPlayers?: HeroPlayerRow[]
  cutPlayers?: HeroPlayerRow[]
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
  roundType: "round1" | "regular" | "final" | null
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

    // Populate player rows for final team cards
    if (latest.is_final_team) {
      const card = heroCards[heroCards.length - 1]
      // Fetch all players for this division
      const { data: divPlayers } = await supabase
        .from("tryout_players")
        .select("id, jersey_number, name, position, previous_team")
        .eq("association_id", associationId)
        .eq("division", division)
        .is("deleted_at", null)

      // Fetch user's annotations for favorites
      const { data: userAnnotations } = await supabase
        .from("player_annotations")
        .select("player_id, is_favorite, custom_name")
        .eq("user_id", user.id)

      const annMap = new Map(
        (userAnnotations ?? []).map((a) => [a.player_id, a])
      )

      const POSITION_ORDER: Record<string, number> = { F: 0, D: 1, G: 2, "?": 3 }
      const sortPlayers = (rows: HeroPlayerRow[]) =>
        rows.sort((a, b) => {
          const posA = POSITION_ORDER[a.position] ?? 3
          const posB = POSITION_ORDER[b.position] ?? 3
          if (posA !== posB) return posA - posB
          return parseInt(a.jerseyNumber, 10) - parseInt(b.jerseyNumber, 10)
        })

      const finalJerseys = new Set(latest.jersey_numbers)
      const playersByJersey = new Map(
        (divPlayers ?? []).map((p) => [p.jersey_number, p])
      )

      // Roster: players on the final round
      const rosterPlayers: HeroPlayerRow[] = []
      for (const jn of latest.jersey_numbers) {
        const p = playersByJersey.get(jn)
        const ann = p ? annMap.get(p.id) : null
        rosterPlayers.push({
          jerseyNumber: jn,
          name: ann?.custom_name || p?.name || "Unknown",
          position: p?.position || "?",
          isFavorite: ann?.is_favorite ?? false,
          previousTeam: p?.previous_team ?? null,
          playerId: p?.id ?? null,
        })
      }

      // Cuts: players on the previous round but NOT on the final round
      const cutPlayers: HeroPlayerRow[] = []
      if (previous) {
        for (const jn of previous.jersey_numbers) {
          if (finalJerseys.has(jn)) continue
          const p = playersByJersey.get(jn)
          const ann = p ? annMap.get(p.id) : null
          cutPlayers.push({
            jerseyNumber: jn,
            name: ann?.custom_name || p?.name || "Unknown",
            position: p?.position || "?",
            isFavorite: ann?.is_favorite ?? false,
            previousTeam: p?.previous_team ?? null,
            playerId: p?.id ?? null,
          })
        }
      }

      card.rosterPlayers = sortPlayers(rosterPlayers)
      card.cutPlayers = sortPlayers(cutPlayers)
    }
  }

  // Sort: finalized first, then by LEVEL_ORDER
  heroCards.sort((a, b) => {
    if (a.isFinalTeam !== b.isFinalTeam) return a.isFinalTeam ? -1 : 1
    return LEVEL_ORDER.indexOf(a.teamLevel) - LEVEL_ORDER.indexOf(b.teamLevel)
  })

  // --- Build favorite statuses ---
  const favByJersey = new Map<string, FavPlayerInput>()
  for (const fav of favData ?? []) {
    const player = fav.tryout_players as unknown as {
      id: string
      name: string
      jersey_number: string
      position: string
      division: string
      status: string
      team_id: string | null
      previous_team: string | null
    }
    const displayName = fav.custom_name || player.name
    const originalName = fav.custom_name && fav.custom_name !== player.name
      ? player.name
      : null
    favByJersey.set(player.jersey_number, {
      id: player.id,
      jerseyNumber: player.jersey_number,
      position: player.position ?? "?",
      division: player.division,
      dbStatus: player.status,
      teamId: player.team_id,
      previousTeam: player.previous_team,
      displayName,
      originalName,
    })
  }

  const favoriteStatuses = deriveFavouriteStatuses(
    allRounds, favJerseyNumbers, favByJersey, teamsMap
  )

  return { heroCards, favoriteStatuses }
}

type FavPlayerInput = {
  id: string
  jerseyNumber: string
  position: string
  division: string
  dbStatus: string
  teamId: string | null
  previousTeam: string | null
  displayName: string
  originalName: string | null
}

function deriveFavouriteStatuses(
  allRounds: { team_level: string; round_number: number; jersey_numbers: string[]; is_final_team: boolean; created_at: string }[],
  favouriteJerseyNumbers: Set<string>,
  favouritesByJersey: Map<string, FavPlayerInput>,
  teamsMap: Map<string, { id: string; name: string }>
): FavoriteStatus[] {
  const result: FavoriteStatus[] = []
  const handledJerseys = new Set<string>()

  // 1. Handle made_team DB overrides first
  for (const [jersey, player] of favouritesByJersey) {
    if (player.dbStatus === "made_team") {
      const team = player.teamId ? teamsMap.get(player.teamId) : null
      result.push({
        playerId: player.id,
        playerName: player.displayName,
        jerseyNumber: player.jerseyNumber,
        position: player.position,
        statusText: team ? `Made ${team.name}` : "Made Team",
        statusType: "made_team",
        division: player.division,
        originalName: player.originalName,
        previousTeam: player.previousTeam,
        roundType: "final",
      })
      handledJerseys.add(jersey)
    }
  }

  // 2. Group rounds by level
  const roundsByLevel = new Map<string, typeof allRounds>()
  for (const r of allRounds) {
    const existing = roundsByLevel.get(r.team_level) ?? []
    existing.push(r)
    roundsByLevel.set(r.team_level, existing)
  }

  if (allRounds.length === 0) {
    // No rounds — all remaining favourites are "registered"
    for (const [jersey, player] of favouritesByJersey) {
      if (handledJerseys.has(jersey)) continue
      result.push({
        playerId: player.id,
        playerName: player.displayName,
        jerseyNumber: player.jerseyNumber,
        position: player.position,
        statusText: "Registered",
        statusType: "registered",
        division: player.division,
        originalName: player.originalName,
        previousTeam: player.previousTeam,
        roundType: null,
      })
    }
    return sortByJersey(result)
  }

  // 3. Find active level(s)
  const latestDateByLevel = new Map<string, string>()
  for (const [level, rounds] of roundsByLevel) {
    latestDateByLevel.set(level, rounds[0].created_at)
  }

  let primaryLevel = ""
  let primaryDate = ""
  for (const [level, date] of latestDateByLevel) {
    if (date > primaryDate) {
      primaryDate = date
      primaryLevel = level
    }
  }

  const activeLevels = [primaryLevel]

  // B/C combo: both active if latest rounds are on the same day
  if (primaryLevel === "B" || primaryLevel === "C") {
    const otherLevel = primaryLevel === "B" ? "C" : "B"
    const otherDate = latestDateByLevel.get(otherLevel)
    if (otherDate) {
      const primaryDay = primaryDate.slice(0, 10)
      const otherDay = otherDate.slice(0, 10)
      if (primaryDay === otherDay) {
        activeLevels.push(otherLevel)
      }
    }
  }

  // 4. For each active level, categorize players by round type
  for (const level of activeLevels) {
    const levelRounds = roundsByLevel.get(level)
    if (!levelRounds || levelRounds.length === 0) continue

    const latest = levelRounds[0]
    const previous = levelRounds.length > 1 ? levelRounds[1] : null

    let roundType: "round1" | "regular" | "final"
    if (levelRounds.length === 1) {
      roundType = "round1"
    } else if (latest.is_final_team) {
      roundType = "final"
    } else {
      roundType = "regular"
    }

    const pushIfFav = (
      jn: string,
      statusText: string,
      statusType: FavoriteStatus["statusType"],
      rt: typeof roundType
    ) => {
      if (!favouriteJerseyNumbers.has(jn) || handledJerseys.has(jn)) return
      const player = favouritesByJersey.get(jn)
      if (!player) return
      result.push({
        playerId: player.id,
        playerName: player.displayName,
        jerseyNumber: player.jerseyNumber,
        position: player.position,
        statusText,
        statusType,
        division: player.division,
        originalName: player.originalName,
        previousTeam: player.previousTeam,
        roundType: rt,
      })
      handledJerseys.add(jn)
    }

    if (roundType === "round1") {
      // Registered: on the Round 1 list
      for (const jn of latest.jersey_numbers) {
        pushIfFav(jn, "Registered", "registered", "round1")
      }

      // Missing: cut from the level above and not on Round 1 list
      const round1Set = new Set<string>(latest.jersey_numbers)
      const levelIdx = LEVEL_ORDER.indexOf(level)
      if (levelIdx > 0) {
        const levelAbove = LEVEL_ORDER[levelIdx - 1]
        const aboveRounds = roundsByLevel.get(levelAbove)
        if (aboveRounds && aboveRounds.length > 0) {
          const latestAbove = aboveRounds[0]
          const allAboveJerseys = new Set<string>()
          for (const r of aboveRounds) {
            for (const jn of r.jersey_numbers) allAboveJerseys.add(jn)
          }
          const stillAtAbove = new Set<string>(latestAbove.jersey_numbers)
          for (const jn of allAboveJerseys) {
            if (stillAtAbove.has(jn)) continue // still at above level
            if (round1Set.has(jn)) continue // appeared at this level
            pushIfFav(jn, `Not at ${level}`, "missing", "round1")
          }
        }
      }
    } else if (roundType === "regular") {
      // Continuing: on latest round
      const latestSet = new Set<string>(latest.jersey_numbers)
      for (const jn of latest.jersey_numbers) {
        pushIfFav(jn, `Continuing R${latest.round_number} (${level})`, "continuing", "regular")
      }

      // Cut: on previous but not on latest
      if (previous) {
        for (const jn of previous.jersey_numbers) {
          if (latestSet.has(jn)) continue
          pushIfFav(jn, `Cut R${latest.round_number} (${level})`, "cut", "regular")
        }
      }
    } else {
      // Final team
      const finalSet = new Set<string>(latest.jersey_numbers)
      for (const jn of latest.jersey_numbers) {
        pushIfFav(jn, "Made Team", "made_team", "final")
      }

      // Final Cut: on previous but not on final
      if (previous) {
        for (const jn of previous.jersey_numbers) {
          if (finalSet.has(jn)) continue
          pushIfFav(jn, "Final Cut", "cut", "final")
        }
      }
    }
  }

  return sortByJersey(result)
}

function sortByJersey(statuses: FavoriteStatus[]): FavoriteStatus[] {
  return statuses.sort((a, b) => {
    const jA = parseInt(a.jerseyNumber ?? "999", 10)
    const jB = parseInt(b.jerseyNumber ?? "999", 10)
    return jA - jB
  })
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

  // Build favourite lookup maps
  const favJerseyNumbers = new Set<string>()
  const favByJersey = new Map<string, FavPlayerInput>()
  const annotationsByJersey = new Map<string, { notes: string | null; customName: string | null; playerRawName: string }>()

  for (const fav of favData ?? []) {
    const player = fav.tryout_players as unknown as {
      id: string
      name: string
      jersey_number: string
      position: string
      division: string
      status: string
      team_id: string | null
      previous_team: string | null
    }
    const displayName = fav.custom_name || player.name
    const originalName = fav.custom_name && fav.custom_name !== player.name
      ? player.name
      : null
    favJerseyNumbers.add(player.jersey_number)
    favByJersey.set(player.jersey_number, {
      id: player.id,
      jerseyNumber: player.jersey_number,
      position: player.position ?? "?",
      division: player.division,
      dbStatus: player.status,
      teamId: player.team_id,
      previousTeam: player.previous_team,
      displayName,
      originalName,
    })
    annotationsByJersey.set(player.jersey_number, {
      notes: fav.notes ?? null,
      customName: fav.custom_name ?? null,
      playerRawName: player.name,
    })
  }

  const statuses = deriveFavouriteStatuses(
    allRounds, favJerseyNumbers, favByJersey, teamsMap
  )

  const result: FavouritePagePlayer[] = statuses.map((s) => {
    const ann = annotationsByJersey.get(s.jerseyNumber)
    return {
      ...s,
      notes: ann?.notes ?? null,
      customName: ann?.customName ?? null,
      playerRawName: ann?.playerRawName ?? s.playerName,
    }
  })

  return result
}
