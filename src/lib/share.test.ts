import { describe, expect, it } from 'vitest'
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import { encodeChainToShareParam, decodeShareParam } from './share'
import {
  MAX_CUSTOM_DEVICES_PER_SHARE,
  createCustomDevice,
  emptyCustomDeviceInput,
  type CustomDeviceInput,
} from './customDevices'
import { ALL_DEVICES } from '../data/devices'
import type { Device } from '../data/devices.schema'

const TEN_DEVICE_IDS = ALL_DEVICES.slice(0, 10).map((d) => d.id)

describe('encodeChainToShareParam', () => {
  it('keeps a realistic 10-device chain well under the ~2000 char URL-safe limit', () => {
    const encoded = encodeChainToShareParam({ name: 'My home studio chain', deviceIds: TEN_DEVICE_IDS })

    expect(encoded.length).toBeLessThan(500)
  })
})

describe('encode -> decode round trip', () => {
  it('reconstructs the original name and deviceIds', () => {
    const original = { name: 'Podcast setup', deviceIds: TEN_DEVICE_IDS }
    const encoded = encodeChainToShareParam(original)

    const decoded = decodeShareParam(encoded)

    expect(decoded).not.toBeNull()
    expect(decoded?.name).toBe(original.name)
    expect(decoded?.deviceIds).toEqual(original.deviceIds)
    expect(decoded?.droppedCount).toBe(0)
  })

  it('filters out deviceIds no longer present in the catalog', () => {
    const encoded = encodeChainToShareParam({
      name: 'Chain with a removed device',
      deviceIds: [TEN_DEVICE_IDS[0], 'no-longer-exists', TEN_DEVICE_IDS[1]],
    })

    const decoded = decodeShareParam(encoded)

    expect(decoded?.deviceIds).toEqual([TEN_DEVICE_IDS[0], TEN_DEVICE_IDS[1]])
    expect(decoded?.droppedCount).toBe(1)
  })

  it('returns null for garbage input', () => {
    expect(decodeShareParam('not-a-real-encoded-string')).toBeNull()
  })
})

function customDevice(name: string, overrides: Partial<CustomDeviceInput> = {}): Device {
  const built = createCustomDevice({
    ...emptyCustomDeviceInput('microphone'),
    brand: 'Acme',
    name,
    minPreampGain: 45,
    ...overrides,
  })
  if (!built.ok) throw new Error('fixture failed')
  return built.device
}

// Mirrors what the app wrote before custom devices existed.
function legacyV1Param(name: string, deviceIds: string[]): string {
  return compressToEncodedURIComponent(JSON.stringify({ v: 1, n: name, d: deviceIds }))
}

function rawParam(payload: unknown): string {
  return compressToEncodedURIComponent(JSON.stringify(payload))
}

function payloadOf(param: string): Record<string, unknown> {
  return JSON.parse(decompressFromEncodedURIComponent(param)!)
}

describe('v1 links (shared before custom devices existed)', () => {
  it('still decode, with no custom devices', () => {
    const decoded = decodeShareParam(legacyV1Param('Old link', TEN_DEVICE_IDS))

    expect(decoded).toEqual({
      name: 'Old link',
      deviceIds: TEN_DEVICE_IDS,
      droppedCount: 0,
      customDevices: [],
    })
  })

  it('are still what we write for a chain without custom devices', () => {
    const encoded = encodeChainToShareParam({ name: 'Plain', deviceIds: TEN_DEVICE_IDS })

    expect(payloadOf(encoded)).toEqual({ v: 1, n: 'Plain', d: TEN_DEVICE_IDS })
  })

  it('stay v1 even if an unused custom device is passed along', () => {
    const unused = customDevice('Unused')
    const encoded = encodeChainToShareParam({
      name: 'Plain',
      deviceIds: TEN_DEVICE_IDS,
      customDevices: [unused],
    })

    expect(payloadOf(encoded).v).toBe(1)
  })

  it('treats a custom id in a v1 link as unresolvable', () => {
    const decoded = decodeShareParam(legacyV1Param('Odd', [TEN_DEVICE_IDS[0], 'custom-abc']))

    expect(decoded?.deviceIds).toEqual([TEN_DEVICE_IDS[0]])
    expect(decoded?.droppedCount).toBe(1)
  })
})

describe('v2 links (with custom devices)', () => {
  it('round-trips a chain that mixes catalog and custom devices', () => {
    const mic = customDevice('My Ribbon', { phantomPowerDamages: true })
    const deviceIds = [mic.id, TEN_DEVICE_IDS[0], mic.id]

    const encoded = encodeChainToShareParam({ name: 'Mixed', deviceIds, customDevices: [mic] })
    const decoded = decodeShareParam(encoded)

    expect(payloadOf(encoded).v).toBe(2)
    expect(decoded).toEqual({ name: 'Mixed', deviceIds, droppedCount: 0, customDevices: [mic] })
  })

  it('embeds only the custom devices the chain actually uses', () => {
    const used = customDevice('Used')
    const unused = customDevice('Unused')

    const encoded = encodeChainToShareParam({
      name: 'x',
      deviceIds: [used.id],
      customDevices: [used, unused],
    })

    expect(decodeShareParam(encoded)?.customDevices).toEqual([used])
  })

  it('keeps the link of a realistic chain with three custom devices short enough for a URL', () => {
    const customs = [customDevice('Mic A'), customDevice('Mic B'), customDevice('Mic C')]
    const encoded = encodeChainToShareParam({
      name: 'Podcast with three guests',
      deviceIds: [...customs.map((c) => c.id), ...TEN_DEVICE_IDS],
      customDevices: customs,
    })

    expect(encoded.length).toBeLessThan(1500)
  })

  it('drops a custom id whose specs were not embedded, and counts it', () => {
    const mic = customDevice('Mic')
    const param = rawParam({ v: 2, n: 'x', d: [mic.id, 'custom-missing'], c: [mic] })

    const decoded = decodeShareParam(param)

    expect(decoded?.deviceIds).toEqual([mic.id])
    expect(decoded?.droppedCount).toBe(1)
  })

  it('ignores embedded devices the chain does not reference', () => {
    const mic = customDevice('Mic')
    const stray = customDevice('Stray')
    const param = rawParam({ v: 2, n: 'x', d: [mic.id], c: [mic, stray] })

    expect(decodeShareParam(param)?.customDevices).toEqual([mic])
  })

  it('drops an embedded device that fails validation', () => {
    const mic = customDevice('Mic')
    const broken = { ...mic, specs: { ...mic.specs, minPreampGain: 'loud' } }
    const param = rawParam({ v: 2, n: 'x', d: [mic.id], c: [broken] })

    const decoded = decodeShareParam(param)

    expect(decoded?.deviceIds).toEqual([])
    expect(decoded?.droppedCount).toBe(1)
    expect(decoded?.customDevices).toEqual([])
  })

  it('cannot override a catalog device by embedding one with the same id', () => {
    const impostor = { ...customDevice('Fake SM7B'), id: 'shure-sm7b' }
    const param = rawParam({ v: 2, n: 'x', d: ['shure-sm7b'], c: [impostor] })

    const decoded = decodeShareParam(param)

    expect(decoded?.deviceIds).toEqual(['shure-sm7b']) // still the real catalog device
    expect(decoded?.customDevices).toEqual([]) // the impostor was discarded
  })

  it('strips links and unknown fields from embedded devices', () => {
    const mic = customDevice('Mic')
    const tainted = { ...mic, reviewUrl: 'javascript:alert(1)', affiliateLinks: { amazon: 'x' } }
    const param = rawParam({ v: 2, n: 'x', d: [mic.id], c: [tainted] })

    const [cleaned] = decodeShareParam(param)!.customDevices

    expect(cleaned).not.toHaveProperty('reviewUrl')
    expect(cleaned).not.toHaveProperty('affiliateLinks')
  })

  it('caps how many embedded devices it will accept', () => {
    const many = Array.from({ length: 40 }, (_, i) => customDevice(`Mic ${i}`))
    const param = rawParam({ v: 2, n: 'x', d: many.map((m) => m.id), c: many })

    const decoded = decodeShareParam(param)

    expect(decoded?.customDevices).toHaveLength(MAX_CUSTOM_DEVICES_PER_SHARE)
    expect(decoded?.droppedCount).toBe(40 - MAX_CUSTOM_DEVICES_PER_SHARE)
  })
})

describe('malformed links', () => {
  it.each([
    ['an unknown future version', { v: 3, n: 'x', d: [] }],
    ['a v2 payload with no device list', { v: 2, n: 'x', c: [] }],
    ['a v2 payload whose custom list is not an array', { v: 2, n: 'x', d: [], c: 'nope' }],
    ['a non-string name', { v: 1, n: 5, d: [] }],
    ['non-string device ids', { v: 1, n: 'x', d: [1, 2] }],
    ['an absurdly long chain', { v: 1, n: 'x', d: Array.from({ length: 5000 }, () => 'shure-sm7b') }],
    ['null', null],
    ['a bare number', 7],
  ])('rejects %s', (_label, payload) => {
    expect(decodeShareParam(rawParam(payload))).toBeNull()
  })
})
