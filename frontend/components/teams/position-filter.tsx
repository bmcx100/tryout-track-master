"use client"

import { useRef, useState, useEffect } from "react"
import { RotateCcw } from "lucide-react"

type PositionFilterProps = {
  activePosition: string | null
  onPositionChange: (position: string | null) => void
  onReset: () => void
  isResetting?: boolean
  hasCustomOrder?: boolean
  showUnknown?: boolean
  positionCounts?: Record<string, number>
}

const BASE_POSITIONS: { label: string, value: string | null }[] = [
  { label: "All", value: null },
  { label: "F", value: "F" },
  { label: "D", value: "D" },
  { label: "G", value: "G" },
]

export function PositionFilter({
  activePosition,
  onPositionChange,
  onReset,
  isResetting,
  hasCustomOrder,
  showUnknown,
  positionCounts,
}: PositionFilterProps) {
  const allPositions = showUnknown
    ? [...BASE_POSITIONS, { label: "?", value: "?" }]
    : BASE_POSITIONS

  // Hide ? chip when its count is 0
  const positions = positionCounts
    ? allPositions.filter((p) => p.value !== "?" || (positionCounts["?"] ?? 0) > 0)
    : allPositions

  const containerRef = useRef<HTMLDivElement>(null)
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [pill, setPill] = useState({ left: 0, width: 0 })

  const activeIndex = positions.findIndex((p) => p.value === activePosition)

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
        {positions.map((pos, i) => {
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
              {pos.value && positionCounts ? `${pos.label} (${positionCounts[pos.value] ?? 0})` : pos.label}
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
