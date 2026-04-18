import Link from "next/link"

type TeamsHeaderProps = {
  groupLabel: string
  initials: string
}

export function TeamsHeader({ groupLabel, initials }: TeamsHeaderProps) {
  return (
    <header className="app-header">
      <span className="app-header-group-label">{groupLabel}</span>
      <span className="app-header-title">Teams</span>
      <Link href="/settings" className="app-header-avatar">{initials}</Link>
    </header>
  )
}
