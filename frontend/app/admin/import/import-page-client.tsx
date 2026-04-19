"use client"

import { useState } from "react"
import { CsvUpload, type ParsedPlayer } from "@/components/import/csv-upload"
import { ImportPreview } from "@/components/import/import-preview"
import { importPlayers } from "./actions"

type ImportPageClientProps = {
  associationId: string
}

export function ImportPageClient({ associationId }: ImportPageClientProps) {
  const [parsedRows, setParsedRows] = useState<ParsedPlayer[] | null>(null)

  function handleReset() {
    setParsedRows(null)
  }

  async function handleConfirm(rows: ParsedPlayer[]) {
    return await importPlayers(associationId, rows)
  }

  if (!parsedRows) {
    return <CsvUpload onParsed={setParsedRows} />
  }

  return (
    <ImportPreview
      rows={parsedRows}
      onConfirm={handleConfirm}
      onReset={handleReset}
    />
  )
}
