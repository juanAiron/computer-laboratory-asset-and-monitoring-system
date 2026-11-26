import { NavLink } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useTranslation } from '../../utils/i18n'
import { NAV_ITEMS } from './Sidebar'

export function MobileNav() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const mobileItems = NAV_ITEMS.filter((item) => item.roles.includes(user?.role)).slice(0, 5)

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-palm-leaf/30 bg-evergreen md:hidden">
      {mobileItems.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center justify-center py-2 text-[11px] font-medium ${
              isActive ? 'text-lime-cream' : 'text-cream/70'
            }`
          }
        >
          <Icon className="mb-0.5 h-5 w-5" />
          <span className="truncate">{t(label)}</span>
        </NavLink>
      ))}
    </nav>
  )
}