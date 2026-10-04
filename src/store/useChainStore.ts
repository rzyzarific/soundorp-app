import { create } from 'zustand'
import type { Device, SignalChain } from '../data/devices.schema'
import {
  readBudget,
  readCustomDevices,
  readLicense,
  readSavedChains,
  writeBudget,
  writeCustomDevices,
  writeLicense,
  writeSavedChains,
} from '../lib/storage'
import { MAX_BUDGET } from '../lib/shoppingList'
import { activateLicenseKey } from '../lib/licensing'
import { trackEvent } from '../lib/analytics'
import type { ProFeature } from '../lib/proFeatures'
import {
  createCustomDevice,
  customDevicesUsedBy,
  type CustomDeviceBuild,
  type CustomDeviceInput,
} from '../lib/customDevices'

export const FREE_TIER_SAVED_CHAIN_LIMIT = 1
export const FREE_TIER_CUSTOM_DEVICE_LIMIT = 1

export type AddCustomDeviceResult =
  | { ok: true; device: Device }
  | { ok: false; reason: 'limit' }
  | { ok: false; reason: 'invalid'; errors: Extract<CustomDeviceBuild, { ok: false }>['errors'] }

interface ChainStoreState {
  currentChain: SignalChain
  savedChains: SignalChain[]
  // The user's own devices (what the free-tier limit counts). Chains carry their own
  // snapshot of the custom devices they use, which is not counted.
  customDevices: Device[]
  // The shopping-list budget in dollars, or null for none. One budget for the whole app,
  // not per chain, and persisted.
  budget: number | null
  // True once a Lemon Squeezy license key has been activated on this browser
  // (persisted in localStorage). The cap-enforcement logic below reads it directly.
  isPro: boolean
  saveError: string | null
  licenseError: string | null
  isActivatingLicense: boolean
  // The Pro feature a free user just tried to use; non-null means the upgrade modal is open.
  upgradeModalFeature: ProFeature | null

  addDevice: (deviceId: string) => void
  insertDevice: (index: number, deviceId: string) => void
  // Replaces every use of one device in the chain with another (shopping-list swaps).
  replaceDevice: (fromId: string, toId: string) => void
  // Returns false and changes nothing if the value isn't a sensible dollar amount.
  setBudget: (budget: number | null) => boolean
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

  openUpgradeModal: (feature: ProFeature) => void
  closeUpgradeModal: () => void

  addCustomDevice: (input: CustomDeviceInput) => AddCustomDeviceResult
  updateCustomDevice: (id: string, input: CustomDeviceInput) => CustomDeviceBuild
  deleteCustomDevice: (id: string) => void

  loadChainFromShareData: (deviceIds: string[], name?: string, customDevices?: Device[]) => void
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
  customDevices: readCustomDevices(),
  budget: readBudget(),
  isPro: readLicense() !== null,
  saveError: null,
  licenseError: null,
  isActivatingLicense: false,
  upgradeModalFeature: null,

  addDevice: (deviceId) =>
    set((state) => ({
      currentChain: {
        ...state.currentChain,
        deviceIds: [...state.currentChain.deviceIds, deviceId],
        updatedAt: Date.now(),
      },
    })),

  insertDevice: (index, deviceId) =>
    set((state) => {
      const deviceIds = [...state.currentChain.deviceIds]
      const at = Math.max(0, Math.min(index, deviceIds.length))
      deviceIds.splice(at, 0, deviceId)
      return { currentChain: { ...state.currentChain, deviceIds, updatedAt: Date.now() } }
    }),

  replaceDevice: (fromId, toId) =>
    set((state) => {
      if (!state.currentChain.deviceIds.includes(fromId)) return {}
      return {
        currentChain: {
          ...state.currentChain,
          deviceIds: state.currentChain.deviceIds.map((id) => (id === fromId ? toId : id)),
          updatedAt: Date.now(),
        },
      }
    }),

  setBudget: (budget) => {
    if (budget !== null && !(Number.isFinite(budget) && budget >= 0 && budget <= MAX_BUDGET)) {
      return false
    }
    writeBudget(budget)
    set({ budget })
    return true
  },

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
      // Snapshot the custom devices this chain uses so it still loads if they're later
      // edited, deleted, or opened somewhere that never had them.
      const usedCustom = customDevicesUsedBy(
        chainToSave.deviceIds,
        state.customDevices,
        state.currentChain.customDevices,
      )
      if (usedCustom.length > 0) chainToSave.customDevices = usedCustom
      else delete chainToSave.customDevices
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
    // Also closes the upgrade modal if the key was entered from there.
    set({
      isPro: true,
      isActivatingLicense: false,
      licenseError: null,
      saveError: null,
      upgradeModalFeature: null,
    })
    trackEvent('license_activated')
    return true
  },

  clearLicenseError: () => set({ licenseError: null }),

  openUpgradeModal: (feature) => {
    // Pro users never see locked features, but guard so a stray call can't pop the modal.
    if (get().isPro) return
    trackEvent('locked_feature_click', { feature })
    set({ upgradeModalFeature: feature, licenseError: null })
  },

  closeUpgradeModal: () => set({ upgradeModalFeature: null, licenseError: null }),

  addCustomDevice: (input) => {
    const state = get()
    // Soft limit, same as the saved-chain cap: it counts the library in this browser.
    if (!state.isPro && state.customDevices.length >= FREE_TIER_CUSTOM_DEVICE_LIMIT) {
      state.openUpgradeModal('custom_devices')
      return { ok: false, reason: 'limit' }
    }

    const built = createCustomDevice(input)
    if (!built.ok) return { ok: false, reason: 'invalid', errors: built.errors }

    const customDevices = [...state.customDevices, built.device]
    writeCustomDevices(customDevices)
    set({ customDevices })
    return { ok: true, device: built.device }
  },

  updateCustomDevice: (id, input) => {
    const state = get()
    if (!state.customDevices.some((d) => d.id === id)) {
      return { ok: false, errors: { name: 'That device no longer exists.' } }
    }

    const built = createCustomDevice(input, id)
    if (!built.ok) return built

    const customDevices = state.customDevices.map((d) => (d.id === id ? built.device : d))
    writeCustomDevices(customDevices)
    set({ customDevices })
    return built
  },

  deleteCustomDevice: (id) =>
    set((state) => {
      const customDevices = state.customDevices.filter((d) => d.id !== id)
      writeCustomDevices(customDevices)

      // Deleting a device removes it from the chain being edited. Saved chains keep their
      // own snapshot, so they are unaffected.
      const chain = state.currentChain
      const snapshot = chain.customDevices?.filter((d) => d.id !== id)
      const nextChain: SignalChain = {
        ...chain,
        deviceIds: chain.deviceIds.filter((deviceId) => deviceId !== id),
        updatedAt: chain.deviceIds.includes(id) ? Date.now() : chain.updatedAt,
      }
      if (snapshot && snapshot.length > 0) nextChain.customDevices = snapshot
      else delete nextChain.customDevices

      return { customDevices, currentChain: nextChain }
    }),

  loadChainFromShareData: (deviceIds, name, customDevices) => {
    const now = Date.now()
    const chain: SignalChain = {
      id: crypto.randomUUID(),
      name: name && name.trim() !== '' ? name : 'Shared chain',
      deviceIds,
      createdAt: now,
      updatedAt: now,
    }
    if (customDevices && customDevices.length > 0) chain.customDevices = customDevices
    set({ currentChain: chain })
  },
}))
