import { BottomNav } from "@/components/layout/bottom-nav"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // TODO: Re-enable auth check when Supabase user is set up
  // const supabase = await createClient()
  // const { data: { user } } = await supabase.auth.getUser()
  // if (!user) { redirect("/login") }

  return (
    <div className="app-shell">
      {children}
      <BottomNav />
    </div>
  )
}
