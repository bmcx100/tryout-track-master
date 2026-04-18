import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function LandingPage() {
  return (
    <main className="landing-main">
      <div className="landing-content">
        <h1 className="landing-title">Track Master</h1>
        <p className="landing-subtitle">
          Hockey tryout tracking for&nbsp;parents
          and&nbsp;associations
        </p>
        <div className="landing-actions">
          <Button asChild>
            <Link href="/login">Log In</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/signup">Sign Up</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
