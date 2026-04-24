"use client"

import { useCallback, useState, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Home, Users, ListChecks, HelpCircle } from "lucide-react"

const tabs = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/help", label: "Help", icon: HelpCircle },
  { href: "/teams", label: "Teams", icon: Users },
  { href: "/continuations", label: "Sessions", icon: ListChecks },
] as const

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [pendingHref, setPendingHref] = useState<string | null>(null)

  const handleTap = useCallback((e: React.MouseEvent, href: string) => {
    e.preventDefault()
    if (pathname.startsWith(href)) return
    setPendingHref(href)
    router.push(href)
  }, [pathname, router])

  // Clear pending state once pathname catches up
  const isNavigating = !!(pendingHref && !pathname.startsWith(pendingHref))
  const activeHref = isNavigating ? pendingHref : null

  useEffect(() => {
    if (pendingHref && pathname.startsWith(pendingHref)) {
      setPendingHref(null)
    }
  }, [pathname, pendingHref])

  return (
    <nav className="bottom-nav">
      {tabs.map((tab) => {
        const isActive = (activeHref ? activeHref === tab.href : pathname.startsWith(tab.href))
        return (
          <a
            key={tab.label}
            href={tab.href}
            className={isActive ? "bottom-nav-item-active" : "bottom-nav-item"}
            onClick={(e) => handleTap(e, tab.href)}
          >
            <tab.icon className="bottom-nav-icon" />
            <span>{tab.label}</span>
          </a>
        )
      })}
    </nav>
  )
}
