import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, ClipboardCheck, X } from 'lucide-react'
import api from '../../api/client'

function getErrorMessage(error, fallback) {
  return error.response?.data?.detail || fallback
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '—'
}

export function InventoryAuditTab() {
  const [labs, setLabs] = useState([])
  const [counts, setCounts] = useState([])
  const [selectedLab, setSelectedLab] = useState('')
  const [selectedCountId, setSelectedCountId] = useState(null)
  const [assetTag, setAssetTag] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadAuditData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [labsResult, countsResult] = await Promise.all([
        api.get('/labs'),
        api.get('/counts'),
      ])
      setLabs(labsResult.data)
      setCounts(countsResult.data)
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Unable to load inventory audits.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAuditData()
  }, [loadAuditData])

  const roomNames = useMemo(
    () => new Map(labs.map((lab) => [lab.id, `${lab.code} — ${lab.name}`])),
    [labs],
  )
  const activeCount = counts.find((count) => count.status === 'in_progress')
  const selectedCount =
    counts.find((count) => count.id === selectedCountId) || activeCount || counts[0]

  const replaceCount = (updatedCount) => {
    setCounts((current) => [
      updatedCount,
      ...current.filter((count) => count.id !== updatedCount.id),
    ])
    setSelectedCountId(updatedCount.id)
  }

  const startCount = async (event) => {
    event.preventDefault()
    if (!selectedLab || activeCount) return
    setWorking(true)
    setError('')
    setNotice('')
    try {
      const { data } = await api.post('/counts', {
        lab_room_id: Number(selectedLab),
        notes: notes.trim() || null,
      })
      replaceCount(data)
      setNotes('')
      setNotice('Inventory audit started. Scan or enter the asset tags in this room.')
    } catch (startError) {
      setError(getErrorMessage(startError, 'Unable to start the inventory audit.'))
    } finally {
      setWorking(false)
    }
  }

  const scanAsset = async (event) => {
    event.preventDefault()
    if (!activeCount || !assetTag.trim()) return
    setWorking(true)
    setError('')
    setNotice('')
    try {
      const { data } = await api.post(`/counts/${activeCount.id}/scan`, {
        asset_tag: assetTag.trim(),
      })
      replaceCount(data)
      setAssetTag('')
      setNotice('Asset recorded in the audit.')
    } catch (scanError) {
      setError(getErrorMessage(scanError, 'Unable to record this asset tag.'))
    } finally {
      setWorking(false)
    }
  }

  const closeCount = async () => {
    if (!activeCount) return
    setWorking(true)
    setError('')
    setNotice('')
    try {
      const { data } = await api.post(`/counts/${activeCount.id}/close`)
      replaceCount(data)
      setNotice('Inventory audit completed. Unscanned assets are marked missing.')
    } catch (closeError) {
      setError(getErrorMessage(closeError, 'Unable to close the inventory audit.'))
    } finally {
      setWorking(false)
    }
  }

  const itemCounts = selectedCount?.items.reduce(
    (summary, item) => ({ ...summary, [item.status]: (summary[item.status] || 0) + 1 }),
    {},
  ) || {}
  const inputClass =
    'w-full rounded-lg border border-palm-leaf/40 bg-white px-3 py-2 text-sm text-evergreen'

  return (
    <section className="space-y-4">
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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="rounded-xl border border-palm-leaf/30 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-hunter-green" />
            <h2 className="font-bold text-evergreen">{activeCount ? 'Audit in progress' : 'Start an inventory audit'}</h2>
          </div>
          {activeCount ? (
            <div className="space-y-4">
              <p className="text-sm text-hunter-green">
                Auditing {roomNames.get(activeCount.lab_room_id) || `Lab ${activeCount.lab_room_id}`} · started {formatDate(activeCount.started_at)}
              </p>
              <form onSubmit={scanAsset} className="space-y-2">
                <label htmlFor="audit-asset-tag" className="block text-xs font-semibold text-evergreen">
                  Scan or enter an asset tag
                </label>
                <div className="flex gap-2">
                  <input
                    id="audit-asset-tag"
                    value={assetTag}
                    onChange={(event) => setAssetTag(event.target.value)}
                    autoComplete="off"
                    autoFocus
                    className={inputClass}
                    placeholder="e.g. PC-001"
                  />
                  <button type="submit" disabled={working || !assetTag.trim()} className="shrink-0 rounded-lg bg-hunter-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                    Scan
                  </button>
                </div>
                <p className="text-xs text-hunter-green">A connected barcode/QR scanner can enter the tag here.</p>
              </form>
              <button type="button" onClick={closeCount} disabled={working} className="w-full rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
                Complete audit
              </button>
            </div>
          ) : (
            <form onSubmit={startCount} className="space-y-3">
              <label className="block text-xs font-semibold text-evergreen">
                Laboratory
                <select value={selectedLab} onChange={(event) => setSelectedLab(event.target.value)} required className={`${inputClass} mt-1`}>
                  <option value="" disabled>Select a lab</option>
                  {labs.map((lab) => <option key={lab.id} value={lab.id}>{lab.code} — {lab.name}</option>)}
                </select>
              </label>
              <label className="block text-xs font-semibold text-evergreen">
                Notes (optional)
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} className={`${inputClass} mt-1`} />
              </label>
              <button type="submit" disabled={loading || working || !selectedLab} className="w-full rounded-lg bg-hunter-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {working ? 'Starting…' : 'Start audit'}
              </button>
            </form>
          )}
        </div>

        <div className="rounded-xl border border-palm-leaf/30 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-bold text-evergreen">Audit history</h2>
            <button type="button" onClick={loadAuditData} disabled={loading} className="text-xs font-semibold text-hunter-green hover:text-evergreen">
              Refresh
            </button>
          </div>
          {loading ? (
            <p className="py-6 text-center text-sm text-hunter-green">Loading audit history…</p>
          ) : counts.length === 0 ? (
            <p className="py-6 text-center text-sm text-hunter-green">No inventory audits yet.</p>
          ) : (
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {counts.map((count) => (
                <button
                  key={count.id}
                  type="button"
                  onClick={() => setSelectedCountId(count.id)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left ${selectedCount?.id === count.id ? 'border-hunter-green bg-cornsilk/60' : 'border-palm-leaf/20 hover:bg-cornsilk/30'}`}
                >
                  <span>
                    <span className="block text-sm font-semibold text-evergreen">{roomNames.get(count.lab_room_id) || `Lab ${count.lab_room_id}`}</span>
                    <span className="text-xs text-hunter-green">{formatDate(count.started_at)}</span>
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${count.status === 'in_progress' ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'}`}>
                    {count.status.replaceAll('_', ' ')}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedCount && (
        <div className="overflow-hidden rounded-xl border border-palm-leaf/30 bg-white shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-palm-leaf/20 p-4">
            <div>
              <h2 className="font-bold text-evergreen">
                {roomNames.get(selectedCount.lab_room_id) || `Lab ${selectedCount.lab_room_id}`}
              </h2>
              <p className="mt-1 text-xs text-hunter-green">
                Started {formatDate(selectedCount.started_at)}
                {selectedCount.closed_at ? ` · completed ${formatDate(selectedCount.closed_at)}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {['found', 'pending', 'missing', 'misplaced'].map((status) => (
                <span key={status} className="rounded-full bg-cornsilk px-2.5 py-1 capitalize text-evergreen">
                  {status}: {itemCounts[status] || 0}
                </span>
              ))}
            </div>
          </div>
          {selectedCount.items.length === 0 ? (
            <p className="p-6 text-center text-sm text-hunter-green">No expected assets were recorded for this lab.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="bg-cornsilk/70 text-xs uppercase tracking-wide text-hunter-green">
                  <tr>
                    <th className="px-4 py-3">Asset tag</th>
                    <th className="px-4 py-3">Asset</th>
                    <th className="px-4 py-3">Audit result</th>
                    <th className="px-4 py-3">Scanned at</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-palm-leaf/15">
                  {selectedCount.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 font-semibold text-evergreen">{item.asset_tag}</td>
                      <td className="px-4 py-3 text-evergreen">{item.asset_name}</td>
                      <td className="px-4 py-3 capitalize text-evergreen">{item.status}</td>
                      <td className="px-4 py-3 text-hunter-green">{formatDate(item.scanned_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
