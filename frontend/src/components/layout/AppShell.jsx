import { Outlet } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { MobileNav } from './MobileNav'
import { Sidebar } from './Sidebar'

export function AppShell() {
  const { user, logout } = useAuth()

  return (
    <div className="flex min-h-screen bg-cornsilk/40">
      <Sidebar />
      <div className="flex flex-1 flex-col pb-16 md:pb-0">
        {/* Mobile top header */}
        <header className="flex items-center justify-between border-b border-palm-leaf/30 bg-evergreen px-4 py-3 text-cornsilk md:hidden">
          <div>
            <p className="text-sm font-bold">SLU LabSys</p>
            <p className="text-xs text-lime-cream">{user?.full_name}</p>
          </div>
          <button
            onClick={logout}
            className="rounded-lg p-2 text-cream hover:bg-hunter-green"
            title="Sign Out"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
      <MobileNav />
    </div>
  )
}