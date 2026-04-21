"use client"

import { useEffect, useCallback, useRef } from "react"
import { X } from "lucide-react"

type OnboardingTooltipProps = {
  targetSelector: string
  message: string
  position: "below" | "above"
  onDismiss: () => void
  persistent?: boolean
  onTargetClick?: () => void
}

export function OnboardingTooltip({
  targetSelector,
  message,
  position,
  onDismiss,
  persistent,
  onTargetClick,
}: OnboardingTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null)
  const arrowRef = useRef<HTMLDivElement>(null)

  const updatePosition = useCallback(() => {
    const el = document.querySelector(targetSelector)
    if (!el || !tooltipRef.current) return
    const rect = el.getBoundingClientRect()
    const tooltipWidth = 260
    const arrowCenter = rect.left + rect.width / 2
    let left = arrowCenter - tooltipWidth / 2
    left = Math.max(12, Math.min(left, window.innerWidth - tooltipWidth - 12))
    const arrowLeft = arrowCenter - left

    tooltipRef.current.style.left = `${left}px`

    if (position === "below") {
      tooltipRef.current.style.top = `${rect.bottom + 12}px`
      tooltipRef.current.style.bottom = "auto"
    } else {
      tooltipRef.current.style.bottom = `${window.innerHeight - rect.top + 12}px`
      tooltipRef.current.style.top = "auto"
    }

    tooltipRef.current.style.visibility = "visible"

    if (arrowRef.current) {
      arrowRef.current.style.left = `${arrowLeft}px`
    }
  }, [targetSelector, position])

  useEffect(() => {
    requestAnimationFrame(updatePosition)
    window.addEventListener("resize", updatePosition)

    const el = document.querySelector(targetSelector)
    if (el) {
      el.classList.add("onboarding-highlight")
    }

    const handleTargetClick = () => {
      if (onTargetClick) onTargetClick()
      else onDismiss()
    }
    if (el) {
      el.addEventListener("click", handleTargetClick)
    }

    return () => {
      window.removeEventListener("resize", updatePosition)
      if (el) {
        el.classList.remove("onboarding-highlight")
        el.removeEventListener("click", handleTargetClick)
      }
    }
  }, [updatePosition, targetSelector, persistent, onDismiss, onTargetClick])

  const isAbove = position === "above"

  return (
    <>
      <div className="onboarding-overlay" />
      <div
        ref={tooltipRef}
        className="onboarding-tooltip"
        style={{ visibility: "hidden" }}
      >
        <div
          ref={arrowRef}
          className={isAbove ? "onboarding-tooltip-arrow-down" : "onboarding-tooltip-arrow-up"}
        />
        {!persistent && (
          <button className="onboarding-tooltip-close" onClick={onDismiss}>
            <X size={14} />
          </button>
        )}
        <p className="onboarding-tooltip-message">{message}</p>
        <button className="onboarding-tooltip-dismiss" onClick={onDismiss}>
          Got it
        </button>
      </div>
    </>
  )
}
