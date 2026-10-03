import type { Device, SignalChain } from '../data/devices.schema'
import type { StoredLicense } from './licensing'
import { normalizeCustomDevices } from './customDevices'

const STORAGE_KEY = 'soundorp:signal-chain-builder:saved-chains'

export function readSavedChains(): SignalChain[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    // A chain's custom-device snapshot came from storage, so re-validate it like any
    // other untrusted input and drop it if nothing valid is left.
    return (parsed as SignalChain[]).map((chain) => {
      if (chain.customDevices === undefined) return chain
      const customDevices = normalizeCustomDevices(chain.customDevices)
      const { customDevices: _stored, ...rest } = chain
      return customDevices.length > 0 ? { ...rest, customDevices } : rest
    })
  } catch {
    return []
  }
}

export function writeSavedChains(chains: SignalChain[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chains))
}

const CUSTOM_DEVICES_KEY = 'soundorp:signal-chain-builder:custom-devices'

export function readCustomDevices(): Device[] {
  try {
    const raw = localStorage.getItem(CUSTOM_DEVICES_KEY)
    return raw ? normalizeCustomDevices(JSON.parse(raw)) : []
  } catch {
    return []
  }
}

export function writeCustomDevices(devices: Device[]): void {
  try {
    localStorage.setItem(CUSTOM_DEVICES_KEY, JSON.stringify(devices))
  } catch {
    // Storage blocked or full: the devices still work for this session.
  }
}

const LICENSE_STORAGE_KEY = 'soundorp:signal-chain-builder:license'

export function readLicense(): StoredLicense | null {
  try {
    const raw = localStorage.getItem(LICENSE_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed?.licenseKey === 'string' && typeof parsed?.instanceId === 'string') {
      return { licenseKey: parsed.licenseKey, instanceId: parsed.instanceId }
    }
    return null
  } catch {
    return null
  }
}

export function writeLicense(license: StoredLicense): void {
  try {
    localStorage.setItem(LICENSE_STORAGE_KEY, JSON.stringify(license))
  } catch {
    // Storage blocked (private mode etc.): Pro still applies for this session.
  }
}
