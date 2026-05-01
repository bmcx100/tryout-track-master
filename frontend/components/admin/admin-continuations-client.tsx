"use client"
// Admin Continuations Management
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ExternalLink, Loader2, TriangleAlert, ChevronDown, Trash2, CheckCircle, Undo2 } from "lucide-react"
import Link from "next/link"
import {
  scrapeContinuationsPage,
  saveDraftRound,
  confirmDraft,
  discardDraft,
  getNextRoundNumber,
  type ScrapeResult,
  type SessionInput,
} from "@/app/(app)/continuations/scraper-actions"
import {
  updateRound,
  deleteRound,
  createEmptyRound,
  getRevertablePlayerCount,
  completeLevel,
  uncompleteLevel,
} from "@/app/(app)/admin/continuations/actions"
import type { ContinuationRound } from "@/types"

type AdminContinuationsClientProps = {
  associationId: string
  division: string
  sourceUrl: string | null
  existingDrafts: ContinuationRound[]
  publishedRounds: ContinuationRound[]
  defaultTeamLevel: string
  completedLevels: { team_level: string, completed_at: string | null }[]
}

const PAGE_TYPE_LABELS: Record<string, string> = {
  continuation: "Continuation",
  final_team: "Final Team",
  everyone_continues: "Everyone Continues",
  no_data: "No Data",
}

const TEAM_LEVELS = ["AA", "A", "BB", "B", "C"]
const LEVEL_ORDER = ["AA", "A", "BB", "B", "C"]
const TEAM_SIZE_MIN = 14
const TEAM_SIZE_MAX = 19

function parseJerseyNumbers(text: string): string[] {
  const tokens = text.split(/[\n,]/)
  const seen = new Set<string>()
  const result: string[] = []
  for (const token of tokens) {
    const trimmed = token.trim()
    if (/^\d{1,4}$/.test(trimmed) && !seen.has(trimmed)) {
      seen.add(trimmed)
      result.push(trimmed)
    }
  }
  return result
}

export function AdminContinuationsClient({
  associationId,
  division,
  sourceUrl,
  existingDrafts,
  publishedRounds: initialPublished,
  defaultTeamLevel,
  completedLevels: initialCompletedLevels,
}: AdminContinuationsClientProps) {
  const router = useRouter()

  // View toggle state
  const [activeView, setActiveView] = useState<"current" | "completed">("current")

  // Scrape state
  const [scraping, setScraping] = useState(false)
  const [result, setResult] = useState<ScrapeResult | null>(null)
  const [teamLevelOverride, setTeamLevelOverride] = useState<string | null>(null)
  const [detectedTeamLevel, setDetectedTeamLevel] = useState<string | null>(null)
  const [draftId, setDraftId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [drafts, setDrafts] = useState(existingDrafts)
  const [roundNumber, setRoundNumber] = useState<number | null>(null)
  const [sessionInfo, setSessionInfo] = useState("")
  const [isFinalTeam, setIsFinalTeam] = useState(false)
  const [estimatedPlayers, setEstimatedPlayers] = useState<string>("")
  const [estimatedPlayersF, setEstimatedPlayersF] = useState<string>("")
  const [estimatedPlayersD, setEstimatedPlayersD] = useState<string>("")
  const [estimatedPlayersG, setEstimatedPlayersG] = useState<string>("")
  const [scrapeEstTotalManual, setScrapeEstTotalManual] = useState(false)
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [manualText, setManualText] = useState("")
  const [showSizeWarning, setShowSizeWarning] = useState(false)
  const [scrapeJerseyExpanded, setScrapeJerseyExpanded] = useState(false)
  const [multiSession, setMultiSession] = useState(false)
  const [sessionTexts, setSessionTexts] = useState<string[]>(["", ""])
  const [sessionLabels, setSessionLabels] = useState<string[]>(["", ""])
  const hasScrapeStarted = useRef(false)

  // Published rounds state — sync when server props change (after router.refresh)
  const [publishedRounds, setPublishedRounds] = useState(initialPublished)
  useEffect(() => { setPublishedRounds(initialPublished) }, [initialPublished])
  const [expandedRoundId, setExpandedRoundId] = useState<string | null>(null)

  // Completed levels state
  const [completedLevels, setCompletedLevels] = useState(initialCompletedLevels)
  useEffect(() => { setCompletedLevels(initialCompletedLevels) }, [initialCompletedLevels])
  const completedSet = new Set(completedLevels.map((cl) => cl.team_level))

  // Complete/uncomplete state
  const [completeTarget, setCompleteTarget] = useState<{ level: string } | null>(null)
  const [completing, setCompleting] = useState(false)
  const [uncompleteTarget, setUncompleteTarget] = useState<{ level: string } | null>(null)
  const [uncompleting, setUncompleting] = useState(false)
  const [expandedCompletedLevel, setExpandedCompletedLevel] = useState<string | null>(null)

  // Edit state for expanded round
  const [editJerseyModal, setEditJerseyModal] = useState<string | null>(null)
  const [editJerseyText, setEditJerseyText] = useState("")
  const [roundEdits, setRoundEdits] = useState<Record<string, {
    session_info?: string
    is_final_team?: boolean
    estimated_players?: string
    estimated_players_f?: string
    estimated_players_d?: string
    estimated_players_g?: string
    total_manually_edited?: boolean
    jersey_numbers?: string[]
    is_multi_session?: boolean
    session_texts?: string[]
    session_labels?: string[]
  }>>({})
  const [saving, setSaving] = useState<string | null>(null)

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<ContinuationRound | null>(null)
  const [deleteRevertCount, setDeleteRevertCount] = useState(0)
  const [deleting, setDeleting] = useState(false)

  // Create empty round state
  const [showCreateEmpty, setShowCreateEmpty] = useState(false)
  const [emptyTeamLevel, setEmptyTeamLevel] = useState(defaultTeamLevel)
  const [emptyRoundNumber, setEmptyRoundNumber] = useState<number | null>(null)
  const [emptySessionInfo, setEmptySessionInfo] = useState("")
  const [creating, setCreating] = useState(false)

  const sessionParsed = sessionTexts.map((t) => parseJerseyNumbers(t))
  const multiSessionTotal = new Set(sessionParsed.flatMap((s) => s)).size

  const playerCount = multiSession && result
    ? multiSessionTotal
    : (result?.jerseyNumbers.length ?? 0)
  const isUnusualSize = playerCount < TEAM_SIZE_MIN || playerCount > TEAM_SIZE_MAX

  // Auto-scrape on mount (same as current behavior)
  const handleScrape = async () => {
    setError(null)
    setResult(null)
    setDraftId(null)
    setScraping(true)

    try {
      const scrapeResult = await scrapeContinuationsPage(associationId, division)

      if (scrapeResult.error) {
        setError(scrapeResult.error)
      }

      setResult(scrapeResult)
      // Default to most recent published round's team level, not scraper's
      setTeamLevelOverride(defaultTeamLevel)
      setDetectedTeamLevel(scrapeResult.teamLevel)
      setIsFinalTeam(false)
      setEstimatedPlayers("")
      setEstimatedPlayersF("")
      setEstimatedPlayersD("")
      setEstimatedPlayersG("")
      setScrapeEstTotalManual(false)

      // Populate session textareas from blocks when multi-session is on
      if (multiSession) {
        const MIN_BLOCK_SIZE = 12
        const significantBlocks = scrapeResult.blocks.filter(
          (b) => b.jerseyNumbers.length >= MIN_BLOCK_SIZE
        )
        if (significantBlocks.length >= 2) {
          setSessionTexts(significantBlocks.map((b) => b.jerseyNumbers.join("\n")))
          setSessionLabels(significantBlocks.map((b) => b.label || ""))
        } else {
          setSessionTexts([scrapeResult.jerseyNumbers.join("\n"), ""])
          setSessionLabels(["", ""])
        }
      }

      const nextRound = await getNextRoundNumber(associationId, division, defaultTeamLevel)
      setRoundNumber(nextRound)
      setScraping(false)
    } catch {
      setError("An unexpected error occurred")
      setScraping(false)
    }
  }

  useEffect(() => {
    if (sourceUrl && !hasScrapeStarted.current && existingDrafts.length === 0) {
      hasScrapeStarted.current = true
      handleScrape()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleConfirmClick = () => {
    if (!result) return
    if (isFinalTeam && isUnusualSize) {
      setShowSizeWarning(true)
      return
    }
    doConfirm()
  }

  const doConfirm = async () => {
    if (!result) return
    setShowSizeWarning(false)
    setConfirming(true)

    try {
      const resultToSave = { ...result, teamLevel: teamLevelOverride ?? result.teamLevel }

      // Build session inputs for multi-session mode
      let sessionInputsToSave: SessionInput[] | undefined
      if (multiSession) {
        sessionInputsToSave = sessionTexts
          .map((text, i) => ({
            session_number: i + 1,
            jersey_numbers: parseJerseyNumbers(text),
            label: sessionLabels[i] || `Session ${i + 1}`,
          }))
          .filter((s) => s.jersey_numbers.length > 0)

        // Override the result's jersey numbers with the union of all sessions
        const allNums = new Set<string>()
        for (const s of sessionInputsToSave) {
          for (const n of s.jersey_numbers) allNums.add(n)
        }
        resultToSave.jerseyNumbers = Array.from(allNums)
      }

      const { draftId: newDraftId, error: saveErr } = await saveDraftRound(
        associationId,
        division,
        resultToSave,
        roundNumber ?? undefined,
        sessionInfo || undefined,
        isFinalTeam,
        sessionInputsToSave
      )

      if (saveErr || !newDraftId) {
        setError(saveErr ?? "Failed to save draft")
        setConfirming(false)
        return
      }

      const { error: confirmErr } = await confirmDraft(newDraftId)
      if (confirmErr) {
        setError(confirmErr)
        setConfirming(false)
        return
      }

      // If estimated players was set, update the confirmed round
      const ep = parseInt(estimatedPlayers, 10)
      const epF = parseInt(estimatedPlayersF, 10)
      const epD = parseInt(estimatedPlayersD, 10)
      const epG = parseInt(estimatedPlayersG, 10)
      const hasEstimates = (!isNaN(ep) && ep > 0) || (!isNaN(epF) && epF > 0) || (!isNaN(epD) && epD > 0) || (!isNaN(epG) && epG > 0)
      if (hasEstimates) {
        await updateRound(newDraftId, {
          estimated_players: !isNaN(ep) && ep > 0 ? ep : null,
          estimated_players_f: !isNaN(epF) && epF > 0 ? epF : null,
          estimated_players_d: !isNaN(epD) && epD > 0 ? epD : null,
          estimated_players_g: !isNaN(epG) && epG > 0 ? epG : null,
        })
      }

      setDraftId(newDraftId)
      setResult(null)
      router.refresh()
    } catch {
      setError("Failed to confirm")
      setConfirming(false)
    }
  }

  const handleApplyManual = () => {
    if (!result) return
    const parsed = parseJerseyNumbers(manualText)
    const parsedSet = new Set(parsed)

    if (multiSession) {
      const claimed = new Set<string>()
      const newTexts = sessionTexts.map((text) => {
        const existing = parseJerseyNumbers(text).filter((n) => parsedSet.has(n))
        for (const n of existing) claimed.add(n)
        return existing.join("\n")
      })
      const unclaimed = parsed.filter((n) => !claimed.has(n))
      if (unclaimed.length > 0) {
        const session1 = parseJerseyNumbers(newTexts[0])
        newTexts[0] = [...session1, ...unclaimed].join("\n")
      }
      setSessionTexts(newTexts)
    }

    setResult({
      ...result,
      jerseyNumbers: parsed,
      ipPlayers: [],
      pageType: result.pageType === "no_data" ? "continuation" : result.pageType,
    })
    setShowManualEntry(false)
    setManualText("")
  }

  const openManualEntry = () => {
    if (result && result.jerseyNumbers.length > 0) {
      setManualText(result.jerseyNumbers.join("\n"))
    } else {
      setManualText("")
    }
    setShowManualEntry(true)
  }

  const handleDiscard = () => {
    setResult(null)
    setDraftId(null)
    setTeamLevelOverride(null)
    setDetectedTeamLevel(null)
    setRoundNumber(null)
    setSessionInfo("")
    setIsFinalTeam(false)
    setEstimatedPlayers("")
    setEstimatedPlayersF("")
    setEstimatedPlayersD("")
    setEstimatedPlayersG("")
    setScrapeEstTotalManual(false)
    setError(null)
    setShowManualEntry(false)
    setShowSizeWarning(false)
    setManualText("")
    setScrapeJerseyExpanded(false)
    setSessionTexts(["", ""])
  }

  const handleDiscardExisting = async (id: string) => {
    const { error: discardErr } = await discardDraft(id)
    if (discardErr) {
      setError(discardErr)
      return
    }
    setDrafts(drafts.filter((d) => d.id !== id))
  }

  const handleConfirmExisting = async (id: string) => {
    const { error: confirmErr } = await confirmDraft(id)
    if (confirmErr) {
      setError(confirmErr)
      return
    }
    router.refresh()
  }

  // Round card expand/collapse
  const toggleRoundExpand = (roundId: string) => {
    setExpandedRoundId((prev) => prev === roundId ? null : roundId)
  }

  // Get edit state for a round
  // Determine if a round currently has multi-session data
  const roundHasMultiSession = (round: ContinuationRound): boolean => {
    if (!Array.isArray(round.sessions)) return false
    const sessions = round.sessions as { jersey_numbers?: string[] }[]
    return sessions.filter((s) => s.jersey_numbers && s.jersey_numbers.length > 0).length >= 2
  }

  // Get session texts from a round's existing session data
  const getSessionTextsFromRound = (round: ContinuationRound): string[] => {
    if (!Array.isArray(round.sessions)) return [round.jersey_numbers.join("\n"), ""]
    const sessions = round.sessions as { jersey_numbers?: string[] }[]
    const withData = sessions.filter((s) => s.jersey_numbers && s.jersey_numbers.length > 0)
    if (withData.length >= 2) {
      return withData.map((s) => (s.jersey_numbers ?? []).join("\n"))
    }
    return [round.jersey_numbers.join("\n"), ""]
  }

  // Get session labels from a round's existing session data
  const getSessionLabelsFromRound = (round: ContinuationRound): string[] => {
    if (!Array.isArray(round.sessions)) return ["", ""]
    const sessions = round.sessions as { jersey_numbers?: string[], label?: string }[]
    const withData = sessions.filter((s) => s.jersey_numbers && s.jersey_numbers.length > 0)
    if (withData.length >= 2) {
      return withData.map((s) => s.label || "")
    }
    return ["", ""]
  }

  const getEditState = (round: ContinuationRound) => {
    const edits = roundEdits[round.id]
    const isMulti = edits?.is_multi_session ?? roundHasMultiSession(round)
    return {
      session_info: edits?.session_info ?? round.session_info ?? "",
      is_final_team: edits?.is_final_team ?? round.is_final_team,
      estimated_players: edits?.estimated_players ?? (round.estimated_players?.toString() ?? ""),
      estimated_players_f: edits?.estimated_players_f ?? (round.estimated_players_f?.toString() ?? ""),
      estimated_players_d: edits?.estimated_players_d ?? (round.estimated_players_d?.toString() ?? ""),
      estimated_players_g: edits?.estimated_players_g ?? (round.estimated_players_g?.toString() ?? ""),
      total_manually_edited: edits?.total_manually_edited ?? false,
      jersey_numbers: edits?.jersey_numbers ?? round.jersey_numbers,
      is_multi_session: isMulti,
      session_texts: edits?.session_texts ?? (isMulti ? getSessionTextsFromRound(round) : undefined),
      session_labels: edits?.session_labels ?? (isMulti ? getSessionLabelsFromRound(round) : undefined),
    }
  }

  const hasChanges = (round: ContinuationRound): boolean => {
    const edits = roundEdits[round.id]
    if (!edits) return false
    if (edits.session_info !== undefined && edits.session_info !== (round.session_info ?? "")) return true
    if (edits.is_final_team !== undefined && edits.is_final_team !== round.is_final_team) return true
    if (edits.estimated_players !== undefined && edits.estimated_players !== (round.estimated_players?.toString() ?? "")) return true
    if (edits.estimated_players_f !== undefined && edits.estimated_players_f !== (round.estimated_players_f?.toString() ?? "")) return true
    if (edits.estimated_players_d !== undefined && edits.estimated_players_d !== (round.estimated_players_d?.toString() ?? "")) return true
    if (edits.estimated_players_g !== undefined && edits.estimated_players_g !== (round.estimated_players_g?.toString() ?? "")) return true
    if (edits.jersey_numbers !== undefined) {
      const orig = round.jersey_numbers
      const edited = edits.jersey_numbers
      if (orig.length !== edited.length) return true
      for (let i = 0; i < orig.length; i++) {
        if (orig[i] !== edited[i]) return true
      }
    }
    if (edits.is_multi_session !== undefined && edits.is_multi_session !== roundHasMultiSession(round)) return true
    if (edits.session_texts !== undefined) return true
    if (edits.session_labels !== undefined) return true
    return false
  }

  const updateEdit = (roundId: string, field: string, value: unknown) => {
    setRoundEdits((prev) => ({
      ...prev,
      [roundId]: { ...prev[roundId], [field]: value },
    }))
  }

  const handleSaveChanges = async (round: ContinuationRound) => {
    const state = getEditState(round)
    setSaving(round.id)

    const ep = parseInt(state.estimated_players, 10)
    const epF = parseInt(state.estimated_players_f, 10)
    const epD = parseInt(state.estimated_players_d, 10)
    const epG = parseInt(state.estimated_players_g, 10)

    // Build sessions data if multi-session is on
    let sessionsData: unknown = undefined
    let jerseyNumbers = state.jersey_numbers
    if (state.is_multi_session && state.session_texts) {
      const labels = state.session_labels || []
      const sessionEntries = state.session_texts
        .map((text, i) => ({
          session_number: i + 1,
          date: "",
          start_time: "",
          end_time: "",
          jersey_numbers: parseJerseyNumbers(text),
          label: labels[i] || `Session ${i + 1}`,
        }))
        .filter((s) => s.jersey_numbers.length > 0)
      sessionsData = sessionEntries
      // Update jersey_numbers to union of all sessions
      const allNums = new Set<string>()
      for (const s of sessionEntries) {
        for (const n of s.jersey_numbers) allNums.add(n)
      }
      jerseyNumbers = Array.from(allNums)
    } else if (state.is_multi_session === false) {
      // Explicitly turned off — clear sessions
      sessionsData = []
    }

    const { error: saveErr } = await updateRound(round.id, {
      session_info: state.session_info || null,
      is_final_team: state.is_final_team,
      estimated_players: !isNaN(ep) && ep > 0 ? ep : null,
      estimated_players_f: !isNaN(epF) && epF > 0 ? epF : null,
      estimated_players_d: !isNaN(epD) && epD > 0 ? epD : null,
      estimated_players_g: !isNaN(epG) && epG > 0 ? epG : null,
      jersey_numbers: jerseyNumbers,
      ...(sessionsData !== undefined ? { sessions: sessionsData } : {}),
    })

    setSaving(null)

    if (saveErr) {
      setError(saveErr)
      return
    }

    // Update local state
    setPublishedRounds((prev) =>
      prev.map((r) =>
        r.id === round.id
          ? {
              ...r,
              session_info: state.session_info || null,
              is_final_team: state.is_final_team,
              estimated_players: !isNaN(ep) && ep > 0 ? ep : null,
              estimated_players_f: !isNaN(epF) && epF > 0 ? epF : null,
              estimated_players_d: !isNaN(epD) && epD > 0 ? epD : null,
              estimated_players_g: !isNaN(epG) && epG > 0 ? epG : null,
              jersey_numbers: jerseyNumbers,
              ...(sessionsData !== undefined ? { sessions: sessionsData as ContinuationRound["sessions"] } : {}),
            }
          : r
      )
    )
    // Clear edits
    setRoundEdits((prev) => {
      const next = { ...prev }
      delete next[round.id]
      return next
    })
  }

  const handleEditJerseys = (round: ContinuationRound) => {
    const state = getEditState(round)
    setEditJerseyText(state.jersey_numbers.join("\n"))
    setEditJerseyModal(round.id)
  }

  const handleApplyJerseyEdit = () => {
    if (!editJerseyModal) return
    const parsed = parseJerseyNumbers(editJerseyText)
    updateEdit(editJerseyModal, "jersey_numbers", parsed)
    setEditJerseyModal(null)
    setEditJerseyText("")
  }

  // Delete handlers
  const handleDeleteClick = async (round: ContinuationRound) => {
    setDeleteTarget(round)
    if (round.is_final_team) {
      const count = await getRevertablePlayerCount(round.id)
      setDeleteRevertCount(count)
    } else {
      setDeleteRevertCount(0)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)

    const { error: deleteErr } = await deleteRound(deleteTarget.id)

    setDeleting(false)

    if (deleteErr) {
      setError(deleteErr)
      setDeleteTarget(null)
      return
    }

    setPublishedRounds((prev) => prev.filter((r) => r.id !== deleteTarget.id))
    if (expandedRoundId === deleteTarget.id) setExpandedRoundId(null)
    setDeleteTarget(null)
  }

  // Create empty round
  const handleShowCreateEmpty = async () => {
    setShowCreateEmpty(true)
    setEmptyTeamLevel(defaultTeamLevel)
    const nextRound = await getNextRoundNumber(associationId, division, defaultTeamLevel)
    setEmptyRoundNumber(nextRound)
    setEmptySessionInfo("")
  }

  const handleCreateEmpty = async () => {
    if (!emptyRoundNumber) return
    setCreating(true)

    const { error: createErr } = await createEmptyRound(
      associationId,
      division,
      emptyTeamLevel,
      emptyRoundNumber,
      emptySessionInfo || undefined
    )

    setCreating(false)

    if (createErr) {
      setError(createErr)
      return
    }

    setShowCreateEmpty(false)
    router.refresh()
  }

  // Complete level handler
  const handleCompleteLevel = async (teamLevel: string) => {
    setCompleting(true)
    const { error: completeErr } = await completeLevel(associationId, division, teamLevel)
    setCompleting(false)
    setCompleteTarget(null)

    if (completeErr) {
      setError(completeErr)
      return
    }

    setActiveView("completed")
    router.refresh()
  }

  // Uncomplete level handler
  const handleUncompleteLevel = async (teamLevel: string) => {
    setUncompleting(true)
    const { error: uncompleteErr } = await uncompleteLevel(associationId, division, teamLevel)
    setUncompleting(false)
    setUncompleteTarget(null)

    if (uncompleteErr) {
      setError(uncompleteErr)
      return
    }

    setActiveView("current")
    router.refresh()
  }

  // Group published rounds by team level
  const roundsByTeam: Record<string, ContinuationRound[]> = {}
  for (const round of publishedRounds) {
    if (!roundsByTeam[round.team_level]) roundsByTeam[round.team_level] = []
    roundsByTeam[round.team_level].push(round)
  }
  // Sort each group by round_number descending
  for (const level of Object.keys(roundsByTeam)) {
    roundsByTeam[level].sort((a, b) => b.round_number - a.round_number)
  }

  // Filter for current (active) vs completed
  const activeTeamLevelKeys = Object.keys(roundsByTeam)
    .filter((level) => !completedSet.has(level))
    .sort()
  const completedTeamLevelKeys = LEVEL_ORDER.filter(
    (level) => completedSet.has(level) && roundsByTeam[level]
  )

  // Count badges
  const activeCount = activeTeamLevelKeys.length
  const completedCount = completedTeamLevelKeys.length

  // Auto-calculate total from F+D+G for scrape confirmation
  const handleScrapePositionChange = (field: "F" | "D" | "G", value: string) => {
    const setters = { F: setEstimatedPlayersF, D: setEstimatedPlayersD, G: setEstimatedPlayersG }
    setters[field](value)
    if (!scrapeEstTotalManual) {
      const fVal = field === "F" ? parseInt(value, 10) : parseInt(estimatedPlayersF, 10)
      const dVal = field === "D" ? parseInt(value, 10) : parseInt(estimatedPlayersD, 10)
      const gVal = field === "G" ? parseInt(value, 10) : parseInt(estimatedPlayersG, 10)
      const anySet = !isNaN(fVal) || !isNaN(dVal) || !isNaN(gVal)
      if (anySet) {
        setEstimatedPlayers(((fVal || 0) + (dVal || 0) + (gVal || 0)).toString())
      }
    }
  }

  // Auto-calculate total from F+D+G for round editor
  const handleRoundPositionChange = (roundId: string, field: "estimated_players_f" | "estimated_players_d" | "estimated_players_g", value: string) => {
    updateEdit(roundId, field, value)
    const edits = roundEdits[roundId]
    const round = publishedRounds.find((r) => r.id === roundId)
    if (!edits?.total_manually_edited) {
      const getVal = (f: "estimated_players_f" | "estimated_players_d" | "estimated_players_g") => {
        if (f === field) return parseInt(value, 10)
        if (edits?.[f] !== undefined) return parseInt(edits[f] ?? "", 10)
        return round?.[f] != null ? round[f] : NaN
      }
      const fVal = getVal("estimated_players_f")
      const dVal = getVal("estimated_players_d")
      const gVal = getVal("estimated_players_g")
      const anySet = !isNaN(fVal) || !isNaN(dVal) || !isNaN(gVal)
      if (anySet) {
        updateEdit(roundId, "estimated_players", ((fVal || 0) + (dVal || 0) + (gVal || 0)).toString())
      }
    }
  }

  return (
    <div className="admin-continuations-page">
      {/* Top bar */}
      <div className="scrape-top-row">
        <Link href="/settings" className="scrape-back-link">
          <ArrowLeft size={16} />
          Settings
        </Link>
        {sourceUrl && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="scrape-source-link"
          >
            Verify source page
            <ExternalLink size={12} />
          </a>
        )}
      </div>

      <h1 className="scrape-page-title">Continuations</h1>

      {/* Current Rounds / Completed Teams toggle */}
      <div className="admin-view-toggle">
        <button
          className={`admin-view-toggle-btn ${activeView === "current" ? "active" : ""}`}
          onClick={() => setActiveView("current")}
        >
          Current Rounds
          {activeCount > 0 && <span className="admin-view-toggle-badge">{activeCount}</span>}
        </button>
        <button
          className={`admin-view-toggle-btn ${activeView === "completed" ? "active" : ""}`}
          onClick={() => setActiveView("completed")}
        >
          Completed Teams
          {completedCount > 0 && <span className="admin-view-toggle-badge">{completedCount}</span>}
        </button>
      </div>

      {error && <p className="scrape-error">{error}</p>}

      {/* ============ CURRENT ROUNDS VIEW ============ */}
      {activeView === "current" && (
        <>
          {/* Scrape section */}
          {!result && !draftId && drafts.length === 0 && (
            <div className="admin-round-actions">
              <button className="scrape-confirm-btn" onClick={handleScrape} disabled={scraping}>
                {scraping ? <Loader2 size={14} className="scrape-spinner" /> : null}
                Scrape New Round
              </button>
              <button className="scrape-discard-btn" onClick={handleShowCreateEmpty}>
                Create Empty Round
              </button>
            </div>
          )}

          {/* Scraping loading */}
          {scraping && (
            <div className="scrape-loading">
              <Loader2 size={16} className="scrape-spinner" />
              Fetching continuations page...
            </div>
          )}

          {/* Scrape preview */}
          {result && !draftId && (
            <div className="scrape-preview">
              <div className="scrape-summary-card">
                <div className="scrape-summary-row">
                  <span className="scrape-summary-label">Type</span>
                  <span className="scrape-summary-value scrape-value-light">
                    {PAGE_TYPE_LABELS[result.pageType]}
                  </span>
                </div>
                <div className="scrape-summary-row">
                  <span className="scrape-summary-label">Team Level</span>
                  <span className="scrape-summary-value">
                    <select
                      className="scrape-team-select"
                      value={teamLevelOverride ?? defaultTeamLevel}
                      onChange={async (e) => {
                        const level = e.target.value
                        setTeamLevelOverride(level)
                        const nextRound = await getNextRoundNumber(associationId, division, level)
                        setRoundNumber(nextRound)
                      }}
                    >
                      {TEAM_LEVELS.map((level) => (
                        <option key={level} value={level}>
                          {division} {level}
                        </option>
                      ))}
                    </select>
                    {detectedTeamLevel && detectedTeamLevel !== teamLevelOverride && (
                      <span className="admin-detected-hint">Detected: {detectedTeamLevel}</span>
                    )}
                  </span>
                </div>
                <div className="scrape-summary-row">
                  <span className="scrape-summary-label">Round</span>
                  <span className="scrape-summary-value">
                    <input
                      type="number"
                      min={1}
                      className="scrape-round-input"
                      value={roundNumber ?? ""}
                      onChange={(e) => setRoundNumber(parseInt(e.target.value, 10) || 1)}
                    />
                  </span>
                </div>
                <div className="scrape-summary-row">
                  <span className="scrape-summary-label">Players</span>
                  <span className="scrape-summary-value scrape-value-light">
                    {multiSession ? multiSessionTotal : result.jerseyNumbers.length} players
                  </span>
                </div>
                {result.ipPlayers.length > 0 && (
                  <div className="scrape-summary-row">
                    <span className="scrape-summary-label">IP</span>
                    <span className="scrape-summary-value">
                      {result.ipPlayers.length} IP
                    </span>
                  </div>
                )}
                {result.reportingDate && (
                  <div className="scrape-summary-row">
                    <span className="scrape-summary-label">Report Date</span>
                    <span className="scrape-summary-value">
                      {result.reportingDate}
                    </span>
                  </div>
                )}
                <div className="scrape-summary-row">
                  <span className="scrape-summary-label">Session Info</span>
                  <span className="scrape-summary-value">
                    <input
                      type="text"
                      className="scrape-session-info-input"
                      placeholder="e.g. Game vs Kanata"
                      value={sessionInfo}
                      onChange={(e) => setSessionInfo(e.target.value)}
                    />
                  </span>
                </div>
                <div className="scrape-summary-row scrape-final-team-row">
                  <span className="scrape-summary-label">Final Team</span>
                  <span className="scrape-summary-value">
                    <label className="scrape-final-team-label scrape-value-light">
                      <input
                        type="checkbox"
                        checked={isFinalTeam}
                        onChange={(e) => setIsFinalTeam(e.target.checked)}
                      />
                      Final Team
                    </label>
                  </span>
                </div>
                <div className="scrape-summary-row">
                  <span className="scrape-summary-label">Multi-Session</span>
                  <span className="scrape-summary-value">
                    <label className="scrape-final-team-label scrape-value-light">
                      <input
                        type="checkbox"
                        checked={multiSession}
                        onChange={(e) => {
                          const checked = e.target.checked
                          setMultiSession(checked)
                          if (checked && result) {
                            const MIN_BLOCK_SIZE = 12
                            const significantBlocks = result.blocks.filter(
                              (b) => b.jerseyNumbers.length >= MIN_BLOCK_SIZE
                            )
                            if (significantBlocks.length >= 2) {
                              setSessionTexts(significantBlocks.map((b) => b.jerseyNumbers.join("\n")))
                            } else {
                              setSessionTexts([result.jerseyNumbers.join("\n"), ""])
                            }
                          }
                        }}
                      />
                      Multi-Session
                    </label>
                  </span>
                </div>
                <div className="scrape-summary-row">
                  <span className="scrape-summary-label">Est. Players</span>
                  <span className="scrape-summary-value">
                    <div className="admin-estimated-group">
                      <div className="admin-estimated-field">
                        <span className="admin-estimated-field-label">All</span>
                        <input
                          type="number"
                          min={0}
                          className="admin-estimated-input admin-estimated-input-total"
                          placeholder="0"
                          value={estimatedPlayers}
                          onChange={(e) => {
                            setEstimatedPlayers(e.target.value)
                            setScrapeEstTotalManual(true)
                          }}
                        />
                      </div>
                      <div className="admin-estimated-field">
                        <span className="admin-estimated-field-label">F</span>
                        <input
                          type="number"
                          min={0}
                          className="admin-estimated-input"
                          placeholder="0"
                          value={estimatedPlayersF}
                          onChange={(e) => handleScrapePositionChange("F", e.target.value)}
                        />
                      </div>
                      <div className="admin-estimated-field">
                        <span className="admin-estimated-field-label">D</span>
                        <input
                          type="number"
                          min={0}
                          className="admin-estimated-input"
                          placeholder="0"
                          value={estimatedPlayersD}
                          onChange={(e) => handleScrapePositionChange("D", e.target.value)}
                        />
                      </div>
                      <div className="admin-estimated-field">
                        <span className="admin-estimated-field-label">G</span>
                        <input
                          type="number"
                          min={0}
                          className="admin-estimated-input"
                          placeholder="0"
                          value={estimatedPlayersG}
                          onChange={(e) => handleScrapePositionChange("G", e.target.value)}
                        />
                      </div>
                    </div>
                  </span>
                </div>
              </div>

              {/* Jersey list / Session panels */}
              {multiSession ? (
                <>
                  <div className="scrape-session-panels">
                    {sessionTexts.map((text, i) => {
                      const count = parseJerseyNumbers(text).length
                      return (
                        <div key={i} className="scrape-session-panel">
                          <input
                            className="scrape-session-label-input"
                            placeholder={`Session ${i + 1}`}
                            value={sessionLabels[i] || ""}
                            onChange={(e) => {
                              const next = [...sessionLabels]
                              next[i] = e.target.value
                              setSessionLabels(next)
                            }}
                          />
                          <textarea
                            className="scrape-session-textarea"
                            rows={6}
                            placeholder="Jersey numbers, one per line"
                            value={text}
                            onChange={(e) => {
                              const next = [...sessionTexts]
                              next[i] = e.target.value
                              setSessionTexts(next)
                            }}
                          />
                          <div className="scrape-session-count">{count} players</div>
                        </div>
                      )
                    })}
                  </div>
                  {sessionTexts.length < 3 && (
                    <button
                      className="scrape-add-session-btn"
                      onClick={() => {
                        setSessionTexts([...sessionTexts, ""])
                        setSessionLabels([...sessionLabels, ""])
                      }}
                    >
                      + Add Session
                    </button>
                  )}
                  <div className="scrape-session-total">
                    Total: {multiSessionTotal} unique players
                  </div>
                </>
              ) : (
                <>
                  {result.jerseyNumbers.length === 0 ? (
                    <div className="scrape-no-players-warning">
                      <TriangleAlert size={16} />
                      <p>No players found on this&nbsp;page</p>
                    </div>
                  ) : (
                    <div className="admin-jersey-section">
                      <button
                        className="admin-jersey-toggle"
                        onClick={() => setScrapeJerseyExpanded(!scrapeJerseyExpanded)}
                      >
                        <ChevronDown
                          size={14}
                          style={{
                            transform: scrapeJerseyExpanded ? "rotate(0deg)" : "rotate(-90deg)",
                            transition: "transform 200ms",
                          }}
                        />
                        {result.jerseyNumbers.length} jerseys
                      </button>
                      {scrapeJerseyExpanded && (
                        <div className="admin-jersey-scroll">
                          {result.jerseyNumbers.map((num) => (
                            <div
                              key={num}
                              className={`scrape-jersey-row ${result.ipPlayers.includes(num) ? "scrape-jersey-row-ip" : ""}`}
                            >
                              <span className="scrape-jersey-num">{num}</span>
                              {result.ipPlayers.includes(num) && (
                                <span className="scrape-ip-tag">IP</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {result.pageType === "everyone_continues" && (
                <p className="scrape-everyone-note">
                  Everyone continues — roster copied from previous&nbsp;round
                </p>
              )}

              <button className="scrape-manual-entry-link scrape-edit-manually" onClick={openManualEntry}>
                Edit manually
              </button>

              <div className="scrape-actions">
                <button
                  className="scrape-confirm-btn"
                  onClick={handleConfirmClick}
                  disabled={confirming}
                >
                  {confirming ? <Loader2 size={14} className="scrape-spinner" /> : null}
                  Confirm
                </button>
                <button
                  className="scrape-discard-btn"
                  onClick={handleDiscard}
                  disabled={confirming}
                >
                  Discard
                </button>
              </div>
            </div>
          )}

          {/* Manual entry modal */}
          {showManualEntry && (
            <div className="scrape-modal-overlay" onClick={() => setShowManualEntry(false)}>
              <div className="scrape-modal-card" onClick={(e) => e.stopPropagation()}>
                <h2 className="scrape-modal-title">Enter Jersey Numbers</h2>
                <p className="scrape-modal-text">Paste jersey numbers, one per line or&nbsp;comma-separated</p>
                <textarea
                  className="scrape-manual-textarea"
                  rows={8}
                  placeholder={"e.g.\n12\n34\n56"}
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                />
                <div className="scrape-modal-actions">
                  <button className="scrape-confirm-btn" onClick={handleApplyManual}>
                    Apply
                  </button>
                  <button className="scrape-discard-btn" onClick={() => setShowManualEntry(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Size warning */}
          {showSizeWarning && (
            <div className="scrape-modal-overlay" onClick={() => setShowSizeWarning(false)}>
              <div className="scrape-modal-card" onClick={(e) => e.stopPropagation()}>
                <p className="scrape-size-confirm-text">
                  This final team has {playerCount} players. Typical team size is&nbsp;16-17. Are you&nbsp;sure?
                </p>
                <div className="scrape-modal-actions">
                  <button className="scrape-confirm-btn" onClick={doConfirm}>
                    Yes, confirm
                  </button>
                  <button className="scrape-discard-btn" onClick={() => setShowSizeWarning(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Existing drafts */}
          {drafts.length > 0 && !result && (
            <div className="scrape-drafts">
              <h2 className="settings-section-title">Pending Drafts</h2>
              {drafts.map((draft) => (
                <div key={draft.id} className="scrape-draft-card">
                  <div className="scrape-draft-info">
                    <span className="scrape-draft-level">
                      {draft.division} {draft.team_level} — Round {draft.round_number}
                    </span>
                    <span className="scrape-draft-count">
                      {draft.jersey_numbers.length} players
                    </span>
                  </div>
                  <div className="scrape-draft-actions">
                    <button
                      className="scrape-confirm-btn scrape-draft-btn"
                      onClick={() => handleConfirmExisting(draft.id)}
                    >
                      Confirm
                    </button>
                    <button
                      className="scrape-discard-btn scrape-draft-btn"
                      onClick={() => handleDiscardExisting(draft.id)}
                    >
                      Discard
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Create empty round form */}
          {showCreateEmpty && (
            <div className="scrape-summary-card">
              <h2 className="settings-section-title">Create Empty Round</h2>
              <div className="scrape-summary-row">
                <span className="scrape-summary-label">Team Level</span>
                <span className="scrape-summary-value">
                  <select
                    className="scrape-team-select"
                    value={emptyTeamLevel}
                    onChange={async (e) => {
                      const level = e.target.value
                      setEmptyTeamLevel(level)
                      const nextRound = await getNextRoundNumber(associationId, division, level)
                      setEmptyRoundNumber(nextRound)
                    }}
                  >
                    {TEAM_LEVELS.map((level) => (
                      <option key={level} value={level}>
                        {division} {level}
                      </option>
                    ))}
                  </select>
                </span>
              </div>
              <div className="scrape-summary-row">
                <span className="scrape-summary-label">Round</span>
                <span className="scrape-summary-value">
                  <input
                    type="number"
                    min={1}
                    className="scrape-round-input"
                    value={emptyRoundNumber ?? ""}
                    onChange={(e) => setEmptyRoundNumber(parseInt(e.target.value, 10) || 1)}
                  />
                </span>
              </div>
              <div className="scrape-summary-row">
                <span className="scrape-summary-label">Session Info</span>
                <span className="scrape-summary-value">
                  <input
                    type="text"
                    className="scrape-session-info-input"
                    placeholder="e.g. A-M / N-Z"
                    value={emptySessionInfo}
                    onChange={(e) => setEmptySessionInfo(e.target.value)}
                  />
                </span>
              </div>
              <div className="scrape-actions">
                <button
                  className="scrape-confirm-btn"
                  onClick={handleCreateEmpty}
                  disabled={creating}
                >
                  {creating ? <Loader2 size={14} className="scrape-spinner" /> : null}
                  Create
                </button>
                <button
                  className="scrape-discard-btn"
                  onClick={() => setShowCreateEmpty(false)}
                  disabled={creating}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Published rounds list — active (non-completed) levels only */}
          {activeTeamLevelKeys.length === 0 && !result && drafts.length === 0 && !showCreateEmpty ? (
            <p className="scrape-no-url">No active continuations. Scrape or create a round to&nbsp;get&nbsp;started.</p>
          ) : (
            activeTeamLevelKeys.map((level) => (
              <div key={level} className="admin-team-group">
                <h2 className="settings-section-title">{division} {level}</h2>
                {roundsByTeam[level].map((round) => {
                  const isExpanded = expandedRoundId === round.id
                  const state = getEditState(round)
                  const changed = hasChanges(round)

                  return (
                    <div key={round.id} className="admin-round-card">
                      <button
                        className="admin-round-card-header"
                        onClick={() => toggleRoundExpand(round.id)}
                      >
                        <span className="admin-round-card-title">
                          {round.is_final_team ? "Final Team" : `Round ${round.round_number}`}
                        </span>
                        <span className="admin-round-card-count">
                          {round.jersey_numbers.length} players
                        </span>
                        {Array.isArray(round.sessions) && (round.sessions as { jersey_numbers?: string[] }[]).filter((s) => s.jersey_numbers && s.jersey_numbers.length > 0).length >= 2 && (
                          <span className="admin-round-sessions-badge">
                            {(round.sessions as { jersey_numbers?: string[] }[]).filter((s) => s.jersey_numbers && s.jersey_numbers.length > 0).length} sessions
                          </span>
                        )}
                        {round.session_info && (
                          <span className="admin-round-card-session">{round.session_info}</span>
                        )}
                        <ChevronDown
                          size={14}
                          className="admin-round-card-chevron"
                          style={{
                            transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)",
                            transition: "transform 200ms",
                          }}
                        />
                      </button>

                      {isExpanded && (
                        <div className="admin-round-card-body">
                          {/* Metadata */}
                          {round.source_url && (
                            <div className="admin-round-meta">
                              <a href={round.source_url} target="_blank" rel="noopener noreferrer" className="scrape-source-link">
                                Source URL <ExternalLink size={12} />
                              </a>
                              {round.scraped_at && (
                                <span className="admin-round-meta-date">
                                  Scraped {new Date(round.scraped_at).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Estimated players */}
                          <div className="admin-round-field">
                            <label className="admin-round-field-label">Estimated Players</label>
                            <div className="admin-estimated-group">
                              <div className="admin-estimated-field">
                                <span className="admin-estimated-field-label">All</span>
                                <input
                                  type="number"
                                  min={0}
                                  className="admin-estimated-input admin-estimated-input-total"
                                  placeholder="0"
                                  value={state.estimated_players}
                                  onChange={(e) => {
                                    updateEdit(round.id, "estimated_players", e.target.value)
                                    updateEdit(round.id, "total_manually_edited", true)
                                  }}
                                />
                              </div>
                              <div className="admin-estimated-field">
                                <span className="admin-estimated-field-label">F</span>
                                <input
                                  type="number"
                                  min={0}
                                  className="admin-estimated-input"
                                  placeholder="0"
                                  value={state.estimated_players_f}
                                  onChange={(e) => handleRoundPositionChange(round.id, "estimated_players_f", e.target.value)}
                                />
                              </div>
                              <div className="admin-estimated-field">
                                <span className="admin-estimated-field-label">D</span>
                                <input
                                  type="number"
                                  min={0}
                                  className="admin-estimated-input"
                                  placeholder="0"
                                  value={state.estimated_players_d}
                                  onChange={(e) => handleRoundPositionChange(round.id, "estimated_players_d", e.target.value)}
                                />
                              </div>
                              <div className="admin-estimated-field">
                                <span className="admin-estimated-field-label">G</span>
                                <input
                                  type="number"
                                  min={0}
                                  className="admin-estimated-input"
                                  placeholder="0"
                                  value={state.estimated_players_g}
                                  onChange={(e) => handleRoundPositionChange(round.id, "estimated_players_g", e.target.value)}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Session info */}
                          <div className="admin-round-field">
                            <label className="admin-round-field-label">Session Info</label>
                            <input
                              type="text"
                              className="scrape-session-info-input"
                              placeholder="e.g. Game vs Kanata"
                              value={state.session_info}
                              onChange={(e) => updateEdit(round.id, "session_info", e.target.value)}
                            />
                          </div>

                          {/* Final team checkbox */}
                          <div className="admin-round-field">
                            <label className="scrape-final-team-label scrape-value-light">
                              <input
                                type="checkbox"
                                checked={state.is_final_team}
                                onChange={(e) => updateEdit(round.id, "is_final_team", e.target.checked)}
                              />
                              Final Team
                            </label>
                          </div>

                          {/* Multi-session checkbox */}
                          <div className="admin-round-field">
                            <label className="scrape-final-team-label scrape-value-light">
                              <input
                                type="checkbox"
                                checked={state.is_multi_session}
                                onChange={(e) => {
                                  const checked = e.target.checked
                                  updateEdit(round.id, "is_multi_session", checked)
                                  if (checked) {
                                    // Initialize session texts and labels from existing sessions or jersey numbers
                                    const hasMulti = roundHasMultiSession(round)
                                    const texts = hasMulti
                                      ? getSessionTextsFromRound(round)
                                      : [state.jersey_numbers.join("\n"), ""]
                                    const labels = hasMulti
                                      ? getSessionLabelsFromRound(round)
                                      : ["", ""]
                                    updateEdit(round.id, "session_texts", texts)
                                    updateEdit(round.id, "session_labels", labels)
                                  } else {
                                    updateEdit(round.id, "session_texts", undefined)
                                    updateEdit(round.id, "session_labels", undefined)
                                  }
                                }}
                              />
                              Multi-Session
                            </label>
                          </div>

                          {/* Session panels (when multi-session is on) */}
                          {state.is_multi_session && state.session_texts && (
                            <div className="admin-round-field">
                              <div className="scrape-session-panels">
                                {state.session_texts.map((text, i) => {
                                  const count = parseJerseyNumbers(text).length
                                  const labels = state.session_labels || []
                                  return (
                                    <div key={i} className="scrape-session-panel">
                                      <input
                                        className="scrape-session-label-input"
                                        placeholder={`Session ${i + 1}`}
                                        value={labels[i] || ""}
                                        onChange={(e) => {
                                          const next = [...labels]
                                          while (next.length <= i) next.push("")
                                          next[i] = e.target.value
                                          updateEdit(round.id, "session_labels", next)
                                        }}
                                      />
                                      <textarea
                                        className="scrape-session-textarea"
                                        rows={6}
                                        placeholder="Jersey numbers, one per line"
                                        value={text}
                                        onChange={(e) => {
                                          const next = [...state.session_texts!]
                                          next[i] = e.target.value
                                          updateEdit(round.id, "session_texts", next)
                                        }}
                                      />
                                      <div className="scrape-session-count">{count} players</div>
                                    </div>
                                  )
                                })}
                              </div>
                              {state.session_texts.length < 3 && (
                                <button
                                  className="scrape-add-session-btn"
                                  onClick={() => {
                                    updateEdit(round.id, "session_texts", [...state.session_texts!, ""])
                                    const labels = state.session_labels || []
                                    updateEdit(round.id, "session_labels", [...labels, ""])
                                  }}
                                >
                                  + Add Session
                                </button>
                              )}
                              <div className="scrape-session-total">
                                Total: {new Set(state.session_texts.flatMap((t) => parseJerseyNumbers(t))).size} unique players
                              </div>
                            </div>
                          )}

                          {/* Jersey numbers */}
                          <div className="admin-round-field">
                            <div className="admin-jersey-field-header">
                              <label className="admin-round-field-label">
                                Jersey Numbers ({state.jersey_numbers.length})
                              </label>
                              <button
                                className="scrape-manual-entry-link"
                                onClick={() => handleEditJerseys(round)}
                              >
                                Edit Jerseys
                              </button>
                            </div>
                            <div className="admin-jersey-scroll">
                              {state.jersey_numbers.map((num) => (
                                <div key={num} className="scrape-jersey-row">
                                  <span className="scrape-jersey-num">{num}</span>
                                  {(round.ip_players ?? []).includes(num) && (
                                    <span className="scrape-ip-tag">IP</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="admin-round-actions">
                            <button
                              className="scrape-confirm-btn"
                              onClick={() => handleSaveChanges(round)}
                              disabled={!changed || saving === round.id}
                            >
                              {saving === round.id ? <Loader2 size={14} className="scrape-spinner" /> : null}
                              Save Changes
                            </button>
                            <button
                              className="admin-delete-btn"
                              onClick={() => handleDeleteClick(round)}
                            >
                              <Trash2 size={14} />
                              Delete Round
                            </button>
                          </div>

                          {/* Mark Level Complete — only on Final Team round cards */}
                          {state.is_final_team && (
                            <button
                              className="admin-complete-btn"
                              onClick={() => setCompleteTarget({ level: round.team_level })}
                            >
                              <CheckCircle size={14} />
                              Mark Level Complete
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </>
      )}

      {/* ============ COMPLETED TEAMS VIEW ============ */}
      {activeView === "completed" && (
        <>
          {completedTeamLevelKeys.length === 0 ? (
            <p className="admin-completed-empty">
              No completed teams yet. Mark a level as complete from its Final Team round card in&nbsp;Current&nbsp;Rounds.
            </p>
          ) : (
            completedTeamLevelKeys.map((level) => {
              const levelRounds = roundsByTeam[level] ?? []
              const finalRound = levelRounds.find((r) => r.is_final_team)
              const madeTeamCount = finalRound?.jersey_numbers.length ?? 0
              const finalizedDate = finalRound
                ? new Date(finalRound.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                : null
              const isExpanded = expandedCompletedLevel === level

              return (
                <div key={level} className="admin-completed-card">
                  <button
                    className="admin-completed-card-header"
                    onClick={() => setExpandedCompletedLevel(isExpanded ? null : level)}
                  >
                    <span className="admin-completed-card-title">{division} {level}</span>
                    <span className="admin-completed-card-stat">{levelRounds.length} rounds</span>
                    <span className="admin-completed-card-stat">{madeTeamCount} players</span>
                    {finalizedDate && (
                      <span className="admin-completed-card-date">{finalizedDate}</span>
                    )}
                    <ChevronDown
                      size={14}
                      className="admin-round-card-chevron"
                      style={{
                        transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)",
                        transition: "transform 200ms",
                      }}
                    />
                  </button>

                  {isExpanded && (
                    <div className="admin-completed-card-body">
                      {levelRounds.map((round) => (
                        <div key={round.id} className="admin-completed-round-row">
                          <span className="admin-completed-round-label">
                            {round.is_final_team ? "Final Team" : `Round ${round.round_number}`}
                          </span>
                          <span className="admin-completed-round-count">
                            {round.jersey_numbers.length} players
                          </span>
                          {round.session_info && (
                            <span className="admin-completed-round-session">{round.session_info}</span>
                          )}
                        </div>
                      ))}

                      <button
                        className="admin-uncomplete-btn"
                        onClick={() => setUncompleteTarget({ level })}
                      >
                        <Undo2 size={14} />
                        Uncomplete
                      </button>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </>
      )}

      {/* Edit jerseys modal */}
      {editJerseyModal && (
        <div className="scrape-modal-overlay" onClick={() => setEditJerseyModal(null)}>
          <div className="scrape-modal-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="scrape-modal-title">Edit Jersey Numbers</h2>
            <p className="scrape-modal-text">One per line or&nbsp;comma-separated</p>
            <textarea
              className="scrape-manual-textarea"
              rows={8}
              value={editJerseyText}
              onChange={(e) => setEditJerseyText(e.target.value)}
            />
            <div className="scrape-modal-actions">
              <button className="scrape-confirm-btn" onClick={handleApplyJerseyEdit}>
                Apply
              </button>
              <button className="scrape-discard-btn" onClick={() => setEditJerseyModal(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <div className="scrape-modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="scrape-modal-card" onClick={(e) => e.stopPropagation()}>
            <p className="scrape-size-confirm-text">
              Delete {division} {deleteTarget.team_level} Round {deleteTarget.round_number}?
            </p>
            {deleteTarget.is_final_team && deleteRevertCount > 0 && (
              <p className="admin-delete-warning">
                This is a final team round. {deleteRevertCount} player{deleteRevertCount !== 1 ? "s" : ""} will
                be reverted from &lsquo;made_team&rsquo; to&nbsp;&lsquo;trying_out&rsquo;.
              </p>
            )}
            <div className="scrape-modal-actions">
              <button
                className="admin-delete-btn"
                onClick={handleConfirmDelete}
                disabled={deleting}
              >
                {deleting ? <Loader2 size={14} className="scrape-spinner" /> : null}
                Confirm Delete
              </button>
              <button className="scrape-discard-btn" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete level confirmation dialog */}
      {completeTarget && (
        <div className="scrape-modal-overlay" onClick={() => setCompleteTarget(null)}>
          <div className="scrape-modal-card" onClick={(e) => e.stopPropagation()}>
            <p className="scrape-size-confirm-text">
              Complete {division} {completeTarget.level}? The hero card will be removed from the dashboard and this level will move to&nbsp;Completed&nbsp;Teams.
            </p>
            <div className="scrape-modal-actions">
              <button
                className="scrape-confirm-btn"
                onClick={() => handleCompleteLevel(completeTarget.level)}
                disabled={completing}
              >
                {completing ? <Loader2 size={14} className="scrape-spinner" /> : null}
                Complete
              </button>
              <button className="scrape-discard-btn" onClick={() => setCompleteTarget(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Uncomplete level confirmation dialog */}
      {uncompleteTarget && (
        <div className="scrape-modal-overlay" onClick={() => setUncompleteTarget(null)}>
          <div className="scrape-modal-card" onClick={(e) => e.stopPropagation()}>
            <p className="scrape-size-confirm-text">
              Reopen {division} {uncompleteTarget.level}? The hero card will reappear on the dashboard and the level will move back to&nbsp;Current&nbsp;Rounds.
            </p>
            <div className="scrape-modal-actions">
              <button
                className="scrape-confirm-btn"
                onClick={() => handleUncompleteLevel(uncompleteTarget.level)}
                disabled={uncompleting}
              >
                {uncompleting ? <Loader2 size={14} className="scrape-spinner" /> : null}
                Reopen
              </button>
              <button className="scrape-discard-btn" onClick={() => setUncompleteTarget(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
