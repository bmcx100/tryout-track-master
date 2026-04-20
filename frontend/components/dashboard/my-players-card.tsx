import Link from "next/link"
import { Heart } from "lucide-react"

type MyPlayersCardProps = {
  count: number
}

export function MyPlayersCard({ count }: MyPlayersCardProps) {
  return (
    <Link href="/my-players" className="dashboard-link-card dashboard-link-card-second">
      <div className="dashboard-link-card-icon">
        <Heart size={20} />
      </div>
      <p className="dashboard-link-card-title">My Players</p>
      <p className="dashboard-link-card-desc">
        {count > 0
          ? `${count} tracked player${count === 1 ? "" : "s"} \u2014 hearts and&nbsp;custom&nbsp;names`
          : "Heart players or set custom names to&nbsp;track&nbsp;them"}
      </p>
    </Link>
  )
}
