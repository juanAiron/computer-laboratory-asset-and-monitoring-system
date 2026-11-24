import { NavLink } from 'react-router-dom'
import {
  ClipboardCheck,
  FileSpreadsheet,
  HandHelping,
  LayoutDashboard,
  Monitor,
  Package,
  QrCode,
  ScanLine,
  Server,
  Users,
  Wrench,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { ROLES } from '../../utils/roles'

export const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: Object.values(ROLES) },
  { to: '/check-in', label: 'PC Check-In', icon: QrCode, roles: [ROLES.STUDENT, ROLES.INSTRUCTOR, ROLES.CUSTODIAN, ROLES.TRIL_ADMIN] },
  { to: '/labs', label: 'Computer Labs', icon: Monitor, roles: Object.values(ROLES) },
  { to: '/sessions', label: 'Lab Schedules', icon: ClipboardCheck, roles: [ROLES.INSTRUCTOR, ROLES.CUSTODIAN, ROLES.TRIL_ADMIN] },
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

export function Sidebar() {
  const { user } = useAuth()
  const visibleItems = NAV_ITEMS.filter(
    (item) => user?.role === ROLES.SUPER_ADMIN || item.roles.includes(user?.role),
  )

  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-evergreen text-cornsilk md:flex">
      <div className="border-b border-hunter-green/60 px-5 py-4">
        <div className="w-full leading-tight">
          <p className="whitespace-nowrap text-center font-display text-[21px] font-bold uppercase leading-none text-cornsilk">CIS TRIL PORTAL</p>
          <p className="mt-1.5 text-center font-montserrat text-[9px] font-medium uppercase tracking-wide text-lime-cream">Asset Management System</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {visibleItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-fern text-cornsilk shadow-sm'
                  : 'text-cream/80 hover:bg-hunter-green/60 hover:text-cornsilk'
              }`
            }
          >
            <Icon className="h-4 w-4 shrink-0 text-lime-cream" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}