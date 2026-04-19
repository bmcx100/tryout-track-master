"use client"

import { useRef, useState, useEffect } from "react"

type ViewToggleProps = {
  activeView: "predictions" | "previous"
  onViewChange: (view: "predictions" | "previous") => void
}

const VIEWS = [
  { label: "Predictions", value: "predictions" as const },
  { label: "Previous Teams", value: "previous" as const },
]

export function ViewToggle({ activeView, onViewChange }: ViewToggleProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [pill, setPill] = useState({ left: 0, width: 0 })

  const activeIndex = VIEWS.findIndex((v) => v.value === activeView)

  useEffect(() => {
    const btn = btnRefs.current[activeIndex]
    const container = containerRef.current
    if (!btn || !container) return
    const cRect = container.getBoundingClientRect()
    const bRect = btn.getBoundingClientRect()
    setPill({ left: bRect.left - cRect.left, width: bRect.width })
  }, [activeIndex])

  return (
    <div className="view-toggle" ref={containerRef}>
      <div
        className="view-toggle-pill"
        style={{ left: pill.left, width: pill.width }}
      />
      {VIEWS.map((view, i) => (
        <button
          key={view.value}
          ref={(el) => { btnRefs.current[i] = el }}
          className={activeView === view.value ? "view-toggle-btn active" : "view-toggle-btn"}
          onClick={() => onViewChange(view.value)}
        >
          {view.label}
        </button>
      ))}
    </div>
  )
}
