"use client"

import { useRef, useState, useEffect } from "react"
import { RotateCcw } from "lucide-react"

type PositionFilterProps = {
  activePosition: string | null
  onPositionChange: (position: string | null) => void
  onReset: () => void
  isResetting?: boolean
  hasCustomOrder?: boolean
}

const POSITIONS = [
  { label: "All", value: null },
  { label: "F", value: "F" },
  { label: "D", value: "D" },
  { label: "G", value: "G" },
] as const

export function PositionFilter({
  activePosition,
  onPositionChange,
  onReset,
  isResetting,
  hasCustomOrder,
}: PositionFilterProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [pill, setPill] = useState({ left: 0, width: 0 })

  const activeIndex = POSITIONS.findIndex((p) => p.value === activePosition)

  useEffect(() => {
    const btn = btnRefs.current[activeIndex]
    const container = containerRef.current
    if (!btn || !container) return
    const cRect = container.getBoundingClientRect()
    const bRect = btn.getBoundingClientRect()
    setPill({ left: bRect.left - cRect.left, width: bRect.width })
  }, [activeIndex])

  const resetClass = [
    "position-reset-btn",
    hasCustomOrder ? "position-reset-active" : "",
    isResetting ? "reset-spin-wrapper" : "",
  ].filter(Boolean).join(" ")

  return (
    <div className="position-filter">
      <div className="position-filter-track" ref={containerRef}>
        <div
          className="position-filter-pill"
          style={{ left: pill.left, width: pill.width }}
        />
        {POSITIONS.map((pos, i) => {
          const isActive = activePosition === pos.value
          return (
            <button
              key={pos.label}
              ref={(el) => { btnRefs.current[i] = el }}
              className={isActive ? "position-chip active" : "position-chip"}
              onClick={() => {
                if (!isActive) onPositionChange(pos.value)
              }}
            >
              {pos.label}
            </button>
          )
        })}
      </div>
      <button className={resetClass} onClick={onReset}>
        <RotateCcw size={14} className={isResetting ? "reset-spin" : ""} />
      </button>
    </div>
  )
}
