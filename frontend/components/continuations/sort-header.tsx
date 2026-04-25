"use client"

export type SortColumn = "jersey" | "position" | "name" | "notes" | "favorite" | "prevTeam"
export type SortDirection = "asc" | "desc"
export type SortConfig = { column: SortColumn; direction: SortDirection } | null

type SortHeaderProps = {
  sortConfig: SortConfig
  onSort: (column: SortColumn) => void
}

function SortIndicator({ column, sortConfig }: { column: SortColumn; sortConfig: SortConfig }) {
  if (!sortConfig || sortConfig.column !== column) return null
  return (
    <span className="sort-arrow">
      {sortConfig.direction === "asc" ? "▲" : "▼"}
    </span>
  )
}

export function SortHeader({ sortConfig, onSort }: SortHeaderProps) {
  return (
    <div className="sort-header">
      <span className="sort-header-handle" />
      <button className="sort-header-col sort-header-jersey" onClick={() => onSort("jersey")}>
        # <SortIndicator column="jersey" sortConfig={sortConfig} />
      </button>
      <button className="sort-header-col sort-header-pos" onClick={() => onSort("position")}>
        Pos <SortIndicator column="position" sortConfig={sortConfig} />
      </button>
      <button className="sort-header-col sort-header-name" onClick={() => onSort("name")}>
        Name <SortIndicator column="name" sortConfig={sortConfig} />
      </button>
      <span className="sort-header-right">
        <span className="sort-header-spacer" />
        <span className="sort-header-spacer" />
        <button className="sort-header-col sort-header-team" onClick={() => onSort("prevTeam")}>
          Team <SortIndicator column="prevTeam" sortConfig={sortConfig} />
        </button>
      </span>
    </div>
  )
}
