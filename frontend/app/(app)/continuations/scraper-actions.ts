"use server"

import { createClient } from "@/lib/supabase/server"
import { lockFinalTeam } from "@/app/(app)/continuations/actions"

export type ScrapeResult = {
  pageType: "continuation" | "final_team" | "everyone_continues" | "no_data"
  teamLevel: string | null
  jerseyNumbers: string[]
  ipPlayers: string[]
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
function extractJerseyNumbers(html: string): { jerseyNumbers: string[], ipPlayers: string[] } {
  const jerseyNumbers: string[] = []
  const ipPlayers: string[] = []

  // Method 1: Table cells — sites like U13 use <td> for each number
  const tdRegex = /<td[^>]*>\s*(\d{1,4})\s*(IP)?\s*<\/td>/gi
  let match
  let foundInTable = false

  while ((match = tdRegex.exec(html)) !== null) {
    const num = match[1]
    const isIp = !!match[2]
    if (!jerseyNumbers.includes(num)) {
      jerseyNumbers.push(num)
      if (isIp) ipPlayers.push(num)
      foundInTable = true
    }
  }

  if (foundInTable) return { jerseyNumbers, ipPlayers }

  // Method 2: BR-separated numbers — sites like U15 use <br> between numbers
  // Find a block (<div> or <p>) that has many number<br> sequences
  const brBlockMatch = html.match(/<(?:div|p)[^>]*>((?:\s*\d{1,4}\s*(?:IP)?\s*(?:&nbsp;)?\s*<br\s*\/?>?\s*)+\d{1,4}\s*(?:IP)?(?:\s*(?:&nbsp;)?)*)\s*<\/(?:div|p)>/i)
  if (brBlockMatch) {
    const block = brBlockMatch[1]
    const numRegex = /(\d{1,4})\s*(IP)?/g

    while ((match = numRegex.exec(block)) !== null) {
      const num = match[1]
      const isIp = !!match[2]
      if (!jerseyNumbers.includes(num)) {
        jerseyNumbers.push(num)
        if (isIp) ipPlayers.push(num)
      }
    }

    if (jerseyNumbers.length > 0) return { jerseyNumbers, ipPlayers }
  }

  // Method 3: P-tag separated numbers — sites like U18 use <p>168</p> per number
  const pRegex = /<p[^>]*>\s*(\d{1,4})\s*(?:&nbsp;)?\s*(IP)?\s*<\/p>/gi
  while ((match = pRegex.exec(html)) !== null) {
    const num = match[1]
    const isIp = !!match[2]
    if (!jerseyNumbers.includes(num)) {
      jerseyNumbers.push(num)
      if (isIp) ipPlayers.push(num)
    }
  }

  return { jerseyNumbers, ipPlayers }
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
    const { jerseyNumbers, ipPlayers } = extractJerseyNumbers(contentHtml)
    const reportingDate = extractReportingDate(plainText)

    return {
      pageType,
      teamLevel,
      jerseyNumbers,
      ipPlayers,
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

export async function saveDraftRound(
  associationId: string,
  division: string,
  scrapeResult: ScrapeResult,
  roundNumberOverride?: number,
  sessionInfo?: string,
  isFinalTeamOverride?: boolean
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

  // Build sessions from reporting date
  const sessions = scrapeResult.reportingDate
    ? [{ date: scrapeResult.reportingDate }]
    : []

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
