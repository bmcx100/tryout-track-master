"use client"

import { useCallback, useTransition, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Home, Users, ListChecks, HelpCircle } from "lucide-react"
import { useNavLoading } from "@/components/shared/nav-loading-provider"

const tabs = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/help", label: "Help", icon: HelpCircle },
  { href: "/teams", label: "Teams", icon: Users },
  { href: "/continuations", label: "Sessions", icon: ListChecks },
] as const

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const { targetHref, startNavigation, endNavigation } = useNavLoading()

  const handleTap = useCallback((e: React.MouseEvent, href: string) => {
    e.preventDefault()
    if (pathname.startsWith(href)) return
    startNavigation(href)
    startTransition(() => {
      router.push(href)
    })
  }, [pathname, router, startNavigation, startTransition])

  // End navigation when transition completes
  useEffect(() => {
    if (!isPending && targetHref) {
      endNavigation()
    }
  }, [isPending, targetHref, endNavigation])

  // Determine active tab: use targetHref during navigation for optimistic highlight
  const activeBase = targetHref ?? pathname

  return (
    <nav className="bottom-nav">
      {tabs.map((tab) => {
        const isActive = activeBase.startsWith(tab.href)
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
