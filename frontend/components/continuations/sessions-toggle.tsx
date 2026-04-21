"use client"

import { useRef, useState, useEffect } from "react"

type SessionsToggleProps = {
  activeView: "continuing" | "cuts"
  onViewChange: (view: "continuing" | "cuts") => void
  continuingCount: number
  cutCount: number
}

const VIEWS = [
  { label: "Continuing", value: "continuing" as const },
  { label: "Cuts", value: "cuts" as const },
]

export function SessionsToggle({ activeView, onViewChange, continuingCount, cutCount }: SessionsToggleProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [pill, setPill] = useState({ left: 0, width: 0 })

  const activeIndex = VIEWS.findIndex((v) => v.value === activeView)

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
      {VIEWS.map((view, i) => (
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
