export const INVENTORY_STATUS_OPTIONS = [
  { value: 'available', label: 'Available' },
  { value: 'deployed', label: 'Deployed' },
  { value: 'unavailable', label: 'Unavailable' },
]

export const INVENTORY_CONDITION_OPTIONS = [
  { value: 'working', label: 'Working' },
  { value: 'defective', label: 'Defective' },
  { value: 'for_replacement', label: 'For Replacement' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'for_condemn', label: 'For Condemn' },
  { value: 'for_warranty', label: 'For Warranty' },
]

export function getInventoryStatus(status) {
  if (status === 'in_use' || status === 'borrowed' || status === 'assigned' || status === 'deployed') return 'deployed'
  if (status === 'under_repair' || status === 'retired' || status === 'unavailable') return 'unavailable'
  return 'available'
}

export function getStoredAssetStatus(status, currentStatus) {
  if (status === 'assigned' || status === 'deployed') {
    return currentStatus === 'borrowed' ? 'borrowed' : 'in_use'
  }
  if (status === 'unavailable') {
    return currentStatus === 'retired' ? 'retired' : 'under_repair'
  }
  return 'available'
}

export function getInventoryCondition(condition) {
  return condition === 'good' || condition === 'fair' || !condition ? 'working' : condition
}

export function formatInventoryDate(value) {
  if (!value) return '—'
  const date = value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString()
}

export function formatAcquisitionCost(value) {
  if (value == null || value === '') return '—'
  return `PHP ${Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function formatLabRoomName(lab) {
  if (!lab) return '—'

  const roomCode = lab.code.match(/^D[0-9]{3}/i)?.[0] || lab.code
  const roomName = lab.name?.trim()
  return roomName && roomName.toLowerCase() !== roomCode.toLowerCase()
    ? `${roomCode} - ${roomName}`
    : lab.code
}
