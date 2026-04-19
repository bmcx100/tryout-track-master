"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { joinAssociation } from "@/app/(app)/join/actions"

export function JoinForm() {
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) return
    setLoading(true)
    setError(null)

    const result = await joinAssociation(code)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
    // On success, the server action redirects to /dashboard
  }

  return (
    <form onSubmit={handleSubmit} className="join-form">
      <div className="join-input-group">
        <label htmlFor="join-code" className="join-label">Join Code</label>
        <input
          id="join-code"
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="e.g. NGHA2026"
          className="join-input"
          maxLength={20}
          autoFocus
        />
      </div>
      {error && <p className="join-error" dangerouslySetInnerHTML={{ __html: error }} />}
      <Button type="submit" className="w-full" disabled={loading || !code.trim()}>
        {loading ? "Joining..." : "Join Association"}
      </Button>
    </form>
  )
}
