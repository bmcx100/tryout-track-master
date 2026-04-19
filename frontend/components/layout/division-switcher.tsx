"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { setActiveDivision } from "@/app/(app)/division/actions"

type DivisionSwitcherProps = {
  divisions: { division: string, playerCount: number }[]
  activeDivision: string
  associationId: string
  abbreviation: string
  initials: string
  title?: string
}

export function DivisionSwitcher({
  divisions,
  activeDivision,
  associationId,
  abbreviation,
  initials,
  title = "Teams",
}: DivisionSwitcherProps) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const label = `${abbreviation}-${activeDivision}`

  const handleSelect = async (division: string) => {
    setOpen(false)
    if (division === activeDivision) return
    await setActiveDivision(associationId, division)
    router.refresh()
  }

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") setOpen(false)
  }, [])

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown)
      return () => document.removeEventListener("keydown", handleKeyDown)
    }
  }, [open, handleKeyDown])

  return (
    <>
      <header className="app-header">
        <button className="division-badge" onClick={() => setOpen(true)}>
          {label}
        </button>
        <span className="app-header-title">{title}</span>
        <Link href="/settings" className="app-header-avatar">{initials}</Link>
      </header>

      {open && (
        <>
          <div className="division-overlay" onClick={() => setOpen(false)} />
          <div className="division-sheet">
            <div className="division-sheet-handle" />
            <h2 className="division-sheet-title">Select Division</h2>
            <div className="division-options">
              {divisions.map((d) => (
                <button
                  key={d.division}
                  className={`division-option ${d.division === activeDivision ? "division-option-active" : ""}`}
                  onClick={() => handleSelect(d.division)}
                >
                  <div className="division-option-info">
                    <span className="division-option-name">{d.division}</span>
                    <span className="division-option-count">
                      {d.playerCount} {d.playerCount === 1 ? "player" : "players"}
                    </span>
                  </div>
                  <div className={`division-option-radio ${d.division === activeDivision ? "division-option-radio-checked" : ""}`} />
                </button>
              ))}
            </div>
            <button className="division-cancel-btn" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </>
      )}
    </>
  )
}
