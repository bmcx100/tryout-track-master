export function SkeletonTeams() {
  return (
    <div className="skeleton-teams">
      {/* View toggle bar */}
      <div style={{ padding: "4px 20px" }}>
        <div className="skeleton-toggle">
          <div className="skeleton-toggle-pill" />
          <div className="skeleton-toggle-pill" />
        </div>
      </div>

      {/* Position filter bar */}
      <div className="skeleton-filter-row">
        <div className="skeleton-block" style={{ width: 150, height: 28, borderRadius: 12 }} />
      </div>

      {/* Instruction line placeholder */}
      <div style={{ padding: "4px 20px 12px", display: "flex", justifyContent: "center" }}>
        <div className="skeleton-line" style={{ width: 180 }} />
      </div>

      {/* Team groups */}
      <TeamGroupSkeleton rows={5} />
      <TeamGroupSkeleton rows={5} />
      <TeamGroupSkeleton rows={4} />
    </div>
  )
}

function TeamGroupSkeleton({ rows }: { rows: number }) {
  return (
    <>
      <div className="skeleton-team-header">
        <div className="skeleton-line" style={{ width: 100 }} />
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
