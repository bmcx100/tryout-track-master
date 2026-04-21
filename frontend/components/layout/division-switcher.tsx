"use client"

import { useState, useEffect, useCallback, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import Link from "next/link"
import { setActiveDivision } from "@/app/(app)/division/actions"
import { setActiveAssociation } from "@/app/(app)/association/actions"

type Association = {
  id: string
  name: string
  abbreviation: string
}

type DivisionSwitcherProps = {
  divisions: { division: string, playerCount: number }[]
  activeDivision: string
  associationId: string
  abbreviation: string
  initials: string
  title?: string
  hasPendingCorrections?: boolean
  associations: Association[]
}

export function DivisionSwitcher({
  divisions,
  activeDivision,
  associationId,
  abbreviation,
  initials,
  title = "Teams",
  hasPendingCorrections,
  associations,
}: DivisionSwitcherProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const label = `${abbreviation}-${activeDivision}`

  const handleSelectDivision = (division: string) => {
    setOpen(false)
    if (division === activeDivision) return
    startTransition(async () => {
      await setActiveDivision(associationId, division)
      router.refresh()
    })
  }

  const handleSelectAssociation = (assocId: string) => {
    if (assocId === associationId) return
    setOpen(false)
    startTransition(async () => {
      await setActiveAssociation(assocId)
      router.refresh()
    })
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
        <button className="division-badge" onClick={() => setOpen(true)} disabled={isPending}>
          {isPending ? <Loader2 className="division-badge-spinner" /> : null}
          {label}
        </button>
        <span className="app-header-title">{title}</span>
        <Link href="/settings" className={hasPendingCorrections ? "app-header-avatar avatar-badge" : "app-header-avatar"}>
          {initials}
        </Link>
      </header>

      {open && (
        <>
          <div className="division-overlay" onClick={() => setOpen(false)} />
          <div className="division-sheet">
            <div className="division-sheet-handle" />

            <h2 className="division-sheet-title">Select Association</h2>
            <div className="division-options">
              {associations.map((a) => (
                <button
                  key={a.id}
                  className={`division-option ${a.id === associationId ? "division-option-active" : ""}`}
                  onClick={() => handleSelectAssociation(a.id)}
                >
                  <div className="division-option-info">
                    <span className="assoc-option-abbr">{a.abbreviation}</span>
                    <span className="division-option-count">{a.name}</span>
                  </div>
                  <div className={`division-option-radio ${a.id === associationId ? "division-option-radio-checked" : ""}`} />
                </button>
              ))}
            </div>
            <div className="division-sheet-divider" />

            <h2 className="division-sheet-title">Select Division</h2>
            <div className="division-options">
              {divisions.map((d) => (
                <button
                  key={d.division}
                  className={`division-option ${d.division === activeDivision ? "division-option-active" : ""}`}
                  onClick={() => handleSelectDivision(d.division)}
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
