"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import Link from "next/link"
import { adminCreatePlayer } from "@/app/(app)/players/actions"

type AddPlayerFormProps = {
  associationId: string
  divisions: string[]
  activeDivision: string
}

const POSITIONS = ["F", "D", "G"]

export function AddPlayerForm({
  associationId,
  divisions,
  activeDivision,
}: AddPlayerFormProps) {
  const router = useRouter()
  const [division, setDivision] = useState(activeDivision)
  const [jerseyNumber, setJerseyNumber] = useState("")
  const [name, setName] = useState("")
  const [position, setPosition] = useState("")
  const [previousTeam, setPreviousTeam] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!jerseyNumber.trim() || !name.trim() || !position) {
      setError("Jersey number, name, and position are required")
      return
    }

    setSubmitting(true)
    const result = await adminCreatePlayer({
      association_id: associationId,
      division,
      jersey_number: jerseyNumber.trim(),
      name: name.trim(),
      position,
      previous_team: previousTeam.trim() || undefined,
    })
    setSubmitting(false)

    if (result.error) {
      setError(result.error)
      return
    }

    router.push("/settings")
    router.refresh()
  }

  return (
    <div className="add-player-page">
      <Link href="/settings" className="add-player-back">
        <ChevronLeft size={18} />
        <span>Settings</span>
      </Link>

      <h1 className="add-player-title">Add Player</h1>

      <form onSubmit={handleSubmit} className="add-player-form">
        <div className="add-player-field">
          <label className="add-player-label">Division</label>
          <select
            className="add-player-select"
            value={division}
            onChange={(e) => setDivision(e.target.value)}
          >
            {divisions.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <div className="add-player-field">
          <label className="add-player-label">Jersey Number</label>
          <input
            className="add-player-input"
            type="text"
            value={jerseyNumber}
            onChange={(e) => { setJerseyNumber(e.target.value); setError(null) }}
            placeholder="e.g. 99"
          />
        </div>

        <div className="add-player-field">
          <label className="add-player-label">Name</label>
          <input
            className="add-player-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Player name"
          />
        </div>

        <div className="add-player-field">
          <label className="add-player-label">Position</label>
          <div className="add-player-position-selector">
            {POSITIONS.map((pos) => (
              <button
                key={pos}
                type="button"
                className={
                  position === pos
                    ? "add-player-position-btn add-player-position-btn-active"
                    : "add-player-position-btn"
                }
                onClick={() => setPosition(pos)}
              >
                {pos}
              </button>
            ))}
          </div>
        </div>

        <div className="add-player-field">
          <label className="add-player-label">Previous Team</label>
          <input
            className="add-player-input"
            type="text"
            value={previousTeam}
            onChange={(e) => setPreviousTeam(e.target.value)}
            placeholder="Optional"
          />
        </div>

        {error && <p className="add-player-error">{error}</p>}

        <button
          type="submit"
          className="add-player-submit"
          disabled={submitting}
        >
          {submitting ? "Adding..." : "Add Player"}
        </button>
      </form>
    </div>
  )
}
