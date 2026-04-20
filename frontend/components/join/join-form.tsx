"use client"

import { useState } from "react"
import { joinAssociation } from "@/app/(app)/join/actions"

interface Association {
  id: string
  name: string
  abbreviation: string
}

export function JoinForm({ associations }: { associations: Association[] }) {
  const [error, setError] = useState<string | null>(null)
  const [joiningId, setJoiningId] = useState<string | null>(null)

  async function handleJoin(associationId: string) {
    setJoiningId(associationId)
    setError(null)

    const result = await joinAssociation(associationId)
    if (result?.error) {
      setError(result.error)
      setJoiningId(null)
    }
    // On success, the server action redirects to /dashboard
  }

  if (associations.length === 0) {
    return (
      <p className="join-empty">
        No associations are currently accepting new&nbsp;members.
      </p>
    )
  }

  return (
    <div className="join-list">
      {associations.map((assoc) => (
        <button
          key={assoc.id}
          className="join-card"
          onClick={() => handleJoin(assoc.id)}
          disabled={joiningId !== null}
        >
          <span className="join-card-abbr">{assoc.abbreviation}</span>
          <span className="join-card-name">{assoc.name}</span>
          {joiningId === assoc.id && (
            <span className="join-card-loading">Joining...</span>
          )}
        </button>
      ))}
      {error && <p className="join-error" dangerouslySetInnerHTML={{ __html: error }} />}
    </div>
  )
}
