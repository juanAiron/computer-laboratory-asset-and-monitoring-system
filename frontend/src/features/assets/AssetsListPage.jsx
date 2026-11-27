import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Boxes,
  Check,
  ChevronDown,
  MonitorCheck,
  PackageCheck,
  Plus,
  Search,
  Trash2,
  Wrench,
  X,
} from 'lucide-react'
import api from '../../api/client'
import { useAuth } from '../../hooks/useAuth'
import { ROLES } from '../../utils/roles'
import { AssetFormModal } from './AssetFormModal'
import { InventorySummaryCards } from './InventorySummaryCards'
import {
  formatAcquisitionCost,
  formatLabRoomName,
  formatInventoryDate,
  getInventoryCondition,
  getInventoryStatus,
  getStoredAssetStatus,
  INVENTORY_CONDITION_OPTIONS,
  INVENTORY_STATUS_OPTIONS,
} from './inventoryFormatters'
import { SoftwareAssetsTab } from './SoftwareAssetsTab'
import { InventoryAuditTab } from '../counts/InventoryAuditTab'

function getErrorMessage(error, fallback) {
  return error.response?.data?.detail || fallback
}

function displayStatus(value) {
  return getInventoryStatus(value)
}

function displayCondition(value) {
  const condition = getInventoryCondition(value)
  return INVENTORY_CONDITION_OPTIONS.find((option) => option.value === condition)?.label
    || condition.replaceAll('_', ' ')
}

function conditionBadgeClass(value) {
  const condition = getInventoryCondition(value)
  if (condition === 'working') return 'bg-lime-cream text-evergreen'
  if (condition === 'defective' || condition === 'for_condemn') return 'bg-red-100 text-red-900'
  return 'bg-cornsilk text-hunter-green'
}

function displayField(field, value) {
  if (value === null) return '—'
  if (field === 'status') return displayStatus(value)
  if (field === 'condition') return displayCondition(value)
  if (field === 'acquisition_cost') return formatAcquisitionCost(value)
  if (field === 'acquisition_date' || field === 'last_audited_at') return formatInventoryDate(value)
  if (typeof value === 'string') return value.replaceAll('_', ' ')
  return String(value)
}

function displayAssetField(field, value, categoryNames, labRooms) {
  if (field === 'category_id') return categoryNames.get(value) || '—'
  if (field === 'lab_room_id') {
    const lab = labRooms.get(value)
    return formatLabRoomName(lab)
  }
  if (['acquisition_cost', 'acquisition_date', 'condition', 'last_audited_at', 'status'].includes(field)) {
    return displayField(field, value ?? null)
  }
  return value || '—'
}

function createAssetDraft(asset) {
  return {
    asset_tag: asset.asset_tag || '',
    name: asset.name || '',
    serial_number: asset.serial_number || '',
    brand_model: asset.brand_model || '',
    mac_address: asset.mac_address || '',
    operating_system: asset.operating_system || '',
    processor: asset.processor || '',
    ram: asset.ram || '',
    storage: asset.storage || '',
    acquisition_date: asset.acquisition_date || '',
    acquisition_cost: asset.acquisition_cost == null ? '' : String(asset.acquisition_cost),
    assigned_department: asset.assigned_department || '',
    comments: asset.comments || '',
    category_id: asset.category_id == null ? '' : String(asset.category_id),
    lab_room_id: asset.lab_room_id == null ? '' : String(asset.lab_room_id),
    status: getInventoryStatus(asset.status),
    condition: getInventoryCondition(asset.condition),
  }
}

function nullableText(value) {
  return value.trim() || null
}

function nullableNumber(value) {
  return value === '' ? null : Number(value)
}

const INLINE_EDIT_SECTIONS = [
  {
    title: 'Basic Information',
    fields: [
      ['Asset name', 'name', 'text'],
      ['Serial number', 'serial_number', 'text'],
      ['Tag number', 'asset_tag', 'text'],
      ['Category', 'category_id', 'select'],
      ['COST', 'acquisition_cost', 'number'],
      ['Acquisition Date', 'acquisition_date', 'date'],
    ],
  },
  {
    title: 'Specifications',
    fields: [
      ['Brand / model', 'brand_model', 'text'],
      ['MAC address', 'mac_address', 'text'],
      ['Operating system', 'operating_system', 'text'],
      ['Processor', 'processor', 'text'],
      ['RAM', 'ram', 'text'],
      ['Storage', 'storage', 'text'],
    ],
  },
  {
    title: 'Assignment & Status',
    fields: [
      ['Status', 'status', 'select'],
      ['Condition', 'condition', 'select'],
      ['Assigned department', 'assigned_department', 'text'],
      ['Lab deployment', 'lab_room_id', 'select'],
      ['Last physical check', 'last_audited_at', 'readonly'],
      ['Comments / remarks', 'comments', 'textarea'],
    ],
  },
]

export function AssetsListPage() {
  const { user } = useAuth()
  const isSuperAdmin = user?.role === ROLES.SUPER_ADMIN
  const isCustodian = user?.role === ROLES.CUSTODIAN
  const canManageInventory = isSuperAdmin || isCustodian
  const canRunAudits = isSuperAdmin || isCustodian
  const [assets, setAssets] = useState([])
  const [categories, setCategories] = useState([])
  const [labs, setLabs] = useState([])
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [assetTypeTab, setAssetTypeTab] = useState('hardware')
  const [assetDrafts, setAssetDrafts] = useState({})
  const [savingAssetId, setSavingAssetId] = useState(null)
  const [creatingAsset, setCreatingAsset] = useState(false)

  const loadInventory = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const requestCall = isSuperAdmin
        ? api.get('/assets/edit-requests', { params: { status_filter: 'pending' } })
        : Promise.resolve({ data: [] })
      const [assetResult, categoryResult, requestResult, labResult] = await Promise.all([
        api.get('/assets'),
        api.get('/assets/categories'),
        requestCall,
        api.get('/labs'),
      ])
      setAssets(assetResult.data)
      setCategories(categoryResult.data)
      setLabs(labResult.data)
      setRequests(requestResult.data)
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Unable to load the inventory.'))
    } finally {
      setLoading(false)
    }
  }, [isSuperAdmin])

  useEffect(() => {
    loadInventory()
  }, [loadInventory])

  const categoryNames = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  )
  const labRooms = useMemo(
    () => new Map(labs.map((lab) => [lab.id, lab])),
    [labs],
  )
  const scheduleLabs = useMemo(
    () => labs.filter((lab) => /^D[0-9]{3}/i.test(lab.code)),
    [labs],
  )

  const hardwareSummaryCards = [
    {
      label: 'Total hardware assets',
      value: assets.length,
      detail: 'All registered hardware',
      icon: Boxes,
    },
    {
      label: 'Available',
      value: assets.filter((asset) => asset.status === 'available').length,
      detail: 'Ready for deployment',
      icon: PackageCheck,
    },
    {
      label: 'Deployed',
      value: assets.filter((asset) => ['in_use', 'borrowed'].includes(asset.status)).length,
      detail: 'Includes deployed and borrowed assets',
      icon: MonitorCheck,
    },
    {
      label: 'Unavailable',
      value: assets.filter((asset) => ['under_repair', 'retired'].includes(asset.status)).length,
      detail: 'Under repair or retired',
      icon: Wrench,
    },
  ]

  const visibleAssets = useMemo(() => {
    const query = search.trim().toLowerCase()
    return assets.filter((asset) => {
      if (statusFilter && getInventoryStatus(asset.status) !== statusFilter) return false
      if (!query) return true
      return [
        asset.asset_tag,
        asset.name,
        asset.serial_number,
        asset.brand_model,
        asset.mac_address,
        asset.operating_system,
        asset.processor,
        asset.assigned_department,
        categoryNames.get(asset.category_id),
      ].some((value) => value?.toLowerCase().includes(query))
    })
  }, [assets, categoryNames, search, statusFilter])

  const submitNewAsset = async (changes) => {
    if (!creatingAsset) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await api.post('/assets', changes)
      setNotice('Hardware item added to inventory.')
      setCreatingAsset(false)
      await loadInventory()
    } catch (submitError) {
      setError(getErrorMessage(submitError, 'Unable to submit the inventory changes.'))
    } finally {
      setSaving(false)
    }
  }

  const updateAssetDraft = (asset, field, value) => {
    setAssetDrafts((current) => ({
      ...current,
      [asset.id]: {
        ...(current[asset.id] || createAssetDraft(asset)),
        [field]: value,
      },
    }))
  }

  const saveAsset = async (asset) => {
    const draft = assetDrafts[asset.id] || createAssetDraft(asset)
    if (!draft.asset_tag.trim() || !draft.name.trim() || !draft.category_id) {
      setError('Tag number, asset name, and category are required.')
      return
    }

    setSavingAssetId(asset.id)
    setError('')
    setNotice('')
    try {
      const { data: updatedAsset } = await api.patch(`/assets/${asset.id}`, {
        asset_tag: draft.asset_tag.trim().toUpperCase(),
        name: draft.name.trim(),
        serial_number: nullableText(draft.serial_number),
        brand_model: nullableText(draft.brand_model),
        mac_address: nullableText(draft.mac_address),
        operating_system: nullableText(draft.operating_system),
        processor: nullableText(draft.processor),
        ram: nullableText(draft.ram),
        storage: nullableText(draft.storage),
        acquisition_date: draft.acquisition_date || null,
        acquisition_cost: nullableNumber(draft.acquisition_cost),
        assigned_department: nullableText(draft.assigned_department),
        comments: nullableText(draft.comments),
        category_id: Number(draft.category_id),
        lab_room_id: nullableNumber(draft.lab_room_id),
        status: getStoredAssetStatus(draft.status, asset.status),
        condition: draft.condition,
      })
      setAssets((current) => current.map((item) => (item.id === asset.id ? updatedAsset : item)))
      setAssetDrafts((current) => {
        const next = { ...current }
        delete next[asset.id]
        return next
      })
      setNotice('Inventory item updated.')
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'Unable to save this inventory item.'))
    } finally {
      setSavingAssetId(null)
    }
  }

  const archiveAsset = async (asset) => {
    if (!window.confirm(`Archive ${asset.name} (${asset.asset_tag}) from active inventory?`)) return
    setError('')
    setNotice('')
    try {
      await api.post(`/assets/${asset.id}/archive`)
      setNotice('Hardware item archived.')
      await loadInventory()
    } catch (archiveError) {
      setError(getErrorMessage(archiveError, 'Unable to archive this hardware item.'))
    }
  }

  const reviewRequest = async (request, decision) => {
    setError('')
    setNotice('')
    try {
      await api.post(`/assets/edit-requests/${request.id}/${decision}`, {})
      setNotice(decision === 'approve' ? 'Edit request approved and applied.' : 'Edit request rejected.')
      await loadInventory()
    } catch (reviewError) {
      setError(getErrorMessage(reviewError, 'Unable to review this edit request.'))
    }
  }

  const inputClass =
    'rounded-lg border border-palm-leaf/40 bg-white px-3 py-2 text-sm text-evergreen'

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-palm-leaf/25">
        <div role="tablist" aria-label="Inventory asset type" className="flex flex-wrap gap-2">
          <button
            type="button"
            role="tab"
            aria-selected={assetTypeTab === 'hardware'}
            onClick={() => setAssetTypeTab('hardware')}
            className={`border-b-2 px-3 py-2 text-sm font-semibold ${assetTypeTab === 'hardware' ? 'border-hunter-green text-evergreen' : 'border-transparent text-hunter-green'}`}
          >
            Hardware Assets
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={assetTypeTab === 'software'}
            onClick={() => setAssetTypeTab('software')}
            className={`border-b-2 px-3 py-2 text-sm font-semibold ${assetTypeTab === 'software' ? 'border-hunter-green text-evergreen' : 'border-transparent text-hunter-green'}`}
          >
            Software &amp; Subscriptions
          </button>
          {canRunAudits && (
            <button
              type="button"
              role="tab"
              aria-selected={assetTypeTab === 'audits'}
              onClick={() => setAssetTypeTab('audits')}
              className={`border-b-2 px-3 py-2 text-sm font-semibold ${assetTypeTab === 'audits' ? 'border-hunter-green text-evergreen' : 'border-transparent text-hunter-green'}`}
            >
              Inventory Audits
            </button>
          )}
        </div>
        <span className="rounded-full bg-palm-leaf/15 px-3 py-1 text-xs font-semibold capitalize text-evergreen">
          {isSuperAdmin
            ? 'Super Admin · full inventory management'
            : isCustodian
              ? 'Custodian · manage inventory and audit'
              : canRunAudits
                ? 'TRIL · view and audit'
                : 'View only'}
        </span>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <X className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <Check className="mt-0.5 h-4 w-4 shrink-0" />
          {notice}
        </div>
      )}

      {assetTypeTab === 'hardware' && (
        <InventorySummaryCards
          label="Hardware inventory summary"
          cards={hardwareSummaryCards}
          loading={loading}
          error={Boolean(error)}
        />
      )}

      {assetTypeTab === 'hardware' && (
        <div className="overflow-hidden rounded-xl border border-palm-leaf/30 bg-white shadow-sm">
          <div className="flex flex-wrap gap-3 border-b border-palm-leaf/20 p-4">
            <label className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-hunter-green" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search tag, item, serial, MAC, department…"
                className={`${inputClass} w-full pl-9`}
              />
            </label>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={inputClass}>
              <option value="">All statuses</option>
              {INVENTORY_STATUS_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            {canManageInventory && (
              <button
                type="button"
                onClick={() => setCreatingAsset(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-hunter-green px-3 py-2 text-sm font-semibold text-white hover:bg-evergreen"
              >
                <Plus className="h-4 w-4" /> Add item
              </button>
            )}
          </div>

          {loading ? (
            <p className="p-8 text-center text-sm text-hunter-green">Loading inventory…</p>
          ) : visibleAssets.length === 0 ? (
            <p className="p-8 text-center text-sm text-hunter-green">No inventory items match your search.</p>
          ) : (
            <div className="divide-y divide-palm-leaf/20">
              {visibleAssets.map((asset) => {
                const status = displayStatus(asset.status)
                const draft = assetDrafts[asset.id] || createAssetDraft(asset)
                const labRoom = asset.lab_room_id == null ? null : labRooms.get(asset.lab_room_id)

                return (
                  <details key={asset.id} className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-cornsilk/40 [&::-webkit-details-marker]:hidden">
                      <ChevronDown className="h-4 w-4 shrink-0 text-hunter-green transition-transform group-open:rotate-180" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <span className="text-base font-semibold text-evergreen">
                            {asset.name}{asset.lab_room_id != null
                              ? ` - ${labRoom ? formatLabRoomName(labRoom) : asset.lab_room_id}`
                              : ''}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          <span className="text-hunter-green">Tag: {asset.asset_tag}</span>
                          <span className="text-hunter-green">Serial: {asset.serial_number || '—'}</span>
                          <span className="rounded-full bg-cornsilk px-2.5 py-1 font-semibold text-evergreen">
                            Category · {categoryNames.get(asset.category_id) || '—'}
                          </span>
                          <span className="rounded-full bg-lime-cream px-2.5 py-1 font-semibold text-evergreen">
                            Assigned department · {asset.assigned_department || 'Not assigned'}
                          </span>
                          <span className={`rounded-full px-2.5 py-1 font-semibold ${conditionBadgeClass(asset.condition)}`}>
                            Condition · {displayCondition(asset.condition)}
                          </span>
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${status === 'available' ? 'bg-lime-cream text-evergreen' : status === 'deployed' ? 'bg-hunter-green text-cornsilk' : 'bg-cornsilk text-hunter-green'}`}>
                        {status}
                      </span>
                    </summary>
                    <div className="border-t border-palm-leaf/15 bg-cornsilk/20 px-4 py-4 sm:px-8">
                      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                        {INLINE_EDIT_SECTIONS.map(({ title, fields }) => (
                          <section key={title} className="min-w-0 space-y-3 rounded-xl border border-palm-leaf/20 bg-white/70 p-4">
                            <h3 className="border-b border-palm-leaf/20 pb-2 text-sm font-bold text-evergreen">{title}</h3>
                            <div className="grid grid-cols-1 gap-x-4 gap-y-4">
                              {fields.map(([label, field, type]) => {
                                if (!canManageInventory || type === 'readonly') {
                                  return (
                                    <div key={field} className="min-w-0">
                                      <p className="text-xs font-semibold text-evergreen">{label}</p>
                                      <p className="mt-1 break-words text-sm text-evergreen">
                                        {displayAssetField(field, asset[field], categoryNames, labRooms)}
                                      </p>
                                    </div>
                                  )
                                }

                                const options = field === 'category_id'
                                  ? categories.map((category) => ({ value: String(category.id), label: category.name }))
                                  : field === 'lab_room_id'
                                    ? scheduleLabs.map((lab) => ({
                                      value: String(lab.id),
                                      label: formatLabRoomName(lab),
                                    }))
                                  : field === 'status'
                                    ? INVENTORY_STATUS_OPTIONS
                                    : field === 'condition'
                                      ? INVENTORY_CONDITION_OPTIONS
                                      : []

                                return (
                                  <label key={field} className="block min-w-0 text-xs font-semibold text-evergreen">
                                    {label}
                                    {type === 'textarea' ? (
                                      <textarea
                                        value={draft[field]}
                                        onChange={(event) => updateAssetDraft(asset, field, event.target.value)}
                                        rows={2}
                                        className={`${inputClass} mt-1 w-full`}
                                      />
                                    ) : type === 'select' ? (
                                      <select
                                        value={draft[field]}
                                        onChange={(event) => updateAssetDraft(asset, field, event.target.value)}
                                        required={field === 'category_id'}
                                        className={`${inputClass} mt-1 w-full`}
                                      >
                                        {field === 'category_id' && <option value="">Select a category</option>}
                                        {field === 'lab_room_id' && <option value="">Not assigned to a room</option>}
                                        {options.map(({ value, label: optionLabel }) => (
                                          <option key={value} value={value}>{optionLabel}</option>
                                        ))}
                                      </select>
                                    ) : (
                                      <input
                                        type={type}
                                        min={type === 'number' ? '0' : undefined}
                                        maxLength={field === 'asset_tag' ? 60 : undefined}
                                        step={field === 'acquisition_cost' ? '0.01' : undefined}
                                        value={draft[field]}
                                        onChange={(event) => updateAssetDraft(asset, field, event.target.value)}
                                        required={field === 'name'}
                                        className={`${inputClass} mt-1 w-full`}
                                      />
                                    )}
                                  </label>
                                )
                              })}
                            </div>
                          </section>
                        ))}
                      </div>
                      {canManageInventory && (
                        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-palm-leaf/15 pt-4">
                          <button
                            type="button"
                            onClick={() => archiveAsset(asset)}
                            disabled={savingAssetId === asset.id}
                            className="inline-flex items-center gap-1 rounded-lg border border-palm-leaf/40 px-2.5 py-1.5 text-xs font-semibold text-hunter-green hover:bg-lime-cream/50"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Archive
                          </button>
                          <button
                            type="button"
                            onClick={() => saveAsset(asset)}
                            disabled={savingAssetId === asset.id}
                            className="inline-flex items-center gap-1 rounded-lg bg-hunter-green px-3 py-1.5 text-xs font-semibold text-white hover:bg-evergreen disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {savingAssetId === asset.id ? 'Saving…' : 'Save'}
                          </button>
                        </div>
                      )}
                    </div>
                  </details>
                )
              })}
            </div>
          )}
        </div>
      )}

      {assetTypeTab === 'hardware' && isSuperAdmin && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-evergreen">
              Pending edit requests
              <span className="ml-2 text-sm font-medium text-hunter-green">({requests.length})</span>
            </h2>
          </div>
          {loading ? (
            <p className="rounded-xl border border-palm-leaf/30 bg-white p-6 text-center text-sm text-hunter-green">
              Loading edit requests…
            </p>
          ) : requests.length === 0 ? (
            <p className="rounded-xl border border-palm-leaf/30 bg-white p-6 text-center text-sm text-hunter-green">
              There are no pending edit requests.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-palm-leaf/30 bg-white shadow-sm">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead className="bg-cornsilk/70 text-xs uppercase tracking-wide text-hunter-green">
                  <tr>
                    <th className="px-4 py-3">Asset</th>
                    <th className="px-4 py-3">Requested by</th>
                    <th className="px-4 py-3">Reason</th>
                    <th className="px-4 py-3">Proposed changes</th>
                    <th className="px-4 py-3">Status</th>
                    {isSuperAdmin && <th className="px-4 py-3 text-right">Review</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-palm-leaf/15">
                  {requests.map((request) => (
                    <tr key={request.id} className="align-top">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-evergreen">{request.asset_name}</p>
                        <p className="text-xs text-hunter-green">{request.asset_tag}</p>
                        <p className="mt-1 text-xs text-hunter-green">{new Date(request.created_at).toLocaleString()}</p>
                      </td>
                      <td className="px-4 py-3 text-evergreen">
                        {request.requested_by_name}
                      </td>
                      <td className="max-w-[220px] whitespace-normal px-4 py-3 text-evergreen">{request.reason}</td>
                      <td className="max-w-[380px] whitespace-normal px-4 py-3">
                        <div className="space-y-1">
                          {Object.entries(request.proposed_changes).map(([field, value]) => (
                            <p key={field} className="text-evergreen">
                              <span className="font-semibold capitalize">{field.replaceAll('_', ' ')}:</span>{' '}
                              <span className="text-hunter-green">{displayField(field, value)}</span>
                            </p>
                          ))}
                        </div>
                        {request.review_note && <p className="mt-2 text-xs text-hunter-green">Review note: {request.review_note}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${request.status === 'pending' ? 'bg-amber-100 text-amber-900' : request.status === 'approved' ? 'bg-emerald-100 text-emerald-900' : 'bg-red-100 text-red-900'}`}>
                          {request.status}
                        </span>
                      </td>
                      {isSuperAdmin && (
                        <td className="px-4 py-3">
                          {request.status === 'pending' && (
                            <div className="flex justify-end gap-2">
                              <button type="button" onClick={() => reviewRequest(request, 'reject')} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50">
                                Reject
                              </button>
                              <button type="button" onClick={() => reviewRequest(request, 'approve')} className="rounded-lg bg-hunter-green px-3 py-2 text-xs font-semibold text-white hover:bg-evergreen">
                                Approve
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {assetTypeTab === 'software' && (
        <SoftwareAssetsTab
          isSuperAdmin={isSuperAdmin}
          isCustodian={isCustodian}
        />
      )}
      {assetTypeTab === 'audits' && canRunAudits && <InventoryAuditTab />}

      {creatingAsset && (
        <AssetFormModal
          categories={categories}
          labs={scheduleLabs}
          mode="create"
          saving={saving}
          onClose={() => {
            setCreatingAsset(false)
          }}
          onSubmit={submitNewAsset}
        />
      )}
    </section>
  )
}