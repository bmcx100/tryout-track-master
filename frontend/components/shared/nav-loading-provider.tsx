"use client"

import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react"
import { SkeletonDashboard } from "@/components/shared/skeleton-dashboard"
import { SkeletonHelp } from "@/components/shared/skeleton-help"
import { SkeletonTeams } from "@/components/shared/skeleton-teams"
import { SkeletonSessions } from "@/components/shared/skeleton-sessions"

interface NavLoadingContextValue {
  isPending: boolean
  targetHref: string | null
  startNavigation: (href: string) => void
  endNavigation: () => void
}

const NavLoadingContext = createContext<NavLoadingContextValue>({
  isPending: false,
  targetHref: null,
  startNavigation: () => {},
  endNavigation: () => {},
})

export function useNavLoading() {
  return useContext(NavLoadingContext)
}

const SKELETON_MAP: Record<string, React.ComponentType> = {
  "/dashboard": SkeletonDashboard,
  "/help": SkeletonHelp,
  "/teams": SkeletonTeams,
  "/continuations": SkeletonSessions,
}

const MIN_DISPLAY_MS = 150

export function NavLoadingProvider({ children }: { children: React.ReactNode }) {
  const [targetHref, setTargetHref] = useState<string | null>(null)
  const [showSkeleton, setShowSkeleton] = useState(false)
  const startTimeRef = useRef<number>(0)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null)

  const startNavigation = useCallback((href: string) => {
    setTargetHref(href)
    setShowSkeleton(true)
    startTimeRef.current = Date.now()
  }, [])

  const endNavigation = useCallback(() => {
    const elapsed = Date.now() - startTimeRef.current
    const remaining = MIN_DISPLAY_MS - elapsed

    if (remaining > 0) {
      timerRef.current = setTimeout(() => {
        setTargetHref(null)
        setShowSkeleton(false)
      }, remaining)
    } else {
      setTargetHref(null)
      setShowSkeleton(false)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <NavLoadingContext value={{ isPending: showSkeleton, targetHref, startNavigation, endNavigation }}>
      {children}
    </NavLoadingContext>
  )
}

export function NavLoadingContent({ children }: { children: React.ReactNode }) {
  const { isPending, targetHref } = useNavLoading()
  const SkeletonComponent = targetHref ? SKELETON_MAP[targetHref] : null

  if (isPending && SkeletonComponent) {
    return <SkeletonComponent />
  }

  return children
}
