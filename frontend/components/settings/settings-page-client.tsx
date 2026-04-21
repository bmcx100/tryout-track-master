"use client"

import { useSyncExternalStore } from "react"
import Link from "next/link"
import { ChevronRight, LogOut, Scan, FileCheck, UserPlus, HelpCircle } from "lucide-react"
import { setOnboardingDisabled } from "@/components/shared/onboarding-manager"

const DISABLED_KEY = "onboarding-disabled"
const CHANGE_EVENT = "onboarding-change"

function getDisabledSnapshot(): boolean {
  try {
    return localStorage.getItem(DISABLED_KEY) === "true"
  } catch {
    return false
  }
}

function getDisabledServerSnapshot(): boolean {
  return false
}

function subscribeDisabled(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback)
  return () => window.removeEventListener(CHANGE_EVENT, callback)
}

type SettingsPageClientProps = {
  email: string
  initials: string
  role: string
  associationName: string
  associationId: string
  pendingCorrectionsCount: number
}

export function SettingsPageClient({
  email,
  initials,
  role,
  associationName,
  pendingCorrectionsCount,
}: SettingsPageClientProps) {
  const isAdmin = role === "group_admin" || role === "admin"
  const tipsDisabled = useSyncExternalStore(subscribeDisabled, getDisabledSnapshot, getDisabledServerSnapshot)

  return (
    <div className="settings-page">
      <h1 className="settings-page-title">Settings</h1>

      {/* User card */}
      <div className="settings-user-card">
        <div className="settings-avatar">{initials}</div>
        <div className="settings-user-details">
          <span className="settings-user-email">{email}</span>
          <span className="settings-user-assoc">{associationName}</span>
        </div>
      </div>

      {/* Admin section */}
      {isAdmin && (
        <section className="settings-section">
          <h2 className="settings-section-title">Admin</h2>
          <Link href="/settings/corrections" className="settings-row">
            <span className="settings-row-icon settings-row-icon-blue">
              <FileCheck size={18} />
            </span>
            <span className="settings-row-label">Corrections</span>
            {pendingCorrectionsCount > 0 && (
              <span className="corrections-card-badge">{pendingCorrectionsCount}</span>
            )}
            <ChevronRight size={16} className="settings-row-chevron" />
          </Link>
          <Link href="/settings/add-player" className="settings-row">
            <span className="settings-row-icon settings-row-icon-green">
              <UserPlus size={18} />
            </span>
            <span className="settings-row-label">Add Player</span>
            <ChevronRight size={16} className="settings-row-chevron" />
          </Link>
          <Link href="/settings/scrape" className="settings-row">
            <span className="settings-row-icon settings-row-icon-gold">
              <Scan size={18} />
            </span>
            <span className="settings-row-label">Scrape Continuations</span>
            <ChevronRight size={16} className="settings-row-chevron" />
          </Link>
        </section>
      )}

      {/* Preferences section */}
      <section className="settings-section">
        <h2 className="settings-section-title">Preferences</h2>
        <button
          className="settings-row"
          onClick={() => setOnboardingDisabled(!tipsDisabled)}
        >
          <span className="settings-row-icon settings-row-icon-gold">
            <HelpCircle size={18} />
          </span>
          <span className="settings-row-label">Show Onboarding Tips</span>
          <div className={tipsDisabled ? "settings-toggle" : "settings-toggle settings-toggle-on"} />
        </button>
      </section>

      {/* Account section */}
      <section className="settings-section">
        <h2 className="settings-section-title">Account</h2>
        <Link href="/logout" className="settings-row settings-row-danger">
          <span className="settings-row-icon settings-row-icon-red">
            <LogOut size={18} />
          </span>
          <span className="settings-row-label">Sign Out</span>
          <ChevronRight size={16} className="settings-row-chevron" />
        </Link>
      </section>
    </div>
  )
}
