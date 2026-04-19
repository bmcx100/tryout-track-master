import Link from "next/link"

type TeamsHeaderProps = {
  groupLabel: string
  division?: string
  initials: string
  title?: string
}

export function TeamsHeader({ groupLabel, division, initials, title = "Teams" }: TeamsHeaderProps) {
  const label = division ? `${groupLabel}-${division}` : groupLabel

  return (
    <header className="app-header">
      <span className="app-header-group-label">{label}</span>
      <span className="app-header-title">{title}</span>
      <Link href="/settings" className="app-header-avatar">{initials}</Link>
    </header>
  )
}
