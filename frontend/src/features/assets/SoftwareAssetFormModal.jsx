import { useState } from 'react'
import { X } from 'lucide-react'

const EMPTY_FORM = {
  product_name: '',
  vendor: '',
  version: '',
  license_type: 'subscription',
  license_count: '1',
  currency_code: 'PHP',
  assigned_to: '',
  start_date: '',
  renewal_date: '',
  expiry_date: '',
  annual_cost: '',
  status: 'active',
  notes: '',
  reason: '',
}

function nullableText(value) {
  return value.trim() || null
}

function nullableDate(value) {
  return value || null
}

export function SoftwareAssetFormModal({
  asset,
  mode,
  saving,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState({
    ...EMPTY_FORM,
    ...asset,
    currency_code: asset?.currency_code || 'PHP',
    version: asset?.version || '',
    license_count: String(asset?.license_count ?? 1),
    assigned_to: asset?.assigned_to || '',
    start_date: asset?.start_date || '',
    renewal_date: asset?.renewal_date || '',
    expiry_date: asset?.expiry_date || '',
    annual_cost: asset?.annual_cost == null ? '' : String(asset.annual_cost),
    notes: asset?.notes || '',
  })

  const change = (event) => {
    const value = event.target.name === 'currency_code'
      ? event.target.value.toUpperCase()
      : event.target.value
    setForm((current) => ({ ...current, [event.target.name]: value }))
  }

  const submit = (event) => {
    event.preventDefault()
    const values = {
      product_name: form.product_name.trim(),
      vendor: form.vendor.trim(),
      version: nullableText(form.version),
      license_type: form.license_type.trim(),
      license_count: Number(form.license_count),
      currency_code: form.currency_code.trim(),
      assigned_to: nullableText(form.assigned_to),
      start_date: nullableDate(form.start_date),
      renewal_date: nullableDate(form.renewal_date),
      expiry_date: nullableDate(form.expiry_date),
      annual_cost: form.annual_cost === '' ? null : Number(form.annual_cost),
      status: form.status,
      notes: nullableText(form.notes),
    }

    if (!asset) {
      onSubmit(values, form.reason.trim())
      return
    }

    const changes = Object.fromEntries(
      Object.entries(values).filter(([key, value]) => {
        const existing = asset[key] == null ? null : asset[key]
        if (key === 'annual_cost' && existing !== null) return value !== Number(existing)
        if (key === 'license_count') return value !== Number(existing)
        return value !== existing
      }),
    )
    if (Object.keys(changes).length === 0) return
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
              {mode === 'request' ? 'Request software change' : mode === 'create' ? 'Add software asset' : 'Edit software asset'}
            </h2>
            <p className="mt-1 text-sm text-hunter-green">
              {asset?.product_name || 'Record a software product or subscription'}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-hunter-green hover:bg-palm-leaf/10">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Product name
            <input name="product_name" value={form.product_name} onChange={change} required className={inputClass} />
          </label>
          <label className={labelClass}>
            Vendor
            <input name="vendor" value={form.vendor} onChange={change} required className={inputClass} />
          </label>
          <label className={labelClass}>
            Version
            <input name="version" value={form.version} onChange={change} className={inputClass} />
          </label>
          <label className={labelClass}>
            License type
            <input name="license_type" value={form.license_type} onChange={change} required className={inputClass} placeholder="Subscription, perpetual, site…" />
          </label>
          <label className={labelClass}>
            Number of seats
            <input name="license_count" type="number" min="1" value={form.license_count} onChange={change} required className={inputClass} />
          </label>
          <label className={labelClass}>
            Currency code
            <input name="currency_code" value={form.currency_code} onChange={change} maxLength={3} minLength={3} required className={inputClass} />
          </label>
          <label className={labelClass}>
            Deployed device / user
            <input name="assigned_to" value={form.assigned_to} onChange={change} className={inputClass} />
          </label>
          <label className={labelClass}>
            Start / purchase date
            <input name="start_date" type="date" value={form.start_date} onChange={change} className={inputClass} />
          </label>
          <label className={labelClass}>
            Renewal date
            <input name="renewal_date" type="date" value={form.renewal_date} onChange={change} className={inputClass} />
          </label>
          <label className={labelClass}>
            Expiry date
            <input name="expiry_date" type="date" value={form.expiry_date} onChange={change} className={inputClass} />
          </label>
          <label className={labelClass}>
            Annual cost
            <input name="annual_cost" type="number" min="0" step="0.01" value={form.annual_cost} onChange={change} className={inputClass} />
          </label>
          <label className={labelClass}>
            Status
            <select name="status" value={form.status} onChange={change} className={inputClass}>
              {['active', 'trial', 'renewal_due', 'expired', 'cancelled'].map((value) => (
                <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>
              ))}
            </select>
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Notes
            <textarea name="notes" value={form.notes} onChange={change} rows={3} className={inputClass} />
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
            {saving ? 'Saving…' : mode === 'request' ? 'Send for approval' : mode === 'create' ? 'Add software' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
