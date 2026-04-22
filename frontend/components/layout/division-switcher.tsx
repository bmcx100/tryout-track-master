"use client"

import { useState, useEffect, useCallback, useTransition } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Loader2 } from "lucide-react"
import Link from "next/link"
import { ExternalLink } from "lucide-react"
import { getDivisions, setActiveDivision } from "@/app/(app)/division/actions"
import { setActiveAssociation } from "@/app/(app)/association/actions"
import { getContinuationsUrl } from "@/app/(app)/continuations/scraper-actions"

const SCHEDULE_URLS: Record<string, string> = {
  "a1000000-0000-0000-0000-000000000001": "https://gowildcats.ca/content/2026-u11-u18-tryout-schedule",
  "9ba699fa-0b0c-454b-9d2b-a5489378dd56": "https://ogha.org/content/competitive-tryout-schedule",
}

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
  const [continuationsUrl, setContinuationsUrl] = useState<string | null>(null)
  const [showLinks, setShowLinks] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  const label = `${abbreviation}-${activeDivision}`
  const title = TITLE_MAP[Object.keys(TITLE_MAP).find((key) => pathname.startsWith(key)) ?? ""] ?? "Teams"

  const fetchContinuationsUrl = async (assocId: string, division: string) => {
    const { url } = await getContinuationsUrl(assocId, division)
    setContinuationsUrl(url)
  }

  const handleOpen = () => {
    setPendingAssocId(associationId)
    setPendingDivision(activeDivision)
    setVisibleDivisions(divisions)
    fetchContinuationsUrl(associationId, activeDivision)
    setOpen(true)
  }

  const handleSelectDivision = (division: string) => {
    setPendingDivision(division)
    fetchContinuationsUrl(pendingAssocId, division)
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
    const firstDiv = fetched.length > 0 ? fetched[0].division : ""
    setPendingDivision(firstDiv)
    if (firstDiv) fetchContinuationsUrl(assocId, firstDiv)
    else setContinuationsUrl(null)
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
            <div className="division-sheet-top">
              <div className="division-sheet-handle" />
              <button className="division-sheet-links-btn" onClick={() => setShowLinks(true)}>
                links
              </button>
            </div>

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

      {showLinks && (
        <>
          <div className="division-overlay" style={{ zIndex: 10001 }} onClick={() => setShowLinks(false)} />
          <div className="division-links-modal">
            <h3 className="division-links-title">
              {(associations.find((a) => a.id === pendingAssocId)?.abbreviation ?? "").toUpperCase()} Links
            </h3>
            <div className="division-sheet-links">
              {continuationsUrl && (
                <a href={continuationsUrl} target="_blank" rel="noopener noreferrer" className="division-sheet-link">
                  <span className="division-link-row">
                    {pendingDivision} Continuations
                    <ExternalLink size={11} />
                  </span>
                  <span className="division-link-domain">
                    {continuationsUrl.replace(/^https?:\/\//, "").split("/")[0]}
                  </span>
                </a>
              )}
              {SCHEDULE_URLS[pendingAssocId] && (
                <a href={SCHEDULE_URLS[pendingAssocId]} target="_blank" rel="noopener noreferrer" className="division-sheet-link">
                  <span className="division-link-row">
                    Tryout Schedule
                    <ExternalLink size={11} />
                  </span>
                  <span className="division-link-domain">
                    {SCHEDULE_URLS[pendingAssocId].replace(/^https?:\/\//, "").split("/")[0]}
                  </span>
                </a>
              )}
            </div>
            <button className="division-links-close" onClick={() => setShowLinks(false)}>
              Close
            </button>
          </div>
        </>
      )}
    </>
  )
}
