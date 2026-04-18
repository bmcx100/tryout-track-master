type TeamsHeaderProps = {
  groupLabel: string
  initials: string
}

export function TeamsHeader({ groupLabel, initials }: TeamsHeaderProps) {
  return (
    <header className="app-header">
      <span className="app-header-group-label">{groupLabel}</span>
      <span className="app-header-title">Teams</span>
      <div className="app-header-avatar">{initials}</div>
    </header>
  )
}
