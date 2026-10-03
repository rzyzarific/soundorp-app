import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { useChainStore as UseChainStore } from './useChainStore'

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
