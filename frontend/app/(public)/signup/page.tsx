"use client"

import { useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"

export default function SignupPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  async function handleGoogleSignup() {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        queryParams: { prompt: "select_account" },
      },
    })
  }

  if (success) {
    return (
      <div className="auth-form-container">
        <h1 className="auth-form-title">Check your email</h1>
        <p className="auth-footer">
          We sent a confirmation link to <strong>{email}</strong>.
          Click the link to activate your&nbsp;account.
        </p>
      </div>
    )
  }

  return (
    <div className="auth-form-container">
      <h1 className="auth-form-title">Create your account</h1>

      <Button
        variant="outline"
        className="w-full"
        onClick={handleGoogleSignup}
      >
        Continue with Google
      </Button>

      <div className="auth-divider">
        <span className="auth-divider-text">or</span>
      </div>

      <form onSubmit={handleSignup} className="auth-form">
        <div className="auth-field">
          <label htmlFor="email" className="auth-label">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="auth-input"
            placeholder="you@example.com"
          />
        </div>

        <div className="auth-field">
          <label htmlFor="password" className="auth-label">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="auth-input"
            placeholder="At least 6 characters"
          />
        </div>

        {error && <p className="auth-error">{error}</p>}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Creating account..." : "Sign Up"}
        </Button>
      </form>

      <p className="auth-footer">
        Already have an account?{" "}
        <Link href="/login" className="auth-footer-link">
          Log in
        </Link>
      </p>
    </div>
  )
}
