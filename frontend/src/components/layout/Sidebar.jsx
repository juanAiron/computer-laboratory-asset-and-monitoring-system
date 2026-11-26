import { NavLink } from 'react-router-dom'
import {
  ClipboardCheck,
  FileSpreadsheet,
  HandHelping,
  LayoutDashboard,
  Monitor,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  QrCode,
  ScanLine,
  Server,
  Users,
  Wrench,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useTranslation } from '../../utils/i18n'
import { ROLES } from '../../utils/roles'

export const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: Object.values(ROLES) },
  { to: '/check-in', label: 'PC Check-In', icon: QrCode, roles: [ROLES.STUDENT, ROLES.INSTRUCTOR, ROLES.CUSTODIAN, ROLES.TRIL_ADMIN] },
  { to: '/labs', label: 'Computer Labs', icon: Monitor, roles: Object.values(ROLES) },
  { to: '/sessions', label: 'Lab Schedules', icon: ClipboardCheck, roles: Object.values(ROLES) },
  { to: '/scan', label: 'Quick Scan', icon: ScanLine, roles: [ROLES.CUSTODIAN, ROLES.TRIL_ADMIN] },
  { to: '/assets', label: 'Hardware Assets', icon: Server, roles: [ROLES.TRIL_ADMIN, ROLES.DEPT_HEAD, ROLES.CUSTODIAN] },
  { to: '/loans', label: 'Borrowed', icon: HandHelping, roles: [ROLES.TRIL_ADMIN, ROLES.DEPT_HEAD, ROLES.CUSTODIAN] },
  { to: '/my-loans', label: 'My Borrowed Items', icon: HandHelping, roles: [ROLES.STUDENT, ROLES.INSTRUCTOR] },
  { to: '/consumables', label: 'Consumables', icon: Package, roles: [ROLES.TRIL_ADMIN, ROLES.DEPT_HEAD, ROLES.CUSTODIAN] },
  { to: '/repairs', label: 'Repair Tickets', icon: Wrench, roles: Object.values(ROLES) },
  { to: '/counts', label: 'Inventory Audits', icon: ClipboardCheck, roles: [ROLES.CUSTODIAN, ROLES.TRIL_ADMIN] },
  { to: '/reports', label: 'Reports & QR', icon: FileSpreadsheet, roles: [ROLES.TRIL_ADMIN, ROLES.DEPT_HEAD, ROLES.CUSTODIAN] },
  { to: '/users', label: 'Users & Roster', icon: Users, roles: [ROLES.TRIL_ADMIN, ROLES.DEPT_HEAD] },
]

export function Sidebar({ collapsed = false, onToggle }) {
  const { user } = useAuth()
  const { t } = useTranslation()
  const visibleItems = NAV_ITEMS.filter(
    (item) => user?.role === ROLES.SUPER_ADMIN || item.roles.includes(user?.role),
  )

  return (
    <aside
      className={`sticky top-0 hidden h-screen shrink-0 self-start flex-col bg-evergreen text-cornsilk transition-[width] duration-300 ease-in-out motion-reduce:transition-none md:flex ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div
        className={`border-b border-hunter-green/60 py-4 transition-[padding] duration-300 ease-in-out ${
          collapsed ? 'px-2' : 'px-5'
        }`}
      >
        <div className="relative h-6 overflow-hidden leading-tight">
          <p
            className={`absolute inset-0 whitespace-nowrap text-center font-display font-bold uppercase leading-none text-cornsilk transition-opacity duration-300 ease-in-out ${
              collapsed ? 'text-[21px] opacity-0' : 'text-[21px] opacity-100'
            }`}
          >
            CIS TRIL PORTAL
          </p>
          <p
            className={`absolute inset-0 text-center font-display text-lg font-bold uppercase leading-none text-cornsilk transition-opacity duration-300 ease-in-out ${
              collapsed ? 'opacity-100' : 'opacity-0'
            }`}
          >
            CIS
          </p>
        </div>
        <p
          className={`overflow-hidden text-center font-montserrat text-[9px] font-medium uppercase tracking-wide text-lime-cream transition-[max-height,opacity,margin] duration-300 ease-in-out ${
            collapsed ? 'mt-0 max-h-0 opacity-0' : 'mt-1.5 max-h-4 opacity-100'
          }`}
        >
          {t('Asset Management System')}
        </p>
      </div>

      <nav
        className={`flex-1 space-y-1 overflow-y-auto py-4 transition-[padding] duration-300 ease-in-out ${
          collapsed ? 'px-2' : 'px-3'
        }`}
      >
        {visibleItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            aria-label={t(label)}
            title={collapsed ? t(label) : undefined}
            className={({ isActive }) =>
              `flex items-center overflow-hidden rounded-lg py-2 text-sm font-medium transition-all duration-300 ease-in-out ${
                collapsed ? 'gap-0 px-6' : 'gap-3 px-3'
              } ${
                isActive
                  ? 'bg-fern text-cornsilk shadow-sm'
                  : 'text-cream/80 hover:bg-hunter-green/60 hover:text-cornsilk'
              }`
            }
          >
            <Icon className="h-4 w-4 shrink-0 text-lime-cream" />
            <span
              aria-hidden={collapsed}
              className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity,transform] duration-300 ease-in-out ${
                collapsed
                  ? 'max-w-0 -translate-x-2 opacity-0'
                  : 'max-w-48 translate-x-0 opacity-100'
              }`}
            >
              {t(label)}
            </span>
          </NavLink>
        ))}
      </nav>
      <div className="flex shrink-0 justify-end border-t border-hunter-green/60 p-3">
        <button
          type="button"
          onClick={onToggle}
          aria-label={t(collapsed ? 'Expand sidebar' : 'Collapse sidebar')}
          aria-expanded={!collapsed}
          title={t(collapsed ? 'Expand sidebar' : 'Collapse sidebar')}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-cream/80 transition-colors hover:bg-hunter-green/60 hover:text-cornsilk focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palm-leaf"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-5 w-5" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
      </div>
    </aside>
  )
}