"use server"

import { createClient } from "@/lib/supabase/server"
import { lockFinalTeam } from "@/app/(app)/continuations/actions"

export type ScrapeBlock = {
  jerseyNumbers: string[]
  ipPlayers: string[]
  label: string
}

export type ScrapeResult = {
  pageType: "continuation" | "final_team" | "everyone_continues" | "no_data"
  teamLevel: string | null
  jerseyNumbers: string[]
  ipPlayers: string[]
  blocks: ScrapeBlock[]
  reportingDate: string | null
  sourceUrl: string
  rawText: string
  error?: string
}

// Extract the userContent div from the full HTML (RAMP platform sites)
function extractUserContent(html: string): string {
  const match = html.match(/class="[^"]*userContent[^"]*"[^>]*>([\s\S]*?)(?:<\/div>\s*<\/div>\s*<\/div>)/i)
  if (match) return match[1]
  return html
}

// Classify the page type from text content
function classifyPage(text: string): ScrapeResult["pageType"] {
  const lower = text.toLowerCase()

  const hasNumbers = /\b\d{1,4}\b/.test(text)
  if (!hasNumbers) return "no_data"

  if (lower.includes("no releases") || (lower.includes("all players") && lower.includes("attend"))) {
    return "everyone_continues"
  }

  if (lower.includes("final team") || lower.includes("final roster")) {
    return "final_team"
  }

  // NGHA-style final team phrasings
  if (/making the\b.*\bteam\b/i.test(lower)) {
    return "final_team"
  }
  if (/selected for\b.*\b(?:u\d{2}|wildcats|team)/i.test(lower)) {
    return "final_team"
  }
  if (/\b(?:congratulations|congratulate)\b.*\bu\d{2}\s*(?:aa|a|bb|b|c)\b/i.test(lower)) {
    return "final_team"
  }

  return "continuation"
}

// Extract team level from text (e.g., "U13AA", "U15 AA", "U18BB")
function extractTeamLevel(text: string): string | null {
  // Match "U13AA" or "U15 AA" but NOT "U15 Continuations" (C followed by word chars)
  const match = text.match(/U\d{2}\s*(AA|BB)\b/i)
  if (match) return match[1].toUpperCase()

  // Single-letter tiers need word boundary on both sides
  const singleMatch = text.match(/U\d{2}\s*(A|B|C)\b(?!\w)/i)
  if (singleMatch) return singleMatch[1].toUpperCase()

  // Try format like "AA skate" or "AA continuation"
  const tierMatch = text.match(/\b(AA|BB)\b\s*(skate|continuation|tryout|roster)/i)
  if (tierMatch) return tierMatch[1].toUpperCase()

  // Single letter before a keyword — but only if NOT preceded by "to " or "to the "
  // which indicates "moving on to A tryouts" rather than labeling this page as A-level
  const singleTierMatch = text.match(/(?<!\bto\s)(?<!\bto the\s)\b(A|B|C)\b\s+(skate|continuation|tryout|roster)/i)
  if (singleTierMatch) return singleTierMatch[1].toUpperCase()

  return null
}

// Extract jersey numbers from HTML content, targeting structured number lists
function extractJerseyNumbers(html: string): { blocks: ScrapeBlock[] } {
  // Method 1: Table cells — sites like U13 use <td> for each number
  const tdRegex = /<td[^>]*>\s*(\d{1,4})\s*(IP)?\s*<\/td>/gi
  let match
  const tableNumbers: string[] = []
  const tableIp: string[] = []

  while ((match = tdRegex.exec(html)) !== null) {
    const num = match[1]
    const isIp = !!match[2]
    if (!tableNumbers.includes(num)) {
      tableNumbers.push(num)
      if (isIp) tableIp.push(num)
    }
  }

  if (tableNumbers.length > 0) {
    return { blocks: [{ jerseyNumbers: tableNumbers, ipPlayers: tableIp, label: "" }] }
  }

  // Method 2: BR-separated numbers — sites like U15 use <br> between numbers
  // Two-step: find all <div>/<p> blocks, then check each for BR-separated numbers
  // Also match blocks that extend to end of content (extractUserContent may strip closing tags)
  const blockTagRegex = /<(?:div|p)[^>]*>([\s\S]*?)(?:<\/(?:div|p)>|$)/gi
  const blocks: ScrapeBlock[] = []

  while ((match = blockTagRegex.exec(html)) !== null) {
    const blockContent = match[1]

    // Check if this block has BR-separated numbers (at least 2 numbers with <br> between)
    const brNumbers = blockContent.match(/\d{1,4}\s*(?:IP)?\s*(?:&nbsp;)?\s*<br/gi)
    if (!brNumbers || brNumbers.length < 2) continue

    const blockNumbers: string[] = []
    const blockIp: string[] = []

    // Extract label from <strong> or <b> tag in the block
    let label = ""
    const labelMatch = blockContent.match(/<(?:strong|b|h[23])[^>]*>([\s\S]*?)<\/(?:strong|b|h[23])>/i)
    if (labelMatch) {
      label = labelMatch[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim()
    }

    // Extract all numbers from the block (skip numbers inside tags like labels)
    // Split by <br> and process each segment
    const segments = blockContent.split(/<br\s*\/?>/i)
    for (const seg of segments) {
      // Strip HTML tags from this segment
      const clean = seg.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim()
      // Match a standalone jersey number (1-4 digits optionally followed by IP)
      const numMatch = clean.match(/^(\d{1,4})\s*(IP)?$/i)
      if (numMatch) {
        const num = numMatch[1]
        const isIp = !!numMatch[2]
        if (!blockNumbers.includes(num)) {
          blockNumbers.push(num)
          if (isIp) blockIp.push(num)
        }
      }
    }

    if (blockNumbers.length > 0) {
      blocks.push({ jerseyNumbers: blockNumbers, ipPlayers: blockIp, label })
    }
  }

  if (blocks.length > 0) return { blocks }

  // Method 3: P-tag separated numbers — sites like U18 use <p>168</p> per number
  const pNumbers: string[] = []
  const pIp: string[] = []
  const pRegex = /<p[^>]*>\s*(\d{1,4})\s*(?:&nbsp;)?\s*(IP)?\s*<\/p>/gi
  while ((match = pRegex.exec(html)) !== null) {
    const num = match[1]
    const isIp = !!match[2]
    if (!pNumbers.includes(num)) {
      pNumbers.push(num)
      if (isIp) pIp.push(num)
    }
  }

  if (pNumbers.length > 0) {
    return { blocks: [{ jerseyNumbers: pNumbers, ipPlayers: pIp, label: "" }] }
  }

  return { blocks: [] }
}

// Extract reporting date from text
function extractReportingDate(text: string): string | null {
  const dateMatch = text.match(/(?:report|attend)\s+(?:on\s+)?(?:\w+day\s+)?(\w+\s+\d{1,2}(?:st|nd|rd|th)?)/i)
  if (dateMatch) return dateMatch[1]
  return null
}

export async function scrapeContinuationsPage(
  associationId: string,
  division: string
): Promise<ScrapeResult> {
  const supabase = await createClient()

  // Get the configured URL
  const { data: urlConfig } = await supabase
    .from("continuations_urls")
    .select("url")
    .eq("association_id", associationId)
    .eq("division", division)
    .single()

  if (!urlConfig) {
    return {
      pageType: "no_data",
      teamLevel: null,
      jerseyNumbers: [],
      ipPlayers: [],
      blocks: [],
      reportingDate: null,
      sourceUrl: "",
      rawText: "",
      error: "No URL configured for this division",
    }
  }

  try {
    const response = await fetch(urlConfig.url, {
      headers: { "User-Agent": "TrackMaster/1.0" },
    })

    if (!response.ok) {
      return {
        pageType: "no_data",
        teamLevel: null,
        jerseyNumbers: [],
        ipPlayers: [],
        blocks: [],
        reportingDate: null,
        sourceUrl: urlConfig.url,
        rawText: "",
        error: `Failed to fetch page: ${response.status} ${response.statusText}`,
      }
    }

    const html = await response.text()

    // Extract the user content area (avoids footer/header/address noise)
    const contentHtml = extractUserContent(html)

    // Strip HTML to plain text for classification and date extraction
    const plainText = contentHtml
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim()

    const pageType = classifyPage(plainText)
    const teamLevel = extractTeamLevel(plainText)
    // Extract numbers from HTML structure (tables or br-separated divs)
    const { blocks } = extractJerseyNumbers(contentHtml)
    const reportingDate = extractReportingDate(plainText)

    // Union all block jersey numbers and IP players for backwards compatibility
    const allJerseys: string[] = []
    const allIp: string[] = []
    for (const block of blocks) {
      for (const num of block.jerseyNumbers) {
        if (!allJerseys.includes(num)) allJerseys.push(num)
      }
      for (const ip of block.ipPlayers) {
        if (!allIp.includes(ip)) allIp.push(ip)
      }
    }

    return {
      pageType,
      teamLevel,
      jerseyNumbers: allJerseys,
      ipPlayers: allIp,
      blocks,
      reportingDate,
      sourceUrl: urlConfig.url,
      rawText: plainText.substring(0, 2000),
    }
  } catch (err) {
    return {
      pageType: "no_data",
      teamLevel: null,
      jerseyNumbers: [],
      ipPlayers: [],
      blocks: [],
      reportingDate: null,
      sourceUrl: urlConfig.url,
      rawText: "",
      error: `Fetch error: ${err instanceof Error ? err.message : "Unknown error"}`,
    }
  }
}

export async function getNextRoundNumber(
  associationId: string,
  division: string,
  teamLevel: string
): Promise<number> {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from("continuation_rounds")
    .select("round_number")
    .eq("association_id", associationId)
    .eq("division", division)
    .eq("team_level", teamLevel)
    .order("round_number", { ascending: false })
    .limit(1)

  return (existing?.[0]?.round_number ?? 0) + 1
}

export type SessionInput = {
  session_number: number
  jersey_numbers: string[]
  label: string
}

export async function saveDraftRound(
  associationId: string,
  division: string,
  scrapeResult: ScrapeResult,
  roundNumberOverride?: number,
  sessionInfo?: string,
  isFinalTeamOverride?: boolean,
  sessionInputs?: SessionInput[]
): Promise<{ draftId: string, error?: string }> {
  const supabase = await createClient()

  const teamLevel = scrapeResult.teamLevel ?? "AA"

  const nextRound = roundNumberOverride ?? await getNextRoundNumber(associationId, division, teamLevel)

  let jerseyNumbers = scrapeResult.jerseyNumbers
  let ipPlayers = scrapeResult.ipPlayers

  // For "everyone_continues", copy from latest published round
  if (scrapeResult.pageType === "everyone_continues") {
    const { data: prevRound } = await supabase
      .from("continuation_rounds")
      .select("jersey_numbers, ip_players")
      .eq("association_id", associationId)
      .eq("division", division)
      .eq("team_level", teamLevel)
      .eq("status", "published")
      .order("round_number", { ascending: false })
      .limit(1)
      .single()

    if (prevRound) {
      jerseyNumbers = prevRound.jersey_numbers
      ipPlayers = prevRound.ip_players
    }
  }

  // Build sessions JSONB
  let sessions: Record<string, unknown>[]
  if (sessionInputs && sessionInputs.length > 0) {
    // Multi-session mode: build structured sessions from admin input
    // Override jersey_numbers with union of all session jersey numbers
    const allNums = new Set<string>()
    for (const s of sessionInputs) {
      for (const n of s.jersey_numbers) allNums.add(n)
    }
    jerseyNumbers = Array.from(allNums)

    sessions = sessionInputs.map((s) => ({
      session_number: s.session_number,
      date: scrapeResult.reportingDate ?? "",
      start_time: "",
      end_time: "",
      jersey_numbers: s.jersey_numbers,
      label: s.label || `Session ${s.session_number}`,
    }))
  } else {
    // Single-session mode: build from reporting date (existing behavior)
    sessions = scrapeResult.reportingDate
      ? [{ date: scrapeResult.reportingDate }]
      : []
  }

  const { data, error } = await supabase
    .from("continuation_rounds")
    .insert({
      association_id: associationId,
      division,
      team_level: teamLevel,
      round_number: nextRound,
      jersey_numbers: jerseyNumbers,
      ip_players: ipPlayers,
      sessions,
      status: "draft",
      source_url: scrapeResult.sourceUrl,
      scraped_at: new Date().toISOString(),
      is_final_team: isFinalTeamOverride ?? (scrapeResult.pageType === "final_team"),
      session_info: sessionInfo || null,
    })
    .select("id")
    .single()

  if (error) return { draftId: "", error: error.message }
  return { draftId: data.id }
}

export async function confirmDraft(roundId: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from("continuation_rounds")
    .update({ status: "published" })
    .eq("id", roundId)
    .eq("status", "draft")

  if (error) return { error: error.message }

  // After successful publish, check if this is a final team round
  const { data: round } = await supabase
    .from("continuation_rounds")
    .select("is_final_team")
    .eq("id", roundId)
    .single()

  if (round?.is_final_team) {
    const lockResult = await lockFinalTeam(roundId)
    if (lockResult.error) return { error: lockResult.error }
  }

  return {}
}

export async function discardDraft(roundId: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from("continuation_rounds")
    .delete()
    .eq("id", roundId)
    .eq("status", "draft")

  if (error) return { error: error.message }
  return {}
}

export async function getDraftRounds(
  associationId: string,
  division: string
) {
  const supabase = await createClient()

  const { data } = await supabase
    .from("continuation_rounds")
    .select("*")
    .eq("association_id", associationId)
    .eq("division", division)
    .eq("status", "draft")
    .order("created_at", { ascending: false })

  return data ?? []
}

export async function getContinuationsUrl(
  associationId: string,
  division: string
): Promise<{ url: string | null }> {
  const supabase = await createClient()

  const { data } = await supabase
    .from("continuations_urls")
    .select("url")
    .eq("association_id", associationId)
    .eq("division", division)
    .single()

  return { url: data?.url ?? null }
}
