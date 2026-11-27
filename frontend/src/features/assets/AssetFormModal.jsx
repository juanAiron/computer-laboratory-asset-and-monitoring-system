import { useState } from 'react'
import { X } from 'lucide-react'
import {
  getInventoryCondition,
  getInventoryStatus,
  getStoredAssetStatus,
  formatLabRoomName,
  INVENTORY_CONDITION_OPTIONS,
  INVENTORY_STATUS_OPTIONS,
} from './inventoryFormatters'

const EMPTY_FORM = {
  asset_tag: '',
  serial_number: '',
  name: '',
  brand_model: '',
  mac_address: '',
  operating_system: '',
  processor: '',
  ram: '',
  storage: '',
  acquisition_date: '',
  acquisition_cost: '',
  assigned_department: '',
  comments: '',
  category_id: '',
  lab_room_id: '',
  status: 'available',
  condition: 'working',
  reason: '',
}

function nullableText(value) {
  return value.trim() || null
}

function nullableNumber(value) {
  return value === '' ? null : Number(value)
}

export function AssetFormModal({
  asset,
  categories,
  labs,
  mode,
  saving,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState({
    ...EMPTY_FORM,
    ...asset,
    asset_tag: asset?.asset_tag || '',
    serial_number: asset?.serial_number || '',
    brand_model: asset?.brand_model || '',
    mac_address: asset?.mac_address || '',
    operating_system: asset?.operating_system || '',
    processor: asset?.processor || '',
    ram: asset?.ram || '',
    storage: asset?.storage || '',
    acquisition_date: asset?.acquisition_date || '',
    acquisition_cost: asset?.acquisition_cost == null ? '' : String(asset.acquisition_cost),
    assigned_department: asset?.assigned_department || '',
    comments: asset?.comments || '',
    category_id: asset?.category_id == null ? '' : String(asset.category_id),
    lab_room_id: asset?.lab_room_id == null ? '' : String(asset.lab_room_id),
    status: getInventoryStatus(asset?.status),
    condition: getInventoryCondition(asset?.condition),
  })

  const change = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  const submit = (event) => {
    event.preventDefault()
    const values = {
      ...(mode === 'create' ? { asset_tag: form.asset_tag.trim().toUpperCase() } : {}),
      serial_number: nullableText(form.serial_number),
      name: form.name.trim(),
      brand_model: nullableText(form.brand_model),
      mac_address: nullableText(form.mac_address),
      operating_system: nullableText(form.operating_system),
      processor: nullableText(form.processor),
      ram: nullableText(form.ram),
      storage: nullableText(form.storage),
      acquisition_date: form.acquisition_date || null,
      acquisition_cost: nullableNumber(form.acquisition_cost),
      assigned_department: nullableText(form.assigned_department),
      comments: nullableText(form.comments),
      category_id: Number(form.category_id),
      lab_room_id: nullableNumber(form.lab_room_id),
      status: getStoredAssetStatus(form.status, asset?.status),
      condition: form.condition,
    }
    const changes = mode === 'create'
      ? values
      : Object.fromEntries(
        Object.entries(values).filter(([key, value]) => {
          const existing = key === 'acquisition_cost'
            ? (asset[key] == null ? null : Number(asset[key]))
            : (asset[key] == null ? null : asset[key])
          return value !== existing
        }),
      )
    if (mode !== 'create' && Object.keys(changes).length === 0) return
    onSubmit(changes, form.reason.trim())
  }

  const inputClass =
    'mt-1 w-full rounded-lg border border-palm-leaf/40 bg-white px-3 py-2 text-sm text-evergreen'
  const labelClass = 'block text-xs font-semibold text-evergreen'

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-evergreen/50 p-4">
      <form
        onSubmit={submit}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-palm-leaf/30 bg-cornsilk p-5 shadow-2xl"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-evergreen">
              {mode === 'create' ? 'Add hardware asset' : mode === 'request' ? 'Request inventory change' : 'Edit inventory item'}
            </h2>
            <p className="mt-1 text-sm text-hunter-green">
              {asset ? `${asset.asset_tag} · ${asset.name}` : 'Register a new hardware item'}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-hunter-green hover:bg-palm-leaf/10">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {mode === 'create' && (
            <label className={labelClass}>
              Organization tag number
              <input name="asset_tag" value={form.asset_tag} onChange={change} maxLength={60} required className={inputClass} />
            </label>
          )}
          <label className={labelClass}>
            Asset name
            <input name="name" value={form.name} onChange={change} required className={inputClass} />
          </label>
          <label className={labelClass}>
            Serial number
            <input name="serial_number" value={form.serial_number} onChange={change} className={inputClass} />
          </label>
          <label className={labelClass}>
            Brand / model
            <input name="brand_model" value={form.brand_model} onChange={change} className={inputClass} />
          </label>
          <label className={labelClass}>
            MAC address
            <input name="mac_address" value={form.mac_address} onChange={change} className={inputClass} />
          </label>
          <label className={labelClass}>
            Operating system
            <input name="operating_system" value={form.operating_system} onChange={change} className={inputClass} />
          </label>
          <label className={labelClass}>
            Processor
            <input name="processor" value={form.processor} onChange={change} className={inputClass} />
          </label>
          <label className={labelClass}>
            RAM
            <input name="ram" value={form.ram} onChange={change} className={inputClass} />
          </label>
          <label className={labelClass}>
            Storage
            <input name="storage" value={form.storage} onChange={change} className={inputClass} />
          </label>
          <label className={labelClass}>
            Acquisition date
            <input name="acquisition_date" type="date" value={form.acquisition_date} onChange={change} className={inputClass} />
          </label>
          <label className={labelClass}>
            COST
            <input name="acquisition_cost" type="number" min="0" step="0.01" value={form.acquisition_cost} onChange={change} className={inputClass} />
          </label>
          <label className={labelClass}>
            Assigned department
            <input name="assigned_department" value={form.assigned_department} onChange={change} className={inputClass} />
          </label>
          <label className={labelClass}>
            Category
            <select name="category_id" value={form.category_id} onChange={change} required className={inputClass}>
              <option value="" disabled>Select a category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Lab deployment
            <select name="lab_room_id" value={form.lab_room_id} onChange={change} className={inputClass}>
              <option value="">No lab deployment</option>
              {labs.map((lab) => (
                <option key={lab.id} value={lab.id}>{formatLabRoomName(lab)}</option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Status
            <select name="status" value={form.status} onChange={change} className={inputClass}>
              {INVENTORY_STATUS_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Condition
            <select name="condition" value={form.condition} onChange={change} className={inputClass}>
              {INVENTORY_CONDITION_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Comments / remarks
            <textarea name="comments" value={form.comments} onChange={change} rows={3} className={inputClass} />
          </label>
          {mode === 'request' && (
            <label className={`${labelClass} sm:col-span-2`}>
              Reason for the requested change
              <textarea name="reason" value={form.reason} onChange={change} rows={3} required className={inputClass} />
            </label>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-palm-leaf/40 px-4 py-2 text-sm font-semibold text-evergreen">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || (mode === 'request' && !form.reason.trim())}
            className="rounded-lg bg-hunter-green px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Saving…' : mode === 'request' ? 'Send for approval' : mode === 'create' ? 'Add item' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  )
}