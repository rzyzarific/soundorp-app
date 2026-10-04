import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  readBudget,
  readCustomDevices,
  readSavedChains,
  writeBudget,
  writeCustomDevices,
  writeSavedChains,
} from './storage'
import { createCustomDevice, emptyCustomDeviceInput } from './customDevices'
import type { Device, SignalChain } from '../data/devices.schema'

function createMemoryStorage(): Storage {
  const store = new Map<string, string>()
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size
    },
  } as Storage
}

function customDevice(name: string): Device {
  const built = createCustomDevice({ ...emptyCustomDeviceInput('microphone'), name })
  if (!built.ok) throw new Error('fixture failed')
  return built.device
}

const CUSTOM_KEY = 'soundorp:signal-chain-builder:custom-devices'
const CHAINS_KEY = 'soundorp:signal-chain-builder:saved-chains'

function chain(overrides: Partial<SignalChain> = {}): SignalChain {
  return { id: 'c1', name: 'Chain', deviceIds: [], createdAt: 1, updatedAt: 2, ...overrides }
}

describe('custom device storage', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('round-trips the library', () => {
    const devices = [customDevice('A'), customDevice('B')]

    writeCustomDevices(devices)

    expect(readCustomDevices()).toEqual(devices)
  })

  it('starts empty', () => {
    expect(readCustomDevices()).toEqual([])
  })

  it('survives corrupted JSON', () => {
    localStorage.setItem(CUSTOM_KEY, '{not json')

    expect(readCustomDevices()).toEqual([])
  })

  it('survives the wrong shape', () => {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify({ a: 1 }))

    expect(readCustomDevices()).toEqual([])
  })

  it('drops invalid entries and keeps valid ones', () => {
    const good = customDevice('Good')
    localStorage.setItem(CUSTOM_KEY, JSON.stringify([good, { id: 'shure-sm7b' }, 'junk']))

    expect(readCustomDevices()).toEqual([good])
  })

  it('does not throw when storage refuses the write', () => {
    vi.stubGlobal('localStorage', {
      ...createMemoryStorage(),
      setItem: () => {
        throw new Error('quota')
      },
    })

    expect(() => writeCustomDevices([customDevice('A')])).not.toThrow()
  })
})

describe('budget storage', () => {
  const BUDGET_KEY = 'soundorp:signal-chain-builder:budget'

  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('round-trips a budget, including zero', () => {
    writeBudget(1250.5)
    expect(readBudget()).toBe(1250.5)
    writeBudget(0)
    expect(readBudget()).toBe(0)
  })

  it('starts empty and clears when written null', () => {
    expect(readBudget()).toBeNull()
    writeBudget(100)
    writeBudget(null)
    expect(readBudget()).toBeNull()
    expect(localStorage.getItem(BUDGET_KEY)).toBeNull()
  })

  it.each(['abc', '-5', 'Infinity', 'NaN', '1000001', '', '   '])('ignores a stored %j', (stored) => {
    localStorage.setItem(BUDGET_KEY, stored)

    expect(readBudget()).toBeNull()
  })

  it('does not throw when storage refuses the write', () => {
    vi.stubGlobal('localStorage', {
      ...createMemoryStorage(),
      setItem: () => {
        throw new Error('quota')
      },
    })

    expect(() => writeBudget(10)).not.toThrow()
  })
})

describe('saved chain storage with custom device snapshots', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps a chain snapshot through a save and load', () => {
    const mic = customDevice('Mic')
    const saved = chain({ deviceIds: [mic.id], customDevices: [mic] })

    writeSavedChains([saved])

    expect(readSavedChains()).toEqual([saved])
  })

  it('still reads chains saved before snapshots existed', () => {
    const legacy = chain({ deviceIds: ['shure-sm7b'] })
    localStorage.setItem(CHAINS_KEY, JSON.stringify([legacy]))

    expect(readSavedChains()).toEqual([legacy])
  })

  it('re-validates a stored snapshot and drops invalid entries', () => {
    const mic = customDevice('Mic')
    const stored = chain({
      deviceIds: [mic.id],
      customDevices: [mic, { ...mic, id: 'shure-sm7b' }, { junk: true }] as never,
    })
    localStorage.setItem(CHAINS_KEY, JSON.stringify([stored]))

    expect(readSavedChains()[0].customDevices).toEqual([mic])
  })

  it('removes a snapshot with nothing valid left rather than keeping an empty list', () => {
    const stored = chain({ customDevices: [{ junk: true }] as never })
    localStorage.setItem(CHAINS_KEY, JSON.stringify([stored]))

    expect(readSavedChains()[0]).not.toHaveProperty('customDevices')
  })
})
