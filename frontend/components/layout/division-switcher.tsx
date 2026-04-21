"use client"

import { useState, useEffect, useCallback, useTransition } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Loader2 } from "lucide-react"
import Link from "next/link"
import { getDivisions, setActiveDivision } from "@/app/(app)/division/actions"
import { setActiveAssociation } from "@/app/(app)/association/actions"

const TITLE_MAP: Record<string, string> = {
  "/dashboard": "Home",
  "/teams": "Teams",
  "/continuations": "Sessions",
  "/my-favourites": "My Favourites",
  "/settings": "Settings",
  "/help": "Help",
}

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
  hasPendingCorrections?: boolean
  associations: Association[]
}

export function DivisionSwitcher({
  divisions,
  activeDivision,
  associationId,
  abbreviation,
  initials,
  hasPendingCorrections,
  associations,
}: DivisionSwitcherProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [pendingAssocId, setPendingAssocId] = useState(associationId)
  const [pendingDivision, setPendingDivision] = useState(activeDivision)
  const [visibleDivisions, setVisibleDivisions] = useState(divisions)
  const [loadingDivisions, setLoadingDivisions] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  const label = `${abbreviation}-${activeDivision}`
  const title = TITLE_MAP[Object.keys(TITLE_MAP).find((key) => pathname.startsWith(key)) ?? ""] ?? "Teams"

  const handleOpen = () => {
    setPendingAssocId(associationId)
    setPendingDivision(activeDivision)
    setVisibleDivisions(divisions)
    setOpen(true)
  }

  const handleSelectDivision = (division: string) => {
    setPendingDivision(division)
  }

  const handleSelectAssociation = async (assocId: string) => {
    if (assocId === pendingAssocId) return
    setPendingAssocId(assocId)
    if (assocId === associationId) {
      setVisibleDivisions(divisions)
      setPendingDivision(activeDivision)
      return
    }
    setLoadingDivisions(true)
    const fetched = await getDivisions(assocId)
    setVisibleDivisions(fetched)
    setPendingDivision(fetched.length > 0 ? fetched[0].division : "")
    setLoadingDivisions(false)
  }

  const handleConfirm = () => {
    setOpen(false)
    const assocChanged = pendingAssocId !== associationId
    const divChanged = pendingDivision !== activeDivision
    if (!assocChanged && !divChanged) return
    startTransition(async () => {
      if (assocChanged) {
        await setActiveAssociation(pendingAssocId)
      }
      if (pendingDivision && (divChanged || assocChanged)) {
        await setActiveDivision(pendingAssocId, pendingDivision)
      }
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
        <button className="division-badge" onClick={handleOpen} disabled={isPending}>
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
                  className={`division-option ${a.id === pendingAssocId ? "division-option-active" : ""}`}
                  onClick={() => handleSelectAssociation(a.id)}
                >
                  <div className="division-option-info">
                    <span className="assoc-option-abbr">{a.abbreviation}</span>
                    <span className="division-option-count">{a.name}</span>
                  </div>
                  <div className={`division-option-radio ${a.id === pendingAssocId ? "division-option-radio-checked" : ""}`} />
                </button>
              ))}
            </div>
            <div className="division-sheet-divider" />

            <h2 className="division-sheet-title">Select Division</h2>
            <div className="division-options">
              {loadingDivisions ? (
                <div className="division-option-loading">
                  <Loader2 className="division-badge-spinner" />
                </div>
              ) : visibleDivisions.map((d) => (
                <button
                  key={d.division}
                  className={`division-option ${d.division === pendingDivision ? "division-option-active" : ""}`}
                  onClick={() => handleSelectDivision(d.division)}
                >
                  <div className="division-option-info">
                    <span className="division-option-name">{d.division}</span>
                    <span className="division-option-count">
                      {d.playerCount} {d.playerCount === 1 ? "player" : "players"}
                    </span>
                  </div>
                  <div className={`division-option-radio ${d.division === pendingDivision ? "division-option-radio-checked" : ""}`} />
                </button>
              ))}
            </div>
            <div className="division-sheet-actions">
              <button className="division-ok-btn" onClick={handleConfirm}>
                OK
              </button>
              <button className="division-cancel-btn" onClick={() => setOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
