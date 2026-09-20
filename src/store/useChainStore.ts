import { create } from 'zustand'
import type { SignalChain } from '../data/devices.schema'
import { readLicense, readSavedChains, writeLicense, writeSavedChains } from '../lib/storage'
import { activateLicenseKey } from '../lib/licensing'

export const FREE_TIER_SAVED_CHAIN_LIMIT = 1

interface ChainStoreState {
  currentChain: SignalChain
  savedChains: SignalChain[]
  // True once a Lemon Squeezy license key has been activated on this browser
  // (persisted in localStorage). The cap-enforcement logic below reads it directly.
  isPro: boolean
  saveError: string | null
  licenseError: string | null
  isActivatingLicense: boolean

  addDevice: (deviceId: string) => void
  removeDevice: (index: number) => void
  reorderDevice: (fromIndex: number, toIndex: number) => void
  renameCurrentChain: (name: string) => void
  newChain: () => void

  saveCurrentChain: () => void
  loadChain: (chainId: string) => void
  deleteChain: (chainId: string) => void
  clearSaveError: () => void

  activateLicense: (licenseKey: string) => Promise<boolean>
  clearLicenseError: () => void

  loadChainFromShareData: (deviceIds: string[], name?: string) => void
}

function createEmptyChain(): SignalChain {
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    name: 'Untitled chain',
    deviceIds: [],
    createdAt: now,
    updatedAt: now,
  }
}

export const useChainStore = create<ChainStoreState>((set, get) => ({
  currentChain: createEmptyChain(),
  savedChains: readSavedChains(),
  isPro: readLicense() !== null,
  saveError: null,
  licenseError: null,
  isActivatingLicense: false,

  addDevice: (deviceId) =>
    set((state) => ({
      currentChain: {
        ...state.currentChain,
        deviceIds: [...state.currentChain.deviceIds, deviceId],
        updatedAt: Date.now(),
      },
    })),

  removeDevice: (index) =>
    set((state) => ({
      currentChain: {
        ...state.currentChain,
        deviceIds: state.currentChain.deviceIds.filter((_, i) => i !== index),
        updatedAt: Date.now(),
      },
    })),

  reorderDevice: (fromIndex, toIndex) =>
    set((state) => {
      const deviceIds = [...state.currentChain.deviceIds]
      const [moved] = deviceIds.splice(fromIndex, 1)
      deviceIds.splice(toIndex, 0, moved)
      return {
        currentChain: { ...state.currentChain, deviceIds, updatedAt: Date.now() },
      }
    }),

  renameCurrentChain: (name) =>
    set((state) => ({
      currentChain: { ...state.currentChain, name, updatedAt: Date.now() },
    })),

  newChain: () => set({ currentChain: createEmptyChain() }),

  saveCurrentChain: () =>
    set((state) => {
      const now = Date.now()
      const chainToSave: SignalChain = { ...state.currentChain, updatedAt: now }
      const existingIndex = state.savedChains.findIndex((c) => c.id === chainToSave.id)
      const isNewChain = existingIndex === -1

      if (isNewChain && !state.isPro && state.savedChains.length >= FREE_TIER_SAVED_CHAIN_LIMIT) {
        return {
          saveError:
            'Free accounts can save 1 chain at a time. Delete your saved chain or upgrade to Pro for unlimited saved chains.',
        }
      }

      const savedChains = isNewChain
        ? [...state.savedChains, chainToSave]
        : state.savedChains.map((c, i) => (i === existingIndex ? chainToSave : c))

      writeSavedChains(savedChains)
      return { currentChain: chainToSave, savedChains, saveError: null }
    }),

  loadChain: (chainId) => {
    const chain = get().savedChains.find((c) => c.id === chainId)
    if (!chain) return
    set({ currentChain: { ...chain } })
  },

  deleteChain: (chainId) =>
    set((state) => {
      const savedChains = state.savedChains.filter((c) => c.id !== chainId)
      writeSavedChains(savedChains)
      return { savedChains }
    }),

  clearSaveError: () => set({ saveError: null }),

  activateLicense: async (licenseKey) => {
    if (get().isActivatingLicense) return false
    set({ isActivatingLicense: true, licenseError: null })

    const result = await activateLicenseKey(licenseKey)

    if (!result.ok) {
      set({ isActivatingLicense: false, licenseError: result.error })
      return false
    }

    writeLicense(result.license)
    // Also clears any stale free-tier cap message now that the cap no longer applies.
    set({ isPro: true, isActivatingLicense: false, licenseError: null, saveError: null })
    return true
  },

  clearLicenseError: () => set({ licenseError: null }),

  loadChainFromShareData: (deviceIds, name) => {
    const now = Date.now()
    set({
      currentChain: {
        id: crypto.randomUUID(),
        name: name && name.trim() !== '' ? name : 'Shared chain',
        deviceIds,
        createdAt: now,
        updatedAt: now,
      },
    })
  },
}))
