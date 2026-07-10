import { beforeEach, describe, expect, it, vi } from 'vitest'
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
