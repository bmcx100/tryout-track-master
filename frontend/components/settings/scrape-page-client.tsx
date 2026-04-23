"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ExternalLink, Loader2, TriangleAlert } from "lucide-react"
import Link from "next/link"
import {
  scrapeContinuationsPage,
  saveDraftRound,
  confirmDraft,
  discardDraft,
  getNextRoundNumber,
  type ScrapeResult,
} from "@/app/(app)/continuations/scraper-actions"
import type { ContinuationRound } from "@/types"

type ScrapePageClientProps = {
  associationId: string
  division: string
  abbreviation: string
  sourceUrl: string | null
  existingDrafts: ContinuationRound[]
}

const PAGE_TYPE_LABELS: Record<string, string> = {
  continuation: "Continuation",
  final_team: "Final Team",
  everyone_continues: "Everyone Continues",
  no_data: "No Data",
}

const TEAM_LEVELS = ["AA", "A", "BB", "B", "C"]
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

export function ScrapePageClient({
  associationId,
  division,
  abbreviation,
  sourceUrl,
  existingDrafts,
}: ScrapePageClientProps) {
  const router = useRouter()
  const [scraping, setScraping] = useState(false)
  const [result, setResult] = useState<ScrapeResult | null>(null)
  const [teamLevelOverride, setTeamLevelOverride] = useState<string | null>(null)
  const [draftId, setDraftId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [drafts, setDrafts] = useState(existingDrafts)
  const [roundNumber, setRoundNumber] = useState<number | null>(null)
  const [sessionInfo, setSessionInfo] = useState("")
  const [isFinalTeam, setIsFinalTeam] = useState(false)
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [manualText, setManualText] = useState("")
  const [showSizeWarning, setShowSizeWarning] = useState(false)
  const hasScrapeStarted = useRef(false)

  const playerCount = result?.jerseyNumbers.length ?? 0
  const isUnusualSize = playerCount < TEAM_SIZE_MIN || playerCount > TEAM_SIZE_MAX

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
      setTeamLevelOverride(scrapeResult.teamLevel)
      setIsFinalTeam(false)
      const nextRound = await getNextRoundNumber(associationId, division, scrapeResult.teamLevel ?? "AA")
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
      const { draftId: newDraftId, error: saveErr } = await saveDraftRound(
        associationId,
        division,
        resultToSave,
        roundNumber ?? undefined,
        sessionInfo || undefined,
        isFinalTeam
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

      setDraftId(newDraftId)
      setResult(null)
      router.push("/continuations")
    } catch {
      setError("Failed to confirm")
      setConfirming(false)
    }
  }

  const handleApplyManual = () => {
    if (!result) return
    const parsed = parseJerseyNumbers(manualText)
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
    setRoundNumber(null)
    setSessionInfo("")
    setIsFinalTeam(false)
    setError(null)
    setShowManualEntry(false)
    setShowSizeWarning(false)
    setManualText("")
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
    router.push("/continuations")
  }

  return (
    <div className="scrape-page">
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

      <h1 className="scrape-page-title">Scrape Continuations</h1>

      {!sourceUrl && (
        <p className="scrape-no-url">No continuations URL configured for&nbsp;this&nbsp;division</p>
      )}

      {error && <p className="scrape-error">{error}</p>}

      {/* Loading state */}
      {scraping && (
        <div className="scrape-loading">
          <Loader2 size={16} className="scrape-spinner" />
          Fetching continuations page...
        </div>
      )}

      {/* Preview state */}
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
                  value={teamLevelOverride ?? "AA"}
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
                {result.jerseyNumbers.length} players
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
          </div>

          {result.jerseyNumbers.length === 0 ? (
            <div className="scrape-no-players-warning">
              <TriangleAlert size={16} />
              <p>No players found on this&nbsp;page</p>
            </div>
          ) : (
            <div className="scrape-jersey-vertical">
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

      {/* Size warning confirmation dialog */}
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
    </div>
  )
}
