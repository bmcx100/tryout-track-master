import type { TryoutPlayer } from "@/types"

type StatsBarProps = {
  players: TryoutPlayer[]
}

export function StatsBar({ players }: StatsBarProps) {
  const total = players.length
  const tryingOut = players.filter((p) => p.status === "trying_out").length
  const madeTeam = players.filter((p) => p.status === "made_team").length
  const cut = players.filter((p) => p.status === "cut").length
  const registered = players.filter((p) => p.status === "registered").length

  const stats = [
    { label: "Total", value: total },
    { label: "Trying Out", value: tryingOut },
    { label: "Made Team", value: madeTeam },
    { label: "Cut", value: cut },
    { label: "Registered", value: registered },
  ].filter((s) => s.value > 0)

  return (
    <div className="stats-bar">
      {stats.map((s) => (
        <div key={s.label} className="stat-chip">
          {s.label}<span className="stat-chip-value">{s.value}</span>
        </div>
      ))}
    </div>
  )
}
