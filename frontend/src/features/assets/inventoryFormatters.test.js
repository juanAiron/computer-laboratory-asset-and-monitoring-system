import { describe, expect, it } from 'vitest'
import {
  getInventoryCondition,
  getInventoryStatus,
  getStoredAssetStatus,
  formatLabRoomName,
} from './inventoryFormatters'

describe('inventory display status mapping', () => {
  it('groups the existing operational states into the inventory status labels', () => {
    expect(getInventoryStatus('available')).toBe('available')
    expect(getInventoryStatus('in_use')).toBe('deployed')
    expect(getInventoryStatus('borrowed')).toBe('deployed')
    expect(getInventoryStatus('under_repair')).toBe('unavailable')
    expect(getInventoryStatus('retired')).toBe('unavailable')
  })

  it('preserves borrowed and retired state when saving grouped status values', () => {
    expect(getStoredAssetStatus('deployed', 'borrowed')).toBe('borrowed')
    expect(getStoredAssetStatus('unavailable', 'retired')).toBe('retired')
    expect(getStoredAssetStatus('deployed', 'available')).toBe('in_use')
    expect(getStoredAssetStatus('unavailable', 'available')).toBe('under_repair')
  })

  it('shows legacy good and fair conditions as working', () => {
    expect(getInventoryCondition('good')).toBe('working')
    expect(getInventoryCondition('fair')).toBe('working')
    expect(getInventoryCondition('for_warranty')).toBe('for_warranty')
  })

  it('displays the full lab name instead of a room-code suffix', () => {
    expect(formatLabRoomName({ code: 'D424-KC', name: 'Knowledge Center' }))
      .toBe('D424 - Knowledge Center')
    expect(formatLabRoomName({ code: 'D522', name: 'D522' })).toBe('D522')
  })
})
