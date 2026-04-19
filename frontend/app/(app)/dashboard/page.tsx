import { createClient } from "@/lib/supabase/server"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="dashboard-placeholder">
      <h1 className="dashboard-placeholder-title">Home</h1>
      <p className="dashboard-placeholder-text">{user?.email}</p>
    </div>
  )
}
