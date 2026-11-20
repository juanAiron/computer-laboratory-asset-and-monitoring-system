import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, HandHelping, Monitor, Package, Wrench } from 'lucide-react'
import api from '../../api/client'
import { Loader } from '../../components/ui/Loader'
import { useAuth } from '../../hooks/useAuth'
import { ROLE_LABELS } from '../../utils/roles'

export function DashboardPage() {
  const { user } = useAuth()
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => (await api.get('/dashboard')).data,
    refetchInterval: 15000,
  })

  if (isLoading) return <Loader label="Loading laboratory metrics..." />

  const cards = [
    { label: 'Active Students in Labs', value: stats?.active_students_in_labs ?? 0, icon: Monitor, color: 'text-blue-700 bg-blue-50' },
    { label: 'Available Hardware', value: stats?.available_assets ?? 0, icon: CheckCircle2, color: 'text-emerald-700 bg-emerald-50' },
    { label: 'Borrowed Equipment', value: stats?.borrowed_assets ?? 0, icon: HandHelping, color: 'text-amber-700 bg-amber-50' },
    { label: 'Overdue Borrows', value: stats?.overdue_borrows ?? 0, icon: AlertTriangle, color: 'text-red-700 bg-red-50' },
    { label: 'Open Repair Tickets', value: stats?.open_repair_tickets ?? 0, icon: Wrench, color: 'text-orange-700 bg-orange-50' },
    { label: 'Low-Stock Consumables', value: stats?.low_stock_consumables ?? 0, icon: Package, color: 'text-purple-700 bg-purple-50' },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Welcome, {user?.full_name}</h1>
        <p className="text-sm text-slate-500">
          Role: <span className="font-semibold text-slate-700">{ROLE_LABELS[user?.role]}</span> • Live Laboratory Overview
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${color}`}>
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">{label}</p>
              <p className="text-2xl font-bold text-slate-900">{value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}