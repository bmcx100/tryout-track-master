"use client"

import { useState, useEffect, useCallback, useSyncExternalStore } from "react"
import { OnboardingTooltip } from "@/components/shared/onboarding-tooltip"

const STORAGE_KEY = "onboarding-dismissed"
const DISABLED_KEY = "onboarding-disabled"
const CHANGE_EVENT = "onboarding-change"

type DismissedState = {
  "division-switcher"?: boolean
  "sessions-tab"?: boolean
}

type Step = "tooltip1" | "tooltip2" | "done"

function getDismissed(): DismissedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function isDisabled(): boolean {
  try {
    return localStorage.getItem(DISABLED_KEY) === "true"
  } catch {
    return false
  }
}

function setDismissed(state: DismissedState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function setOnboardingDisabled(disabled: boolean) {
  if (disabled) {
    localStorage.setItem(DISABLED_KEY, "true")
  } else {
    localStorage.removeItem(DISABLED_KEY)
    localStorage.removeItem(STORAGE_KEY)
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

function getSnapshot(): Step {
  if (isDisabled()) return "done"
  const dismissed = getDismissed()
  if (dismissed["division-switcher"] && dismissed["sessions-tab"]) return "done"
  if (dismissed["division-switcher"]) return "tooltip2"
  return "tooltip1"
}

function getServerSnapshot(): Step {
  return "done"
}

function subscribe(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback)
  return () => window.removeEventListener(CHANGE_EVENT, callback)
}

export function OnboardingManager() {
  const step = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const [showOptOut, setShowOptOut] = useState(false)
  const [waitingForClose, setWaitingForClose] = useState(false)

  const handleDismiss1 = useCallback(() => {
    const dismissed = getDismissed()
    setDismissed({ ...dismissed, "division-switcher": true })
    setWaitingForClose(false)
  }, [])

  const handleBadgeClick = useCallback(() => {
    setWaitingForClose(true)
  }, [])

  // Wait for the division sheet to open then close before advancing
  useEffect(() => {
    if (!waitingForClose) return

    let phase: "waiting-for-open" | "waiting-for-close" = "waiting-for-open"

    const check = () => {
      const sheetExists = !!document.querySelector(".division-sheet")
      if (phase === "waiting-for-open" && sheetExists) {
        phase = "waiting-for-close"
      } else if (phase === "waiting-for-close" && !sheetExists) {
        handleDismiss1()
      }
    }

    check()
    const observer = new MutationObserver(check)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => observer.disconnect()
  }, [waitingForClose, handleDismiss1])

  const handleDismiss2 = () => {
    const dismissed = getDismissed()
    setDismissed({ ...dismissed, "sessions-tab": true })
    setShowOptOut(true)
  }

  const handleOptOutYes = () => {
    setOnboardingDisabled(true)
    setShowOptOut(false)
  }

  const handleOptOutNo = () => {
    setShowOptOut(false)
  }

  if (showOptOut) {
    return (
      <>
        <div className="onboarding-overlay onboarding-overlay-active" />
        <div className="onboarding-optout">
          <p className="onboarding-optout-message">Hide tips in the future?</p>
          <div className="onboarding-optout-actions">
            <button className="onboarding-optout-yes" onClick={handleOptOutYes}>
              Yes, hide tips
            </button>
            <button className="onboarding-optout-no" onClick={handleOptOutNo}>
              Keep showing
            </button>
          </div>
        </div>
      </>
    )
  }

  if (step === "done") return null

  if (step === "tooltip1") {
    if (waitingForClose) return null
    return (
      <OnboardingTooltip
        targetSelector=".division-badge"
        message="Tap here to switch between age groups"
        position="below"
        onDismiss={handleDismiss1}
        onTargetClick={handleBadgeClick}
        persistent
      />
    )
  }

  return (
    <OnboardingTooltip
      targetSelector='.bottom-nav a[href="/continuations"]'
      message="Tap here for the latest tryout results"
      position="above"
      onDismiss={handleDismiss2}
    />
  )
}
