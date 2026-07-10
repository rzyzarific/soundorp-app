import { create } from 'zustand'
import type { SignalChain } from '../data/devices.schema'
import { readSavedChains, writeSavedChains } from '../lib/storage'

export const FREE_TIER_SAVED_CHAIN_LIMIT = 1

interface ChainStoreState {
  currentChain: SignalChain
  savedChains: SignalChain[]
  // Always false until Milestone P4 (payments) wires this to a real Supabase-backed
  // flag. Kept as a first-class field now so the cap-enforcement logic below never
  // needs to be touched again when Pro status becomes real.
  isPro: boolean
  saveError: string | null

  addDevice: (deviceId: string) => void
  removeDevice: (index: number) => void
  reorderDevice: (fromIndex: number, toIndex: number) => void
  renameCurrentChain: (name: string) => void
  newChain: () => void

  saveCurrentChain: () => void
  loadChain: (chainId: string) => void
  deleteChain: (chainId: string) => void
  clearSaveError: () => void

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
  isPro: false,
  saveError: null,

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
