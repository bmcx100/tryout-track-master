export function SkeletonSessions() {
  return (
    <div className="skeleton-sessions">
      {/* Summary card / round selector */}
      <div style={{ padding: "8px 0" }}>
        <div className="skeleton-summary-card">
          <div className="skeleton-block" style={{ width: 148, height: 19, borderRadius: 8, marginLeft: 14, marginTop: 12 }} />
        </div>
      </div>

      {/* Sessions toggle bar */}
      <div style={{ padding: "8px 16px" }}>
        <div className="skeleton-toggle">
          <div className="skeleton-toggle-pill" />
          <div className="skeleton-toggle-pill" />
        </div>
      </div>

      {/* Position filter bar */}
      <div className="skeleton-filter-row">
        <div className="skeleton-block" style={{ width: 150, height: 28, borderRadius: 12 }} />
      </div>

      {/* Session groups */}
      <SessionGroupSkeleton rows={6} />
      <SessionGroupSkeleton rows={6} />
    </div>
  )
}

function SessionGroupSkeleton({ rows }: { rows: number }) {
  return (
    <>
      <div className="skeleton-session-subheader">
        <div className="skeleton-line" style={{ width: 120 }} />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <PlayerRowSkeleton key={i} />
      ))}
    </>
  )
}

function PlayerRowSkeleton() {
  return (
    <div className="skeleton-player-row">
      <div className="skeleton-block" style={{ width: 14, height: 14, borderRadius: 2 }} />
      <div className="skeleton-block" style={{ width: 32, height: 20 }} />
      <div className="skeleton-line" style={{ flex: 1, maxWidth: 140 }} />
      <div className="skeleton-line" style={{ width: 48, marginLeft: "auto" }} />
    </div>
  )
}
