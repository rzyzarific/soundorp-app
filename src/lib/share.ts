import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import { getDeviceById } from '../data/devices'

const SCHEMA_VERSION = 1

interface SharePayloadV1 {
  v: 1
  n: string
  d: string[]
}

export interface DecodedShareChain {
  name: string
  deviceIds: string[]
  droppedCount: number
}

export function encodeChainToShareParam(chain: { name: string; deviceIds: string[] }): string {
  const payload: SharePayloadV1 = { v: SCHEMA_VERSION, n: chain.name, d: chain.deviceIds }
  return compressToEncodedURIComponent(JSON.stringify(payload))
}

function isSharePayloadV1(x: unknown): x is SharePayloadV1 {
  if (typeof x !== 'object' || x === null) return false
  const p = x as Record<string, unknown>
  return (
    p.v === SCHEMA_VERSION &&
    typeof p.n === 'string' &&
    Array.isArray(p.d) &&
    p.d.every((id) => typeof id === 'string')
  )
}

/**
 * Filters out any deviceIds no longer present in devices.json (the catalog
 * may have changed since the link was shared) rather than failing the whole
 * decode, and reports how many were dropped so the UI can warn the user.
 */
export function decodeShareParam(encoded: string): DecodedShareChain | null {
  const json = decompressFromEncodedURIComponent(encoded)
  if (!json) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return null
  }

  if (!isSharePayloadV1(parsed)) return null

  const deviceIds = parsed.d.filter((id) => getDeviceById(id) !== undefined)

  return {
    name: parsed.n,
    deviceIds,
    droppedCount: parsed.d.length - deviceIds.length,
  }
}
