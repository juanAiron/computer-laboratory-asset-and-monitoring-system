import { X } from 'lucide-react'
import {
  formatAcquisitionCost,
  formatInventoryDate,
  getInventoryCondition,
  getInventoryStatus,
} from './inventoryFormatters'

export function AssetDetailPage({ asset, categoryName, onClose }) {
  if (!asset) return null

  const details = [
    ['Asset tag', asset.asset_tag],
    ['Serial number', asset.serial_number || '—'],
    ['Category', categoryName || '—'],
    ['Brand / model', asset.brand_model || '—'],
    ['MAC address', asset.mac_address || '—'],
    ['Operating system', asset.operating_system || '—'],
    ['Processor', asset.processor || '—'],
    ['RAM', asset.ram || '—'],
    ['Storage', asset.storage || '—'],
    ['Acquisition date', formatInventoryDate(asset.acquisition_date)],
    ['Acquisition cost', formatAcquisitionCost(asset.acquisition_cost)],
    ['Assigned department', asset.assigned_department || '—'],
    ['Last physical check', formatInventoryDate(asset.last_audited_at)],
    ['Status', getInventoryStatus(asset.status)],
    ['Condition', getInventoryCondition(asset.condition).replaceAll('_', ' ')],
    ['Comments / remarks', asset.comments || '—'],
    ['Lab deployment', asset.lab_room_id ?? '—'],
    ['Station ID', asset.station_id ?? '—'],
    ['Specifications', asset.specs || '—'],
  ]

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-evergreen/50 p-4" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="asset-detail-title"
        onMouseDown={(event) => event.stopPropagation()}
        className="w-full max-w-xl rounded-2xl border border-palm-leaf/30 bg-cornsilk p-5 shadow-2xl"
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 id="asset-detail-title" className="text-lg font-bold text-evergreen">{asset.name}</h2>
            <p className="mt-1 text-sm text-hunter-green">{asset.asset_tag}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close details" className="rounded-lg p-2 text-hunter-green hover:bg-palm-leaf/10">
            <X className="h-5 w-5" />
          </button>
        </div>
        <dl className="grid gap-4 sm:grid-cols-2">
          {details.map(([label, value]) => (
            <div key={label} className="rounded-lg border border-palm-leaf/20 bg-white/70 p-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-hunter-green">{label}</dt>
              <dd className="mt-1 break-words text-sm text-evergreen">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}