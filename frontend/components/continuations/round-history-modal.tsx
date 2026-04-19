"use client"

import { useState, useCallback } from "react"
import { X, ChevronDown } from "lucide-react"
import { getAllRoundsForTeam } from "@/app/(app)/continuations/actions"
import type { ContinuationRound } from "@/types"

type SessionData = {
  session_number: number
  date: string
  start_time: string
  end_time: string
  jersey_numbers: string[]
}

type RoundHistoryModalProps = {
  teamLevel: string
  division: string
  associationId: string
  isOpen: boolean
  onClose: () => void
}

function formatTime(time: string): string {
  const [h, m] = time.split(":")
  const hour = parseInt(h)
  const ampm = hour >= 12 ? "pm" : "am"
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  return `${displayHour}:${m}${ampm}`
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00")
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function RoundHistoryModal({
  teamLevel,
  division,
  associationId,
  isOpen,
  onClose,
}: RoundHistoryModalProps) {
  const [rounds, setRounds] = useState<ContinuationRound[]>([])
  const [expandedRound, setExpandedRound] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadedKey, setLoadedKey] = useState("")

  const currentKey = `${associationId}:${division}:${teamLevel}`

  const loadData = useCallback(async () => {
    setLoading(true)
    const data = await getAllRoundsForTeam(associationId, division, teamLevel)
    setRounds(data)
    if (data.length > 0) setExpandedRound(data[0].id)
    setLoadedKey(currentKey)
    setLoading(false)
  }, [associationId, division, teamLevel, currentKey])

  if (!isOpen) return null

  // Trigger fetch when modal opens with new params
  if (loadedKey !== currentKey && !loading) {
    loadData()
  }

  // Build a map of round_number -> round for computing cuts
  const roundByNumber: Record<number, ContinuationRound> = {}
  for (const r of rounds) {
    roundByNumber[r.round_number] = r
  }

  return (
    <>
      <div className="long-press-overlay" onClick={onClose} />
      <div className="long-press-sheet round-history-modal">
        <div className="round-history-header">
          <h2 className="round-history-title">{division} {teamLevel} History</h2>
          <button onClick={onClose} className="round-history-close">
            <X size={20} />
          </button>
        </div>

        {loading && <p className="continuations-empty-cuts">Loading...</p>}

        <div className="round-history-list">
          {rounds.map((round, idx) => {
            const isExpanded = expandedRound === round.id
            const isLatest = idx === 0
            const sessions = (round.sessions ?? []) as SessionData[]
            const dates = [...new Set(sessions.map((s) => s.date))]
            const dateLabel = dates.length > 0 ? formatDate(dates[0]) : ""
            const prevRound = roundByNumber[round.round_number - 1]
            const cuts = prevRound
              ? prevRound.jersey_numbers.filter((jn) => !round.jersey_numbers.includes(jn))
              : []
            const roundLabel = round.is_final_team ? "Final Team" : `Round ${round.round_number}`

            return (
              <div
                key={round.id}
                className={isLatest ? "round-history-item round-history-item-active" : "round-history-item"}
              >
                <button
                  className="round-history-item-header"
                  onClick={() => setExpandedRound(isExpanded ? null : round.id)}
                >
                  <ChevronDown
                    size={14}
                    style={{ transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 200ms" }}
                  />
                  <span className="round-history-item-title">
                    {roundLabel} — {dateLabel}
                  </span>
                </button>
                {isExpanded && (
                  <div className="round-history-item-content">
                    {sessions.map((s) => (
                      <p key={s.session_number} className="round-history-session">
                        Session {s.session_number}: {formatTime(s.start_time)}–{formatTime(s.end_time)}
                      </p>
                    ))}
                    <p className="round-history-stat">Continuing: {round.jersey_numbers.length}</p>
                    <p className="round-history-stat">Cuts: {cuts.length}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
