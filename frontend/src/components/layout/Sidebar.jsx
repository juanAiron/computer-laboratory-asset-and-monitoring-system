import { NavLink } from 'react-router-dom'
import {
  ClipboardCheck,
  FileSpreadsheet,
  HandHelping,
  LayoutDashboard,
  LogOut,
  Monitor,
  Package,
  QrCode,
  ScanLine,
  Server,
  Users,
  Wrench,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { ROLE_LABELS, ROLES } from '../../utils/roles'

export const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: Object.values(ROLES) },
  { to: '/check-in', label: 'PC Check-In', icon: QrCode, roles: [ROLES.STUDENT, ROLES.INSTRUCTOR, ROLES.CUSTODIAN, ROLES.TRIL_ADMIN] },
  { to: '/labs', label: 'Computer Labs', icon: Monitor, roles: Object.values(ROLES) },
  { to: '/sessions', label: 'Class Sessions', icon: ClipboardCheck, roles: [ROLES.INSTRUCTOR, ROLES.CUSTODIAN, ROLES.TRIL_ADMIN] },
  { to: '/scan', label: 'Quick Scan', icon: ScanLine, roles: [ROLES.CUSTODIAN, ROLES.TRIL_ADMIN] },
  { to: '/assets', label: 'Hardware Assets', icon: Server, roles: [ROLES.TRIL_ADMIN, ROLES.DEPT_HEAD, ROLES.CUSTODIAN] },
  { to: '/loans', label: 'Equipment Loans', icon: HandHelping, roles: [ROLES.TRIL_ADMIN, ROLES.DEPT_HEAD, ROLES.CUSTODIAN] },
  { to: '/my-loans', label: 'My Borrowed Items', icon: HandHelping, roles: [ROLES.STUDENT, ROLES.INSTRUCTOR] },
  { to: '/consumables', label: 'Consumables', icon: Package, roles: [ROLES.TRIL_ADMIN, ROLES.DEPT_HEAD, ROLES.CUSTODIAN] },
  { to: '/repairs', label: 'Repair Tickets', icon: Wrench, roles: Object.values(ROLES) },
  { to: '/counts', label: 'Inventory Audits', icon: ClipboardCheck, roles: [ROLES.CUSTODIAN, ROLES.TRIL_ADMIN] },
  { to: '/reports', label: 'Reports & QR', icon: FileSpreadsheet, roles: [ROLES.TRIL_ADMIN, ROLES.DEPT_HEAD, ROLES.CUSTODIAN] },
  { to: '/users', label: 'Users & Roster', icon: Users, roles: [ROLES.TRIL_ADMIN, ROLES.DEPT_HEAD] },
]

export function Sidebar() {
  const { user, logout } = useAuth()
  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(user?.role))

  return (
    <aside className="hidden w-64 flex-col bg-slate-900 text-slate-100 md:flex">
      <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 font-bold text-slate-950">
          SLU
        </div>
        <div>
          <p className="text-sm font-bold leading-tight">Lab Monitoring</p>
          <p className="text-xs text-slate-400">TRIL &amp; CIS Inventory</p>
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
                  ? 'bg-blue-700 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-slate-800 p-4">
        <p className="truncate text-sm font-semibold text-white">{user?.full_name}</p>
        <p className="text-xs text-amber-400">{ROLE_LABELS[user?.role] || user?.role}</p>
        <button
          onClick={logout}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-800 py-2 text-xs font-semibold text-slate-200 hover:bg-red-600 hover:text-white"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}