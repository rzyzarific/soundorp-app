import rawDevices from './devices.json'
import type { Device } from './devices.schema'
import { isValidDevice } from './devices.schema'

/**
 * Filters through the runtime validator rather than trusting the JSON import
 * blindly, so a malformed row (or a corrupted build) degrades to a smaller
 * catalog instead of crashing the app.
 */
export const ALL_DEVICES: Device[] = Array.isArray(rawDevices)
  ? (rawDevices as unknown[]).filter(isValidDevice)
  : []

const byId = new Map(ALL_DEVICES.map((d) => [d.id, d]))

export function getDeviceById(id: string): Device | undefined {
  return byId.get(id)
}

export function searchDevices(query: string): Device[] {
  const q = query.trim().toLowerCase()
  if (q === '') return ALL_DEVICES
  return ALL_DEVICES.filter(
    (d) =>
      d.name.toLowerCase().includes(q) ||
      d.brand.toLowerCase().includes(q) ||
      `${d.brand} ${d.name}`.toLowerCase().includes(q),
  )
}
