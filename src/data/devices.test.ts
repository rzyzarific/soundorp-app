import { describe, expect, it } from 'vitest'
import rawDevices from './devices.json'
import { isValidDevice } from './devices.schema'
import { ALL_DEVICES, getDeviceById, searchDevices } from './devices'

describe('devices.json', () => {
  it('has a reasonable number of starter devices', () => {
    expect(rawDevices.length).toBeGreaterThanOrEqual(40)
  })

  it('every device passes the runtime validator', () => {
    for (const raw of rawDevices) {
      expect(isValidDevice(raw), `invalid device: ${JSON.stringify(raw)}`).toBe(true)
    }
  })

  it('has unique ids', () => {
    const ids = rawDevices.map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('covers every device category', () => {
    const categories = new Set(rawDevices.map((d) => d.category))
    expect(categories).toEqual(
      new Set(['microphone', 'preamp', 'audio_interface', 'mixer', 'monitor', 'headphones', 'daw']),
    )
  })
})

describe('getDeviceById', () => {
  it('resolves a known id', () => {
    expect(getDeviceById('shure-sm7b')?.name).toBe('SM7B')
  })

  it('returns undefined for an unknown id', () => {
    expect(getDeviceById('does-not-exist')).toBeUndefined()
  })
})

describe('searchDevices', () => {
  it('matches by name', () => {
    expect(searchDevices('sm7b').some((d) => d.id === 'shure-sm7b')).toBe(true)
  })

  it('matches by brand', () => {
    expect(searchDevices('shure').length).toBeGreaterThan(0)
  })

  it('returns everything for an empty query', () => {
    expect(searchDevices('')).toEqual(ALL_DEVICES)
  })

  it('returns nothing for a nonsense query', () => {
    expect(searchDevices('zzzznonexistentzzzz')).toEqual([])
  })
})
