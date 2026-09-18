import type { Device, DeviceCategory } from '../data/devices.schema'

/**
 * Canonical signal-flow order for the soft UI hint only — never consumed by
 * the compatibility engine. Monitors and headphones are interchangeable
 * end points, so they share the last rank.
 */
const CATEGORY_ORDER_RANK: Record<DeviceCategory, number> = {
  microphone: 0,
  preamp: 1,
  audio_interface: 2,
  mixer: 3,
  daw: 4,
  monitor: 5,
  headphones: 5,
}

/**
 * True when the chain's device categories are in non-decreasing canonical
 * order (mic -> preamp -> interface -> mixer -> daw -> monitor/headphones).
 * Chains of 0 or 1 devices have nothing to be out of order, so they pass.
 */
export function isConventionalSignalFlow(devices: Device[]): boolean {
  for (let i = 1; i < devices.length; i++) {
    const prevRank = CATEGORY_ORDER_RANK[devices[i - 1].category]
    const currRank = CATEGORY_ORDER_RANK[devices[i].category]
    if (currRank < prevRank) return false
  }
  return true
}
