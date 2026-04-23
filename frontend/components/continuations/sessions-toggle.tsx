"use client"

import { useRef, useState, useEffect } from "react"

type SessionsToggleProps = {
  activeView: "continuing" | "cuts"
  onViewChange: (view: "continuing" | "cuts") => void
  continuingCount: number
  cutCount: number
  isFinalTeam?: boolean
}

const VIEWS = [
  { label: "Continuing", value: "continuing" as const },
  { label: "Cuts", value: "cuts" as const },
]

const FINAL_VIEWS = [
  { label: "Final Roster", value: "continuing" as const },
  { label: "Final Cuts", value: "cuts" as const },
]

export function SessionsToggle({ activeView, onViewChange, continuingCount, cutCount, isFinalTeam }: SessionsToggleProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [pill, setPill] = useState({ left: 0, width: 0 })

  const views = isFinalTeam ? FINAL_VIEWS : VIEWS
  const activeIndex = views.findIndex((v) => v.value === activeView)

  const counts = [continuingCount, cutCount]

  useEffect(() => {
    const btn = btnRefs.current[activeIndex]
    const container = containerRef.current
    if (!btn || !container) return
    const cRect = container.getBoundingClientRect()
    const bRect = btn.getBoundingClientRect()
    setPill({ left: bRect.left - cRect.left, width: bRect.width })
  }, [activeIndex])

  return (
    <div className="sessions-toggle" ref={containerRef}>
      <div
        className="sessions-toggle-pill"
        style={{ left: pill.left, width: pill.width }}
      />
      {views.map((view, i) => (
        <button
          key={view.value}
          ref={(el) => { btnRefs.current[i] = el }}
          className={activeView === view.value ? "sessions-toggle-btn active" : "sessions-toggle-btn"}
          onClick={() => onViewChange(view.value)}
        >
          {view.label} ({counts[i]})
        </button>
      ))}
    </div>
  )
}
