import type { SignalChain } from '../data/devices.schema'

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
