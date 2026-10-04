import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import { getDeviceById } from '../data/devices'
import type { Device } from '../data/devices.schema'
import { MAX_CUSTOM_DEVICES_PER_SHARE, isCustomId, normalizeCustomDevices } from './customDevices'

// A chain longer than this is not a real chain; refuse it rather than process it.
const MAX_SHARED_DEVICES = 200

export const MAX_CHAIN_NAME_LENGTH = 120

// Control characters, and the invisible bidirectional overrides that can make text read
// differently from how it is stored.
const UNSAFE_NAME_CHARS = /[\p{Cc}‎‏‪-‮⁦-⁩]/gu

/**
 * A chain name arriving in a link is shown on a page we host, so it is trimmed of control
 * and direction-override characters and capped. Anything else is plain text, which React
 * escapes; this only stops a crafted link from putting odd or oversized text on our domain.
 */
export function sanitizeChainName(name: string): string {
  return name.replace(UNSAFE_NAME_CHARS, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_CHAIN_NAME_LENGTH)
}

interface SharePayloadV1 {
  v: 1
  n: string
  d: string[]
}

// v2 adds the specs of any custom devices the chain uses, since the recipient has never
// seen them. Chains without custom devices are still written as v1, which keeps their
// links short and readable by older copies of the app.
interface SharePayloadV2 {
  v: 2
  n: string
  d: string[]
  c: unknown[]
}

export interface DecodedShareChain {
  name: string
  deviceIds: string[]
  droppedCount: number
  customDevices: Device[]
}

export function encodeChainToShareParam(chain: {
  name: string
  deviceIds: string[]
  customDevices?: Device[]
}): string {
  const used = (chain.customDevices ?? []).filter(
    (d) => isCustomId(d.id) && chain.deviceIds.includes(d.id),
  )
  const payload: SharePayloadV1 | SharePayloadV2 =
    used.length === 0
      ? { v: 1, n: chain.name, d: chain.deviceIds }
      : { v: 2, n: chain.name, d: chain.deviceIds, c: used }
  return compressToEncodedURIComponent(JSON.stringify(payload))
}

function hasChainFields(p: Record<string, unknown>): boolean {
  return (
    typeof p.n === 'string' &&
    Array.isArray(p.d) &&
    p.d.length <= MAX_SHARED_DEVICES &&
    p.d.every((id) => typeof id === 'string')
  )
}

function isSharePayloadV1(x: unknown): x is SharePayloadV1 {
  if (typeof x !== 'object' || x === null) return false
  const p = x as Record<string, unknown>
  return p.v === 1 && hasChainFields(p)
}

function isSharePayloadV2(x: unknown): x is SharePayloadV2 {
  if (typeof x !== 'object' || x === null) return false
  const p = x as Record<string, unknown>
  return p.v === 2 && hasChainFields(p) && Array.isArray(p.c)
}

/**
 * Filters out any deviceIds that can't be resolved (a catalog device removed since the
 * link was shared, or a custom device whose specs are missing or invalid) rather than
 * failing the whole decode, and reports how many were dropped so the UI can warn the user.
 *
 * Embedded custom devices are rebuilt through the same validation as the add-device form,
 * so a link can't shadow a catalog device or carry anything the form couldn't produce.
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

  let embedded: Device[] = []
  if (isSharePayloadV2(parsed)) {
    embedded = normalizeCustomDevices(parsed.c, MAX_CUSTOM_DEVICES_PER_SHARE)
  } else if (!isSharePayloadV1(parsed)) {
    return null
  }

  const embeddedIds = new Set(embedded.map((d) => d.id))
  const deviceIds = parsed.d.filter(
    (id) => getDeviceById(id) !== undefined || (isCustomId(id) && embeddedIds.has(id)),
  )
  const usedCustom = embedded.filter((d) => deviceIds.includes(d.id))

  return {
    name: sanitizeChainName(parsed.n),
    deviceIds,
    droppedCount: parsed.d.length - deviceIds.length,
    customDevices: usedCustom,
  }
}
