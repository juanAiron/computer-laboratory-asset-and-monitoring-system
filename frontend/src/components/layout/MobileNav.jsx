import { NavLink } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { NAV_ITEMS } from './Sidebar'

export function MobileNav() {
  const { user } = useAuth()
  const mobileItems = NAV_ITEMS.filter((item) => item.roles.includes(user?.role)).slice(0, 5)

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-slate-200 bg-white md:hidden">
      {mobileItems.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center justify-center py-2 text-[11px] font-medium ${
              isActive ? 'text-blue-700' : 'text-slate-500'
            }`
          }
        >
          <Icon className="mb-0.5 h-5 w-5" />
          <span className="truncate">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}