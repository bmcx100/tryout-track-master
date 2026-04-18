import Link from "next/link"

export default function AuthCodeError() {
  return (
    <div className="auth-error-page">
      <div className="auth-error-card">
        <h1 className="auth-error-title">Authentication Error</h1>
        <p className="auth-error-message">
          Something went wrong during authentication.
          Please try&nbsp;again.
        </p>
        <Link href="/login" className="auth-error-link">
          Back to Login
        </Link>
      </div>
    </div>
  )
}
