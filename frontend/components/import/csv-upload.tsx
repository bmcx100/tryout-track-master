"use client"

import { useCallback, useRef, useState } from "react"
import { Upload } from "lucide-react"

export type ParsedPlayer = {
  name: string
  jersey_number: string
  division: string
  status: string
  previous_team: string
  error?: string
}

type CsvUploadProps = {
  onParsed: (rows: ParsedPlayer[]) => void
}

const VALID_STATUSES = [
  "registered",
  "trying_out",
  "cut",
  "made_team",
  "moved_up",
  "moved_down",
  "withdrew",
]

function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ",") {
        fields.push(current.trim())
        current = ""
      } else {
        current += char
      }
    }
  }
  fields.push(current.trim())
  return fields
}

function validateRow(row: ParsedPlayer): ParsedPlayer {
  const errors: string[] = []
  if (!row.name) errors.push("name is required")
  if (!row.jersey_number) errors.push("jersey_number is required")
  if (!row.division) errors.push("division is required")
  if (row.status && !VALID_STATUSES.includes(row.status)) {
    errors.push(`invalid status: ${row.status}`)
  }
  return {
    ...row,
    status: row.status || "registered",
    error: errors.length > 0 ? errors.join(", ") : undefined,
  }
}

export function CsvUpload({ onParsed }: CsvUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const lines = text.split(/\r?\n/).filter((l) => l.trim())
      if (lines.length < 2) return

      const headerFields = parseCsvLine(lines[0]).map((h) =>
        h.toLowerCase().replace(/\s+/g, "_")
      )

      const nameIdx = headerFields.indexOf("name")
      const jerseyIdx = headerFields.indexOf("jersey_number")
      const divIdx = headerFields.indexOf("division")
      const statusIdx = headerFields.indexOf("status")
      const prevIdx = headerFields.indexOf("previous_team")

      if (nameIdx === -1 || jerseyIdx === -1 || divIdx === -1) {
        onParsed([{
          name: "",
          jersey_number: "",
          division: "",
          status: "",
          previous_team: "",
          error: "CSV must have columns: name, jersey_number, division",
        }])
        return
      }

      const rows = lines.slice(1).map((line) => {
        const fields = parseCsvLine(line)
        return validateRow({
          name: fields[nameIdx] ?? "",
          jersey_number: fields[jerseyIdx] ?? "",
          division: fields[divIdx] ?? "",
          status: fields[statusIdx] ?? "",
          previous_team: fields[prevIdx] ?? "",
        })
      })

      onParsed(rows)
    }
    reader.readAsText(file)
  }, [onParsed])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files[0]
    if (file && file.name.endsWith(".csv")) handleFile(file)
  }, [handleFile])

  return (
    <div
      className={dragActive ? "csv-upload-zone csv-upload-zone-active" : "csv-upload-zone"}
      onClick={() => fileRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
    >
      <Upload size={32} className="csv-upload-icon" />
      <span className="csv-upload-label">
        Drop a CSV file here or click to&nbsp;browse
      </span>
      <span className="csv-upload-hint">
        Required columns: name, jersey_number, division
      </span>
      <input
        ref={fileRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />
    </div>
  )
}
