import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, HandHelping, Monitor, Package, Wrench } from 'lucide-react'
import api from '../../api/client'
import { Loader } from '../../components/ui/Loader'
import { useTranslation } from '../../utils/i18n'

export function DashboardPage() {
  const { t } = useTranslation()
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => (await api.get('/dashboard')).data,
    refetchInterval: 15000,
  })

  if (isLoading) return <Loader label={t('Loading laboratory metrics...')} />

  const cards = [
    { label: t('Active Students in Labs'), value: stats?.active_students_in_labs ?? 0, icon: Monitor, color: 'text-evergreen bg-lime-cream' },
    { label: t('Available Hardware'), value: stats?.available_assets ?? 0, icon: CheckCircle2, color: 'text-cornsilk bg-fern' },
    { label: t('Borrowed Equipment'), value: stats?.borrowed_assets ?? 0, icon: HandHelping, color: 'text-evergreen bg-cream' },
    { label: t('Overdue Borrows'), value: stats?.overdue_borrows ?? 0, icon: AlertTriangle, color: 'text-red-800 bg-red-100' },
    { label: t('Open Repair Tickets'), value: stats?.open_repair_tickets ?? 0, icon: Wrench, color: 'text-amber-900 bg-amber-100' },
    { label: t('Low-Stock Consumables'), value: stats?.low_stock_consumables ?? 0, icon: Package, color: 'text-cornsilk bg-hunter-green' },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="flex items-center gap-4 rounded-xl border border-palm-leaf/30 bg-white p-5 shadow-sm">
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${color}`}>
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-hunter-green">{label}</p>
              <p className="text-2xl font-bold text-evergreen">{value}</p>
            </div>
          </div>
        ))}
    </div>
  )
}