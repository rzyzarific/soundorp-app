import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { useChainStore as UseChainStore } from './useChainStore'
import {
  createCustomDevice,
  emptyCustomDeviceInput,
  type CustomDeviceInput,
} from '../lib/customDevices'

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

async function freshStore(): Promise<typeof UseChainStore> {
  vi.resetModules()
  const mod = await import('./useChainStore')
  return mod.useChainStore
}

describe('useChainStore saved-chain cap', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage())
  })

  it('saves the first chain successfully for a free user', async () => {
    const useChainStore = await freshStore()
    useChainStore.getState().addDevice('shure-sm7b')

    useChainStore.getState().saveCurrentChain()

    expect(useChainStore.getState().savedChains).toHaveLength(1)
    expect(useChainStore.getState().saveError).toBeNull()
  })

  it('rejects a second new chain for a free user, leaving the first intact', async () => {
    const useChainStore = await freshStore()
    useChainStore.getState().addDevice('shure-sm7b')
    useChainStore.getState().saveCurrentChain()

    useChainStore.getState().newChain()
    useChainStore.getState().addDevice('rode-nt1')
    useChainStore.getState().saveCurrentChain()

    expect(useChainStore.getState().savedChains).toHaveLength(1)
    expect(useChainStore.getState().saveError).toMatch(/free accounts can save 1 chain/i)
  })

  it('still allows re-saving (updating) the already-saved chain at the cap', async () => {
    const useChainStore = await freshStore()
    useChainStore.getState().addDevice('shure-sm7b')
    useChainStore.getState().saveCurrentChain()

    useChainStore.getState().addDevice('rode-nt1')
    useChainStore.getState().saveCurrentChain()

    expect(useChainStore.getState().savedChains).toHaveLength(1)
    expect(useChainStore.getState().savedChains[0].deviceIds).toEqual(['shure-sm7b', 'rode-nt1'])
    expect(useChainStore.getState().saveError).toBeNull()
  })

  it('clearSaveError resets the error state', async () => {
    const useChainStore = await freshStore()
    useChainStore.getState().addDevice('shure-sm7b')
    useChainStore.getState().saveCurrentChain()
    useChainStore.getState().newChain()
    useChainStore.getState().addDevice('rode-nt1')
    useChainStore.getState().saveCurrentChain()
    expect(useChainStore.getState().saveError).not.toBeNull()

    useChainStore.getState().clearSaveError()

    expect(useChainStore.getState().saveError).toBeNull()
  })

  it('does not enforce the cap once isPro is true', async () => {
    const useChainStore = await freshStore()
    useChainStore.setState({ isPro: true })
    useChainStore.getState().addDevice('shure-sm7b')
    useChainStore.getState().saveCurrentChain()

    useChainStore.getState().newChain()
    useChainStore.getState().addDevice('rode-nt1')
    useChainStore.getState().saveCurrentChain()

    expect(useChainStore.getState().savedChains).toHaveLength(2)
    expect(useChainStore.getState().saveError).toBeNull()
  })
})

describe('useChainStore custom devices', () => {
  const micInput = (name: string, overrides: Partial<CustomDeviceInput> = {}): CustomDeviceInput => ({
    ...emptyCustomDeviceInput('microphone'),
    brand: 'Acme',
    name,
    ...overrides,
  })

  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function added(result: ReturnType<ReturnType<typeof UseChainStore.getState>['addCustomDevice']>) {
    if (!result.ok) throw new Error(`expected add to succeed: ${JSON.stringify(result)}`)
    return result.device
  }

  it('lets a free user add one custom device', async () => {
    const useChainStore = await freshStore()

    const result = useChainStore.getState().addCustomDevice(micInput('First'))

    expect(result.ok).toBe(true)
    expect(useChainStore.getState().customDevices).toHaveLength(1)
    expect(useChainStore.getState().upgradeModalFeature).toBeNull()
  })

  it('blocks a free user from a second one and opens the upgrade modal', async () => {
    const useChainStore = await freshStore()
    useChainStore.getState().addCustomDevice(micInput('First'))

    const second = useChainStore.getState().addCustomDevice(micInput('Second'))

    expect(second).toEqual({ ok: false, reason: 'limit' })
    expect(useChainStore.getState().customDevices.map((d) => d.name)).toEqual(['First'])
    expect(useChainStore.getState().upgradeModalFeature).toBe('custom_devices')
  })

  it('does not enforce the limit for a Pro user', async () => {
    const useChainStore = await freshStore()
    useChainStore.setState({ isPro: true })

    for (const name of ['A', 'B', 'C', 'D']) useChainStore.getState().addCustomDevice(micInput(name))

    expect(useChainStore.getState().customDevices).toHaveLength(4)
    expect(useChainStore.getState().upgradeModalFeature).toBeNull()
  })

  it('rejects invalid input with field errors, without using up the free slot', async () => {
    const useChainStore = await freshStore()

    const bad = useChainStore.getState().addCustomDevice(micInput('   '))

    expect(bad).toMatchObject({ ok: false, reason: 'invalid', errors: { name: expect.any(String) } })
    expect(useChainStore.getState().customDevices).toHaveLength(0)
    expect(useChainStore.getState().addCustomDevice(micInput('Real')).ok).toBe(true)
  })

  it('frees the slot again when the device is deleted', async () => {
    const useChainStore = await freshStore()
    const first = added(useChainStore.getState().addCustomDevice(micInput('First')))

    useChainStore.getState().deleteCustomDevice(first.id)

    expect(useChainStore.getState().addCustomDevice(micInput('Second')).ok).toBe(true)
  })

  it('persists the library across a reload', async () => {
    const useChainStore = await freshStore()
    const device = added(useChainStore.getState().addCustomDevice(micInput('Keeper')))

    const reloaded = await freshStore()

    expect(reloaded.getState().customDevices).toEqual([device])
  })

  it('updates a device in place and persists the edit', async () => {
    const useChainStore = await freshStore()
    const device = added(useChainStore.getState().addCustomDevice(micInput('Old', { minPreampGain: 40 })))

    const result = useChainStore.getState().updateCustomDevice(device.id, micInput('New', { minPreampGain: 55 }))

    expect(result.ok).toBe(true)
    const [stored] = useChainStore.getState().customDevices
    expect(stored).toMatchObject({ id: device.id, name: 'New', specs: { minPreampGain: 55 } })
    expect((await freshStore()).getState().customDevices[0].name).toBe('New')
  })

  it('does not count an edit towards the free limit', async () => {
    const useChainStore = await freshStore()
    const device = added(useChainStore.getState().addCustomDevice(micInput('Only')))

    expect(useChainStore.getState().updateCustomDevice(device.id, micInput('Renamed')).ok).toBe(true)
    expect(useChainStore.getState().upgradeModalFeature).toBeNull()
  })

  it('rejects an invalid edit and leaves the device untouched', async () => {
    const useChainStore = await freshStore()
    const device = added(useChainStore.getState().addCustomDevice(micInput('Keep')))

    const result = useChainStore.getState().updateCustomDevice(device.id, micInput(''))

    expect(result.ok).toBe(false)
    expect(useChainStore.getState().customDevices[0].name).toBe('Keep')
  })

  it('refuses to edit a device that does not exist', async () => {
    const useChainStore = await freshStore()

    expect(useChainStore.getState().updateCustomDevice('custom-nope', micInput('X')).ok).toBe(false)
  })

  it('removes a deleted device from the chain being edited', async () => {
    const useChainStore = await freshStore()
    useChainStore.setState({ isPro: true })
    const a = added(useChainStore.getState().addCustomDevice(micInput('A')))
    useChainStore.getState().addDevice('shure-sm7b')
    useChainStore.getState().addDevice(a.id)
    useChainStore.getState().addDevice(a.id)

    useChainStore.getState().deleteCustomDevice(a.id)

    expect(useChainStore.getState().currentChain.deviceIds).toEqual(['shure-sm7b'])
    expect(useChainStore.getState().customDevices).toEqual([])
  })

  it('snapshots the custom devices a chain uses when it is saved', async () => {
    const useChainStore = await freshStore()
    useChainStore.setState({ isPro: true })
    const used = added(useChainStore.getState().addCustomDevice(micInput('Used')))
    added(useChainStore.getState().addCustomDevice(micInput('Unused')))
    useChainStore.getState().addDevice(used.id)
    useChainStore.getState().addDevice('shure-sm7b')

    useChainStore.getState().saveCurrentChain()

    expect(useChainStore.getState().savedChains[0].customDevices).toEqual([used])
  })

  it('does not add a snapshot to chains that use only catalog devices', async () => {
    const useChainStore = await freshStore()
    useChainStore.getState().addDevice('shure-sm7b')

    useChainStore.getState().saveCurrentChain()

    expect(useChainStore.getState().savedChains[0]).not.toHaveProperty('customDevices')
  })

  it('keeps a saved chain working after its custom device is deleted from the library', async () => {
    const useChainStore = await freshStore()
    const device = added(useChainStore.getState().addCustomDevice(micInput('Gone Soon')))
    useChainStore.getState().addDevice(device.id)
    useChainStore.getState().saveCurrentChain()
    const chainId = useChainStore.getState().currentChain.id

    useChainStore.getState().deleteCustomDevice(device.id)
    useChainStore.getState().newChain()
    useChainStore.getState().loadChain(chainId)

    const loaded = useChainStore.getState().currentChain
    expect(loaded.deviceIds).toEqual([device.id])
    expect(loaded.customDevices).toEqual([device])
  })

  it('survives a reload with the snapshot intact', async () => {
    const useChainStore = await freshStore()
    const device = added(useChainStore.getState().addCustomDevice(micInput('Persisted')))
    useChainStore.getState().addDevice(device.id)
    useChainStore.getState().saveCurrentChain()

    const reloaded = await freshStore()

    expect(reloaded.getState().savedChains[0].customDevices).toEqual([device])
  })

  it('loads a shared chain with its custom devices without using the free slot', async () => {
    const useChainStore = await freshStore()
    const theirs = createCustomDevice(micInput('Their Mic'))
    if (!theirs.ok) throw new Error('fixture')

    useChainStore.getState().loadChainFromShareData([theirs.device.id], 'Shared', [theirs.device])

    expect(useChainStore.getState().currentChain.customDevices).toEqual([theirs.device])
    expect(useChainStore.getState().customDevices).toEqual([]) // not in my library
    expect(useChainStore.getState().addCustomDevice(micInput('Mine')).ok).toBe(true) // slot still free
  })

  it('lets someone save a shared chain and keep its custom devices', async () => {
    const useChainStore = await freshStore()
    const theirs = createCustomDevice(micInput('Their Mic'))
    if (!theirs.ok) throw new Error('fixture')
    useChainStore.getState().loadChainFromShareData([theirs.device.id], 'Shared', [theirs.device])

    useChainStore.getState().saveCurrentChain()

    expect(useChainStore.getState().savedChains[0].customDevices).toEqual([theirs.device])
  })

  it('leaves out the snapshot for a shared chain with no custom devices', async () => {
    const useChainStore = await freshStore()

    useChainStore.getState().loadChainFromShareData(['shure-sm7b'], 'Plain', [])

    expect(useChainStore.getState().currentChain).not.toHaveProperty('customDevices')
  })

  it('starts a new chain without the previous chain’s snapshot', async () => {
    const useChainStore = await freshStore()
    const theirs = createCustomDevice(micInput('Their Mic'))
    if (!theirs.ok) throw new Error('fixture')
    useChainStore.getState().loadChainFromShareData([theirs.device.id], 'Shared', [theirs.device])

    useChainStore.getState().newChain()

    expect(useChainStore.getState().currentChain).not.toHaveProperty('customDevices')
  })
})

describe('useChainStore replaceDevice', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  async function storeWith(...ids: string[]) {
    const useChainStore = await freshStore()
    ids.forEach((id) => useChainStore.getState().addDevice(id))
    return useChainStore
  }

  it('replaces the device in place, keeping the order of everything else', async () => {
    const useChainStore = await storeWith('a', 'b', 'c')

    useChainStore.getState().replaceDevice('b', 'x')

    expect(useChainStore.getState().currentChain.deviceIds).toEqual(['a', 'x', 'c'])
  })

  it('replaces every occurrence of a repeated device', async () => {
    const useChainStore = await storeWith('a', 'b', 'a')

    useChainStore.getState().replaceDevice('a', 'x')

    expect(useChainStore.getState().currentChain.deviceIds).toEqual(['x', 'b', 'x'])
  })

  it('does nothing, and does not touch updatedAt, when the device is not in the chain', async () => {
    const useChainStore = await storeWith('a')
    const before = useChainStore.getState().currentChain

    useChainStore.getState().replaceDevice('nope', 'x')

    expect(useChainStore.getState().currentChain).toBe(before)
  })

  it('bumps updatedAt when it does replace something', async () => {
    const useChainStore = await storeWith('a')
    const before = useChainStore.getState().currentChain.updatedAt
    await new Promise((r) => setTimeout(r, 2))

    useChainStore.getState().replaceDevice('a', 'x')

    expect(useChainStore.getState().currentChain.updatedAt).toBeGreaterThan(before)
  })

  it('does not touch saved chains until the user saves', async () => {
    const useChainStore = await storeWith('a', 'b')
    useChainStore.getState().saveCurrentChain()

    useChainStore.getState().replaceDevice('a', 'x')

    expect(useChainStore.getState().savedChains[0].deviceIds).toEqual(['a', 'b'])
  })
})

describe('useChainStore budget', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('starts with no budget', async () => {
    expect((await freshStore()).getState().budget).toBeNull()
  })

  it('stores a valid budget and persists it across a reload', async () => {
    const useChainStore = await freshStore()

    expect(useChainStore.getState().setBudget(750)).toBe(true)

    expect(useChainStore.getState().budget).toBe(750)
    expect((await freshStore()).getState().budget).toBe(750)
  })

  it('accepts zero as a real budget', async () => {
    const useChainStore = await freshStore()

    expect(useChainStore.getState().setBudget(0)).toBe(true)
    expect(useChainStore.getState().budget).toBe(0)
    expect((await freshStore()).getState().budget).toBe(0)
  })

  it('clears the budget, including from storage', async () => {
    const useChainStore = await freshStore()
    useChainStore.getState().setBudget(500)

    useChainStore.getState().setBudget(null)

    expect(useChainStore.getState().budget).toBeNull()
    expect((await freshStore()).getState().budget).toBeNull()
  })

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, 1_000_001])(
    'rejects %s and keeps the previous budget',
    async (bad) => {
      const useChainStore = await freshStore()
      useChainStore.getState().setBudget(300)

      expect(useChainStore.getState().setBudget(bad)).toBe(false)

      expect(useChainStore.getState().budget).toBe(300)
      expect((await freshStore()).getState().budget).toBe(300)
    },
  )

  it('is one budget for the app, not per chain', async () => {
    const useChainStore = await freshStore()
    useChainStore.getState().setBudget(900)

    useChainStore.getState().newChain()

    expect(useChainStore.getState().budget).toBe(900)
  })
})

describe('useChainStore insertDevice', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  async function storeWith(...ids: string[]) {
    const useChainStore = await freshStore()
    ids.forEach((id) => useChainStore.getState().addDevice(id))
    return useChainStore
  }

  it('inserts between two devices', async () => {
    const useChainStore = await storeWith('a', 'c')

    useChainStore.getState().insertDevice(1, 'b')

    expect(useChainStore.getState().currentChain.deviceIds).toEqual(['a', 'b', 'c'])
  })

  it('can insert at the very start and the very end', async () => {
    const useChainStore = await storeWith('b')

    useChainStore.getState().insertDevice(0, 'a')
    useChainStore.getState().insertDevice(2, 'c')

    expect(useChainStore.getState().currentChain.deviceIds).toEqual(['a', 'b', 'c'])
  })

  it('clamps an out-of-range index instead of corrupting the chain', async () => {
    const useChainStore = await storeWith('a', 'b')

    useChainStore.getState().insertDevice(99, 'c')
    useChainStore.getState().insertDevice(-5, 'z')

    expect(useChainStore.getState().currentChain.deviceIds).toEqual(['z', 'a', 'b', 'c'])
  })

  it('allows the same device twice and bumps updatedAt', async () => {
    const useChainStore = await storeWith('a')
    const before = useChainStore.getState().currentChain.updatedAt

    await new Promise((r) => setTimeout(r, 2))
    useChainStore.getState().insertDevice(1, 'a')

    expect(useChainStore.getState().currentChain.deviceIds).toEqual(['a', 'a'])
    expect(useChainStore.getState().currentChain.updatedAt).toBeGreaterThan(before)
  })

  it('does not touch saved chains until the user saves', async () => {
    const useChainStore = await storeWith('a', 'c')
    useChainStore.getState().saveCurrentChain()

    useChainStore.getState().insertDevice(1, 'b')

    expect(useChainStore.getState().savedChains[0].deviceIds).toEqual(['a', 'c'])
  })
})

describe('useChainStore license activation', () => {
  const activated = {
    activated: true,
    license_key: { status: 'active', expires_at: null },
    instance: { id: 'inst-1' },
    meta: {},
  }

  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage())
    // Don't let a developer's .env.local product/store ids leak into these tests.
    vi.stubEnv('VITE_LEMONSQUEEZY_STORE_ID', '')
    vi.stubEnv('VITE_LEMONSQUEEZY_PRODUCT_ID', '')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('starts free when no license is stored', async () => {
    const useChainStore = await freshStore()
    expect(useChainStore.getState().isPro).toBe(false)
  })

  it('sets isPro, persists the license, and lifts the save cap on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200, json: async () => activated }))
    const useChainStore = await freshStore()

    const ok = await useChainStore.getState().activateLicense('good-key')

    expect(ok).toBe(true)
    expect(useChainStore.getState().isPro).toBe(true)
    expect(useChainStore.getState().licenseError).toBeNull()
    expect(JSON.parse(localStorage.getItem('soundorp:signal-chain-builder:license')!)).toEqual({
      licenseKey: 'good-key',
      instanceId: 'inst-1',
    })

    useChainStore.getState().addDevice('shure-sm7b')
    useChainStore.getState().saveCurrentChain()
    useChainStore.getState().newChain()
    useChainStore.getState().addDevice('rode-nt1')
    useChainStore.getState().saveCurrentChain()
    expect(useChainStore.getState().savedChains).toHaveLength(2)
  })

  it('stays free, stores nothing, and exposes licenseError on a bad key', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ status: 404, json: async () => ({ activated: false, error: 'license_key not found.' }) }),
    )
    const useChainStore = await freshStore()

    const ok = await useChainStore.getState().activateLicense('bad-key')

    expect(ok).toBe(false)
    expect(useChainStore.getState().isPro).toBe(false)
    expect(useChainStore.getState().licenseError).toMatch(/wasn't recognised/i)
    expect(useChainStore.getState().isActivatingLicense).toBe(false)
    expect(localStorage.getItem('soundorp:signal-chain-builder:license')).toBeNull()

    useChainStore.getState().clearLicenseError()
    expect(useChainStore.getState().licenseError).toBeNull()
  })

  it('restores isPro from a stored license on load', async () => {
    localStorage.setItem(
      'soundorp:signal-chain-builder:license',
      JSON.stringify({ licenseKey: 'k', instanceId: 'i' }),
    )
    const useChainStore = await freshStore()
    expect(useChainStore.getState().isPro).toBe(true)
  })

  it('ignores a malformed stored license', async () => {
    localStorage.setItem('soundorp:signal-chain-builder:license', '{"licenseKey":1}')
    const useChainStore = await freshStore()
    expect(useChainStore.getState().isPro).toBe(false)
  })
})

describe('useChainStore upgrade modal', () => {
  const activated = {
    activated: true,
    license_key: { status: 'active', expires_at: null },
    instance: { id: 'inst-1' },
    meta: {},
  }
  const trackEvent = vi.fn()

  async function freshStoreWithTracking(): Promise<typeof UseChainStore> {
    vi.resetModules()
    vi.doMock('../lib/analytics', () => ({ trackEvent }))
    const mod = await import('./useChainStore')
    return mod.useChainStore
  }

  beforeEach(() => {
    trackEvent.mockClear()
    vi.stubGlobal('localStorage', createMemoryStorage())
    vi.stubEnv('VITE_LEMONSQUEEZY_STORE_ID', '')
    vi.stubEnv('VITE_LEMONSQUEEZY_PRODUCT_ID', '')
  })

  afterEach(() => {
    vi.doUnmock('../lib/analytics')
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('starts closed', async () => {
    const useChainStore = await freshStoreWithTracking()
    expect(useChainStore.getState().upgradeModalFeature).toBeNull()
  })

  it('opens for a free user and records locked_feature_click', async () => {
    const useChainStore = await freshStoreWithTracking()

    useChainStore.getState().openUpgradeModal('pdf_export')

    expect(useChainStore.getState().upgradeModalFeature).toBe('pdf_export')
    expect(trackEvent).toHaveBeenCalledWith('locked_feature_click', { feature: 'pdf_export' })
  })

  it('opens for unlimited_chains and records which feature was hit', async () => {
    const useChainStore = await freshStoreWithTracking()

    useChainStore.getState().openUpgradeModal('unlimited_chains')

    expect(useChainStore.getState().upgradeModalFeature).toBe('unlimited_chains')
    expect(trackEvent).toHaveBeenCalledWith('locked_feature_click', { feature: 'unlimited_chains' })
  })

  it('does not open for a Pro user', async () => {
    const useChainStore = await freshStoreWithTracking()
    useChainStore.setState({ isPro: true })

    useChainStore.getState().openUpgradeModal('pdf_export')

    expect(useChainStore.getState().upgradeModalFeature).toBeNull()
    expect(trackEvent).not.toHaveBeenCalled()
  })

  it('closes and clears a stale license error', async () => {
    const useChainStore = await freshStoreWithTracking()
    useChainStore.getState().openUpgradeModal('pdf_export')
    useChainStore.setState({ licenseError: 'nope' })

    useChainStore.getState().closeUpgradeModal()

    expect(useChainStore.getState().upgradeModalFeature).toBeNull()
    expect(useChainStore.getState().licenseError).toBeNull()
  })

  it('closes and records license_activated when a key is activated from the modal', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200, json: async () => activated }))
    const useChainStore = await freshStoreWithTracking()
    useChainStore.getState().openUpgradeModal('pdf_export')

    const ok = await useChainStore.getState().activateLicense('good-key')

    expect(ok).toBe(true)
    expect(useChainStore.getState().upgradeModalFeature).toBeNull()
    expect(trackEvent).toHaveBeenCalledWith('license_activated')
  })

  it('stays open and records no activation when the key is bad', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ status: 404, json: async () => ({ activated: false, error: 'license_key not found.' }) }),
    )
    const useChainStore = await freshStoreWithTracking()
    useChainStore.getState().openUpgradeModal('pdf_export')

    const ok = await useChainStore.getState().activateLicense('bad-key')

    expect(ok).toBe(false)
    expect(useChainStore.getState().upgradeModalFeature).toBe('pdf_export')
    expect(trackEvent).not.toHaveBeenCalledWith('license_activated')
  })
})
