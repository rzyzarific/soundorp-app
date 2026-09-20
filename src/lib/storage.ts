import type { SignalChain } from '../data/devices.schema'
import type { StoredLicense } from './licensing'

const STORAGE_KEY = 'soundorp:signal-chain-builder:saved-chains'

export function readSavedChains(): SignalChain[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as SignalChain[]) : []
  } catch {
    return []
  }
}

export function writeSavedChains(chains: SignalChain[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chains))
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
