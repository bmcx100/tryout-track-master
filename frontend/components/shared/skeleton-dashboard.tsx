export function SkeletonDashboard() {
  return (
    <div className="skeleton-dashboard">
      {/* Double-tall hero card */}
      <div className="skeleton-hero-card" style={{ height: 180 }} />

      {/* Section heading */}
      <div className="skeleton-section-header">
        <div className="skeleton-line" style={{ width: 120 }} />
      </div>

      {/* Favourite cards */}
      <div className="skeleton-fav-card">
        <div className="skeleton-block" style={{ width: 44, height: 32 }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="skeleton-line" style={{ width: "70%" }} />
          <div className="skeleton-line-short" style={{ width: "50%" }} />
        </div>
      </div>
      <div className="skeleton-fav-card">
        <div className="skeleton-block" style={{ width: 44, height: 32 }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="skeleton-line" style={{ width: "60%" }} />
          <div className="skeleton-line-short" style={{ width: "40%" }} />
        </div>
      </div>
    </div>
  )
}
