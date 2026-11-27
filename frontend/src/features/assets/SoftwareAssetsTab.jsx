import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CalendarClock,
  Check,
  CircleAlert,
  FileStack,
  Pencil,
  Plus,
  Search,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react'
import api from '../../api/client'
import { SoftwareAssetFormModal } from './SoftwareAssetFormModal'
import { InventorySummaryCards } from './InventorySummaryCards'

function getErrorMessage(error, fallback) {
  return error.response?.data?.detail || fallback
}

function formatDate(value) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString() : '—'
}

function displayField(value) {
  if (value === null) return '—'
  if (typeof value === 'string') return value.replaceAll('_', ' ')
  return String(value)
}

function getLocalDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function SoftwareAssetsTab({ isSuperAdmin, isCustodian }) {
  const [softwareAssets, setSoftwareAssets] = useState([])
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [editingAsset, setEditingAsset] = useState(null)
  const [creating, setCreating] = useState(false)

  const loadSoftware = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const requestCall = isSuperAdmin
        ? api.get('/software-assets/edit-requests', { params: { status_filter: 'pending' } })
        : Promise.resolve({ data: [] })
      const [assetResult, requestResult] = await Promise.all([
        api.get('/software-assets'),
        requestCall,
      ])
      setSoftwareAssets(assetResult.data)
      setRequests(requestResult.data)
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Unable to load software assets and subscriptions.'))
    } finally {
      setLoading(false)
    }
  }, [isSuperAdmin])

  useEffect(() => {
    loadSoftware()
  }, [loadSoftware])

  const visibleAssets = useMemo(() => {
    const query = search.trim().toLowerCase()
    return softwareAssets.filter((asset) =>
      !query || [
        asset.product_name,
        asset.vendor,
        asset.version,
        asset.license_type,
        asset.assigned_to,
        asset.status,
      ].some((value) => value?.toLowerCase().includes(query)),
    )
  }, [search, softwareAssets])

  const today = getLocalDateKey(new Date())
  const dueWithin30Days = (dateValue) => {
    if (!dateValue) return false
    const daysUntilDue = (Date.parse(`${dateValue}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000
    return daysUntilDue >= 0 && daysUntilDue <= 30
  }
  const softwareSummaryCards = [
    {
      label: 'Software records',
      value: softwareAssets.length,
      detail: 'Licenses and subscriptions',
      icon: FileStack,
    },
    {
      label: 'Active / trial seats',
      value: softwareAssets
        .filter((asset) => ['active', 'trial'].includes(asset.status))
        .reduce((total, asset) => total + asset.license_count, 0),
      detail: 'Seats with active or trial status',
      icon: UsersRound,
    },
    {
      label: 'Renewal due soon',
      value: softwareAssets.filter((asset) => (
        asset.status === 'renewal_due'
        || (
          !['expired', 'cancelled'].includes(asset.status)
          && (
            dueWithin30Days(asset.renewal_date)
            || dueWithin30Days(asset.expiry_date)
          )
        )
      )).length,
      detail: 'Marked due or renewal/expiry within 30 days',
      icon: CalendarClock,
    },
    {
      label: 'Expired',
      value: softwareAssets.filter((asset) => (
        asset.status === 'expired'
        || (asset.status !== 'cancelled' && asset.expiry_date && asset.expiry_date < today)
      )).length,
      detail: 'Marked expired or past expiry date',
      icon: CircleAlert,
    },
  ]

  const submit = async (changes) => {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      if (creating) {
        await api.post('/software-assets', changes)
        setNotice('Software asset added.')
      } else if (editingAsset) {
        await api.patch(`/software-assets/${editingAsset.id}`, changes)
        setNotice('Software asset updated.')
      }
      setCreating(false)
      setEditingAsset(null)
      await loadSoftware()
    } catch (submitError) {
      setError(getErrorMessage(submitError, 'Unable to save the software asset changes.'))
    } finally {
      setSaving(false)
    }
  }

  const archiveSoftwareAsset = async (asset) => {
    if (!window.confirm(`Archive ${asset.product_name} from active inventory?`)) return
    setError('')
    setNotice('')
    try {
      await api.post(`/software-assets/${asset.id}/archive`)
      setNotice('Software asset archived.')
      await loadSoftware()
    } catch (archiveError) {
      setError(getErrorMessage(archiveError, 'Unable to archive this software asset.'))
    }
  }

  const reviewRequest = async (request, decision) => {
    setError('')
    setNotice('')
    try {
      await api.post(`/software-assets/edit-requests/${request.id}/${decision}`, {})
      setNotice(decision === 'approve' ? 'Software edit request approved and applied.' : 'Software edit request rejected.')
      await loadSoftware()
    } catch (reviewError) {
      setError(getErrorMessage(reviewError, 'Unable to review this software edit request.'))
    }
  }

  const inputClass =
    'rounded-lg border border-palm-leaf/40 bg-white px-3 py-2 text-sm text-evergreen'

  return (
    <div className="space-y-4">
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

      <InventorySummaryCards
        label="Software and subscription inventory summary"
        cards={softwareSummaryCards}
        loading={loading}
        error={Boolean(error)}
      />

      <div className="overflow-hidden rounded-xl border border-palm-leaf/30 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-3 border-b border-palm-leaf/20 p-4">
            <label className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-hunter-green" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search product, vendor, license, assignee…"
                className={`${inputClass} w-full pl-9`}
              />
            </label>
            {(isSuperAdmin || isCustodian) && (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-hunter-green px-3 py-2 text-sm font-semibold text-white hover:bg-evergreen"
              >
                <Plus className="h-4 w-4" /> Add software
              </button>
            )}
          </div>
          {loading ? (
            <p className="p-8 text-center text-sm text-hunter-green">Loading software inventory…</p>
          ) : visibleAssets.length === 0 ? (
            <p className="p-8 text-center text-sm text-hunter-green">No software assets or subscriptions found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="bg-cornsilk/70 text-xs uppercase tracking-wide text-hunter-green">
                  <tr>
                    <th className="px-4 py-3">Product / vendor</th>
                    <th className="px-4 py-3">License</th>
                    <th className="px-4 py-3">Deployed to</th>
                    <th className="px-4 py-3">Renewal / expiry</th>
                    <th className="px-4 py-3">Annual cost</th>
                    <th className="px-4 py-3">Status</th>
                    {(isSuperAdmin || isCustodian) && <th className="px-4 py-3 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-palm-leaf/15">
                  {visibleAssets.map((asset) => (
                    <tr key={asset.id} className="hover:bg-cornsilk/40">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-evergreen">{asset.product_name}</p>
                        <p className="text-xs text-hunter-green">{asset.vendor}{asset.version ? ` · ${asset.version}` : ''}</p>
                      </td>
                      <td className="px-4 py-3 capitalize text-evergreen">
                        <p>{asset.license_type}</p>
                        <p className="text-xs text-hunter-green">{asset.license_count} seat{asset.license_count === 1 ? '' : 's'}</p>
                      </td>
                      <td className="px-4 py-3 text-evergreen">{asset.assigned_to || '—'}</td>
                      <td className="px-4 py-3 text-evergreen">
                        <p>{formatDate(asset.renewal_date)}</p>
                        <p className="text-xs text-hunter-green">Expires {formatDate(asset.expiry_date)}</p>
                      </td>
                      <td className="px-4 py-3 text-evergreen">
                        {asset.annual_cost == null ? '—' : `${asset.currency_code} ${Number(asset.annual_cost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-palm-leaf/15 px-2.5 py-1 text-xs font-semibold capitalize text-evergreen">
                          {asset.status.replaceAll('_', ' ')}
                        </span>
                      </td>
                      {(isSuperAdmin || isCustodian) && (
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingAsset(asset)}
                              className="inline-flex items-center gap-1 rounded-lg bg-hunter-green px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-evergreen"
                            >
                              <Pencil className="h-3.5 w-3.5" /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => archiveSoftwareAsset(asset)}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Archive
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {isSuperAdmin && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-evergreen">
            Pending software edit requests
            <span className="ml-2 text-sm font-medium text-hunter-green">({requests.length})</span>
          </h2>
          {!requests.length && (
            <div className="rounded-xl border border-palm-leaf/30 bg-white p-8 text-center text-sm text-hunter-green">
              There are no pending software edit requests.
            </div>
          )}
          {requests.map((request) => (
            <article key={request.id} className="rounded-xl border border-palm-leaf/30 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-evergreen">{request.product_name}</h3>
                  <p className="mt-1 text-xs text-hunter-green">
                    {`Requested by ${request.requested_by_name} · `}
                    {new Date(request.created_at).toLocaleString()}
                  </p>
                </div>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold capitalize text-amber-900">{request.status}</span>
              </div>
              <p className="mt-3 text-sm text-evergreen"><span className="font-semibold">Reason:</span> {request.reason}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {Object.entries(request.proposed_changes).map(([field, value]) => (
                  <div key={field} className="rounded-lg bg-cornsilk/60 px-3 py-2 text-sm">
                    <span className="font-semibold capitalize text-evergreen">{field.replaceAll('_', ' ')}:</span>{' '}
                    <span className="text-hunter-green">{displayField(value)}</span>
                  </div>
                ))}
              </div>
              {request.review_note && <p className="mt-3 text-sm text-hunter-green">Review note: {request.review_note}</p>}
              {isSuperAdmin && request.status === 'pending' && (
                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" onClick={() => reviewRequest(request, 'reject')} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">
                    Reject
                  </button>
                  <button type="button" onClick={() => reviewRequest(request, 'approve')} className="rounded-lg bg-hunter-green px-3 py-2 text-sm font-semibold text-white hover:bg-evergreen">
                    Approve and apply
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {(creating || editingAsset) && (
        <SoftwareAssetFormModal
          asset={editingAsset}
          mode={creating ? 'create' : 'edit'}
          saving={saving}
          onClose={() => {
            setCreating(false)
            setEditingAsset(null)
          }}
          onSubmit={submit}
        />
      )}
    </div>
  )
}
