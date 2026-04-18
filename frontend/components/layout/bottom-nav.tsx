"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Circle, MoreHorizontal } from "lucide-react"

const tabs = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/teams", label: "Teams", icon: Circle },
  { href: "#", label: "More", icon: MoreHorizontal },
] as const

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="bottom-nav">
      {tabs.map((tab) => {
        const isActive = pathname.startsWith(tab.href) && tab.href !== "#"
        return (
          <Link
            key={tab.label}
            href={tab.href}
            className={isActive ? "bottom-nav-item-active" : "bottom-nav-item"}
          >
            <tab.icon className="bottom-nav-icon" />
            <span>{tab.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
