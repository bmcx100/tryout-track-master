"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import type { ParsedPlayer } from "./csv-upload"

type ImportPreviewProps = {
  rows: ParsedPlayer[]
  onConfirm: (rows: ParsedPlayer[]) => Promise<{ count: number, error?: string }>
  onReset: () => void
}

export function ImportPreview({ rows, onConfirm, onReset }: ImportPreviewProps) {
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ count: number, error?: string } | null>(null)

  const validRows = rows.filter((r) => !r.error)
  const errorRows = rows.filter((r) => r.error)

  async function handleConfirm() {
    setImporting(true)
    const res = await onConfirm(validRows)
    setResult(res)
    setImporting(false)
  }

  if (result) {
    return (
      <div className="import-page">
        {result.error ? (
          <p className="import-error-text">{result.error}</p>
        ) : (
          <p className="import-summary-text">
            Successfully imported {result.count} players.
          </p>
        )}
        <div className="import-actions">
          <Button onClick={onReset}>Import More</Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="import-summary">
        <span className="import-summary-text">
          {validRows.length} valid rows
        </span>
        {errorRows.length > 0 && (
          <span className="import-error-text">
            {errorRows.length} with errors (will be&nbsp;skipped)
          </span>
        )}
      </div>

      <table className="import-preview-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Jersey</th>
            <th>Division</th>
            <th>Status</th>
            <th>Prev Team</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={row.error ? "import-error-row" : ""}>
              <td>{row.name || "—"}</td>
              <td>{row.jersey_number || "—"}</td>
              <td>{row.division || "—"}</td>
              <td>{row.status || "registered"}</td>
              <td>{row.previous_team || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="import-actions">
        <Button onClick={handleConfirm} disabled={importing || validRows.length === 0}>
          {importing ? "Importing..." : `Import ${validRows.length} Players`}
        </Button>
        <Button variant="outline" onClick={onReset}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
