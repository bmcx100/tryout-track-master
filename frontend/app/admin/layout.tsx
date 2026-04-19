import { requireAdmin } from "@/lib/auth"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { association } = await requireAdmin()

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <span className="admin-header-label">{association.abbreviation} Admin</span>
      </header>
      {children}
    </div>
  )
}
