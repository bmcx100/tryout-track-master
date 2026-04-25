export function SkeletonHelp() {
  return (
    <div className="skeleton-help">
      {/* Section header 1 */}
      <div className="skeleton-section-header">
        <div className="skeleton-circle" style={{ width: 20, height: 20 }} />
        <div className="skeleton-line" style={{ width: 120 }} />
      </div>

      {/* 3 help cards */}
      <HelpCardSkeleton />
      <HelpCardSkeleton />
      <HelpCardSkeleton />

      {/* Section header 2 */}
      <div className="skeleton-section-header" style={{ paddingTop: 32 }}>
        <div className="skeleton-circle" style={{ width: 20, height: 20 }} />
        <div className="skeleton-line" style={{ width: 100 }} />
      </div>

      {/* 3 more help cards */}
      <HelpCardSkeleton />
      <HelpCardSkeleton />
      <HelpCardSkeleton />
    </div>
  )
}

function HelpCardSkeleton() {
  return (
    <div className="skeleton-help-card">
      <div className="skeleton-block" style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 8 }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        <div className="skeleton-line" style={{ width: "60%" }} />
        <div className="skeleton-line-short" style={{ width: "90%" }} />
      </div>
    </div>
  )
}
