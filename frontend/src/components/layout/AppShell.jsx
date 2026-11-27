import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown, CircleUserRound, LogOut } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useTranslation } from '../../utils/i18n'
import { ROLE_LABELS } from '../../utils/roles'
import { getThemePreference } from '../../utils/theme'
import { MobileNav } from './MobileNav'
import { Sidebar } from './Sidebar'

const PAGE_HEADERS = {
  '/': { title: 'Dashboard', subtitle: 'Live Laboratory Overview' },
  '/sessions': { title: 'Lab Schedules', subtitle: 'Choose a classroom to view its schedule.' },
  '/assets': { title: 'Inventory', subtitle: 'Manage hardware assets, software, and subscriptions.' },
  '/users': { title: 'Users & Roster', subtitle: 'Manage accounts and system access.' },
  '/profile': { title: 'Profile Settings', subtitle: 'Account information and preferences.' },
}

export function AppShell() {
  const { user, logout } = useAuth()
  const { t } = useTranslation()
  const [profileOpen, setProfileOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const profileRef = useRef(null)
  const navigate = useNavigate()
  const location = useLocation()
  const pageHeader = PAGE_HEADERS[location.pathname]

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const applyTheme = () => {
      const preference = getThemePreference()
      const resolved =
        preference === 'system' ? (media.matches ? 'dark' : 'light') : preference
      document.documentElement.dataset.theme = resolved
    }
    applyTheme()
    media.addEventListener?.('change', applyTheme)
    return () => media.removeEventListener?.('change', applyTheme)
  }, [])

  useEffect(() => {
    const handleNavigation = (event) => {
      const link = event.target.closest('a')
      if (!link || !window.__profileDirty) return

      const destination = new URL(link.href, window.location.origin)
      if (destination.pathname === '/profile') return
      if (!window.confirm(t('Discard unsaved changes?'))) {
        event.preventDefault()
        event.stopPropagation()
      } else {
        window.__profileDirty = false
      }
    }
    document.addEventListener('click', handleNavigation, true)
    return () => document.removeEventListener('click', handleNavigation, true)
  }, [t])

  const initials = user?.full_name
    ?.split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'U'

  const profileMenu = (
    <div className="relative" ref={profileRef}>
      <button
        type="button"
        onClick={() => setProfileOpen((open) => !open)}
        className="flex items-center gap-2 rounded-lg p-1.5 text-evergreen transition-colors hover:bg-palm-leaf/20"
        aria-expanded={profileOpen}
        aria-haspopup="menu"
      >
        {user?.profile_photo_url ? (
          <img
            src={user.profile_photo_url}
            alt={user.full_name || t('Profile')}
            className="h-9 w-9 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-hunter-green text-sm font-bold text-cornsilk">
            {initials}
          </span>
        )}
        <ChevronDown className="h-4 w-4" />
      </button>

      {profileOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-palm-leaf/30 bg-white py-2 shadow-xl"
        >
          <div className="border-b border-palm-leaf/20 px-4 pb-3">
            <p className="truncate text-sm font-bold text-evergreen">{user?.full_name}</p>
            <p className="mt-0.5 text-xs text-hunter-green">{t(ROLE_LABELS[user?.role] || user?.role)}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setProfileOpen(false)
              navigate('/profile')
            }}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium text-evergreen hover:bg-cornsilk/60"
          >
            <CircleUserRound className="h-4 w-4 text-hunter-green" />
            {t('Profile Settings')}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={logout}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            {t('Sign Out')}
          </button>
        </div>
      )}
    </div>
  )

  return (
    <div className="flex min-h-screen bg-cornsilk/40">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((collapsed) => !collapsed)}
      />
      <div className="flex flex-1 flex-col pb-16 md:pb-0">
        <header className="flex h-[72px] items-center justify-between border-b border-palm-leaf/30 bg-cornsilk px-4 md:px-8">
          {pageHeader ? (
            <div>
              <p className="text-xl font-bold leading-tight text-evergreen">{t(pageHeader.title)}</p>
              <p className="mt-0.5 text-xs text-hunter-green">{t(pageHeader.subtitle)}</p>
            </div>
          ) : (
            <div />
          )}
          {profileMenu}
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
      <MobileNav />

    </div>
  )
}