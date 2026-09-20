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
