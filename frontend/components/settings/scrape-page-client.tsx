"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ExternalLink, Loader2 } from "lucide-react"
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

  const handleScrape = async () => {
    setError(null)
    setResult(null)
    setDraftId(null)
    setScraping(true)

    try {
      const scrapeResult = await scrapeContinuationsPage(associationId, division)

      if (scrapeResult.error) {
        setError(scrapeResult.error)
        setScraping(false)
        return
      }

      setResult(scrapeResult)
      setTeamLevelOverride(scrapeResult.teamLevel)
      setIsFinalTeam(scrapeResult.pageType === "final_team")
      const nextRound = await getNextRoundNumber(associationId, division, scrapeResult.teamLevel ?? "AA")
      setRoundNumber(nextRound)
      setScraping(false)
    } catch {
      setError("An unexpected error occurred")
      setScraping(false)
    }
  }

  const handleConfirm = async () => {
    if (!result) return
    setConfirming(true)

    try {
      // Apply team level override before saving
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

      // Then confirm (publish)
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

  const handleDiscard = () => {
    setResult(null)
    setDraftId(null)
    setTeamLevelOverride(null)
    setRoundNumber(null)
    setSessionInfo("")
    setIsFinalTeam(false)
    setError(null)
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
      <Link href="/settings" className="scrape-back-link">
        <ArrowLeft size={16} />
        Settings
      </Link>

      <h1 className="scrape-page-title">Scrape Continuations</h1>

      <div className="scrape-division-badge">{abbreviation}-{division}</div>

      {sourceUrl ? (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="scrape-source-link"
        >
          {sourceUrl}
          <ExternalLink size={12} />
        </a>
      ) : (
        <p className="scrape-no-url">No continuations URL configured for&nbsp;this&nbsp;division</p>
      )}

      {error && <p className="scrape-error">{error}</p>}

      {/* Ready state */}
      {!result && !scraping && (
        <button
          className="scrape-confirm-btn"
          onClick={handleScrape}
          disabled={!sourceUrl}
        >
          Scrape Now
        </button>
      )}

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

          <div className="scrape-summary-card">
            <div className="scrape-summary-row">
              <span className="scrape-summary-label">Type</span>
              <span className="scrape-summary-value">
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
              <span className="scrape-summary-value">
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
                <label className="scrape-final-team-label">
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

          {result.jerseyNumbers.length > 0 && (
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

          <div className="scrape-actions">
            <button
              className="scrape-confirm-btn"
              onClick={handleConfirm}
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
