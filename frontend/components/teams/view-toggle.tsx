"use client"

type ViewToggleProps = {
  activeView: "predictions" | "previous"
  onViewChange: (view: "predictions" | "previous") => void
}

export function ViewToggle({ activeView, onViewChange }: ViewToggleProps) {
  return (
    <div className="view-toggle">
      <button
        className={activeView === "predictions" ? "view-toggle-btn-active" : "view-toggle-btn"}
        onClick={() => onViewChange("predictions")}
      >
        Predictions
      </button>
      <button
        className={activeView === "previous" ? "view-toggle-btn-active" : "view-toggle-btn"}
        onClick={() => onViewChange("previous")}
      >
        Previous Teams
      </button>
    </div>
  )
}
