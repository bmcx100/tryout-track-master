export function SkeletonDashboard() {
  return (
    <div className="skeleton-dashboard">
      {/* Hero cards */}
      <div className="skeleton-hero-card" />
      <div className="skeleton-hero-card" />
      <div className="skeleton-hero-card" />

      {/* Favourites section header */}
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
      <div className="skeleton-fav-card">
        <div className="skeleton-block" style={{ width: 44, height: 32 }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="skeleton-line" style={{ width: "65%" }} />
          <div className="skeleton-line-short" style={{ width: "45%" }} />
        </div>
      </div>
    </div>
  )
}
