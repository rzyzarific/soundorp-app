import { describe, expect, it } from 'vitest'
import {
  CUSTOM_ID_PREFIX,
  MAX_NAME_LENGTH,
  createCustomDevice,
  customDevicesUsedBy,
  deviceToInput,
  emptyCustomDeviceInput,
  isCustomId,
  normalizeCustomDevice,
  normalizeCustomDevices,
  resolveChainDevices,
  type CustomDeviceInput,
} from './customDevices'
import { getDeviceById } from '../data/devices'
import type { Device } from '../data/devices.schema'

function input(overrides: Partial<CustomDeviceInput> = {}): CustomDeviceInput {
  return { ...emptyCustomDeviceInput('microphone'), brand: 'Acme', name: 'Ribbon One', ...overrides }
}

function build(overrides: Partial<CustomDeviceInput> = {}, id?: string): Device {
  const result = createCustomDevice(input(overrides), id)
  if (!result.ok) throw new Error(`build failed: ${JSON.stringify(result.errors)}`)
  return result.device
}

describe('createCustomDevice', () => {
  it('builds a valid custom device with a custom- id and the isCustom flag', () => {
    const device = build()

    expect(device.id.startsWith(CUSTOM_ID_PREFIX)).toBe(true)
    expect(isCustomId(device.id)).toBe(true)
    expect(device).toMatchObject({ name: 'Ribbon One', brand: 'Acme', category: 'microphone', isCustom: true })
    expect(device.specs.outputConnectors).toEqual(['XLR'])
  })

  it('gives each device a fresh id, but keeps a supplied one when editing', () => {
    expect(build().id).not.toBe(build().id)
    expect(build({}, 'custom-abc-123').id).toBe('custom-abc-123')
  })

  it('trims text and falls back to "Custom" when the brand is blank', () => {
    const device = build({ brand: '   ', name: '  Mystery Mic  ' })

    expect(device.brand).toBe('Custom')
    expect(device.name).toBe('Mystery Mic')
  })

  it('requires a name', () => {
    const result = createCustomDevice(input({ name: '   ' }))

    expect(result).toEqual({ ok: false, errors: { name: 'Enter a name.' } })
  })

  it('rejects over-long names and brands', () => {
    const result = createCustomDevice(input({ name: 'x'.repeat(MAX_NAME_LENGTH + 1), brand: 'y'.repeat(41) }))

    expect(result.ok).toBe(false)
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(['brand', 'name'])
  })

  it('rejects an unknown category', () => {
    const result = createCustomDevice(input({ category: 'toaster' as never }))

    expect(result.ok).toBe(false)
  })

  it('treats blank numbers as "not specified"', () => {
    const device = build({ category: 'microphone', minPreampGain: undefined, msrp: undefined })

    expect(device.specs.minPreampGain).toBeUndefined()
    expect(device.msrp).toBeUndefined()
  })

  it.each([
    ['msrp', -1],
    ['msrp', 100_001],
    ['msrp', Number.NaN],
    ['minPreampGain', -5],
    ['minPreampGain', 101],
    ['minPreampGain', Number.POSITIVE_INFINITY],
  ] as const)('rejects %s = %s', (field, value) => {
    const result = createCustomDevice(input({ [field]: value }))

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors[field]).toBeTruthy()
  })

  it('accepts the boundary values', () => {
    expect(createCustomDevice(input({ msrp: 0, minPreampGain: 0 })).ok).toBe(true)
    expect(createCustomDevice(input({ msrp: 100_000, minPreampGain: 100 })).ok).toBe(true)
  })

  it('keeps only the specs that make sense for the category', () => {
    // A monitor can't need phantom power or have gain, even if stale form state says so.
    const monitor = build({
      category: 'monitor',
      inputConnectors: ['TRS'],
      outputConnectors: ['XLR'],
      needsPhantomPower: true,
      providesPhantomPower: true,
      minPreampGain: 40,
      maxPreampGain: 60,
      gainBoost: 25,
    })

    expect(monitor.specs).toEqual({ inputConnectors: ['TRS'] })
  })

  it('maps a ribbon microphone onto the specs the engine reads', () => {
    const mic = build({ phantomPowerDamages: true, minPreampGain: 58 })

    expect(mic.specs).toMatchObject({ phantomPowerDamages: true, minPreampGain: 58, outputConnectors: ['XLR'] })
  })

  it('maps an interface with phantom power, gain and a headphone jack', () => {
    const iface = build({
      category: 'audio_interface',
      inputConnectors: ['XLR', 'TRS'],
      outputConnectors: ['USB-C', 'TRS'],
      headphoneOutputConnectors: ['3.5mm'],
      providesPhantomPower: true,
      maxPreampGain: 56,
    })

    expect(iface.specs).toEqual({
      inputConnectors: ['XLR', 'TRS'],
      outputConnectors: ['USB-C', 'TRS'],
      headphoneOutputConnectors: ['3.5mm'],
      providesPhantomPower: true,
      maxPreampGain: 56,
    })
  })

  it('supports a custom inline booster: phantom-powered preamp that adds gain', () => {
    const booster = build({
      category: 'preamp',
      inputConnectors: ['XLR'],
      outputConnectors: ['XLR'],
      needsPhantomPower: true,
      gainBoost: 20,
    })

    expect(booster.specs).toMatchObject({ needsPhantomPower: true, gainBoost: 20 })
  })

  it('drops duplicate and invalid connectors', () => {
    const device = build({ outputConnectors: ['XLR', 'XLR', 'bogus' as never, 'TRS'] })

    expect(device.specs.outputConnectors).toEqual(['XLR', 'TRS'])
  })

  it('omits a connector list entirely when nothing is selected', () => {
    expect(build({ outputConnectors: [] }).specs.outputConnectors).toBeUndefined()
  })
})

describe('emptyCustomDeviceInput', () => {
  it('pre-fills sensible connectors for the category', () => {
    expect(emptyCustomDeviceInput('monitor').inputConnectors).toEqual(['TRS', 'XLR'])
    expect(emptyCustomDeviceInput('audio_interface').outputConnectors).toEqual(['USB-C', 'TRS'])
  })

  it('does not share arrays between calls', () => {
    const a = emptyCustomDeviceInput('microphone')
    a.outputConnectors.push('TRS')

    expect(emptyCustomDeviceInput('microphone').outputConnectors).toEqual(['XLR'])
  })
})

describe('deviceToInput', () => {
  it('round-trips through createCustomDevice', () => {
    const original = build({
      category: 'audio_interface',
      inputConnectors: ['XLR'],
      outputConnectors: ['USB-A', 'RCA'],
      headphoneOutputConnectors: ['TRS'],
      providesPhantomPower: true,
      maxPreampGain: 50,
      msrp: 149,
    })

    const rebuilt = createCustomDevice(deviceToInput(original), original.id)

    expect(rebuilt).toEqual({ ok: true, device: original })
  })

  it('shows a blank brand for the "Custom" fallback', () => {
    expect(deviceToInput(build({ brand: '' })).brand).toBe('')
  })
})

describe('normalizeCustomDevice (untrusted input)', () => {
  const good = () => build({ minPreampGain: 40 })

  it('accepts a device the builder produced', () => {
    const device = good()

    expect(normalizeCustomDevice(device)).toEqual(device)
  })

  it('rejects anything that is not a well-formed device', () => {
    expect(normalizeCustomDevice(null)).toBeNull()
    expect(normalizeCustomDevice('nope')).toBeNull()
    expect(normalizeCustomDevice({ id: 'custom-x' })).toBeNull()
  })

  it('refuses a catalog id, so a link cannot shadow a real device', () => {
    const impostor = { ...good(), id: 'shure-sm7b' }

    expect(normalizeCustomDevice(impostor)).toBeNull()
  })

  it.each(['custom-', 'custom-has space', 'custom-<script>', `custom-${'a'.repeat(65)}`, 'custom-ünï'])(
    'refuses the unsafe id %j',
    (id) => {
      expect(normalizeCustomDevice({ ...good(), id })).toBeNull()
    },
  )

  it('strips links and unknown fields the form could never produce', () => {
    const tainted = {
      ...good(),
      reviewUrl: 'javascript:alert(1)',
      verification: { status: 'verified', source: 'trust me', checkedOn: '2026-10-07' },
      affiliateLinks: { amazon: 'https://evil.example' },
      subtype: 'whatever',
      extra: 'junk',
      specs: { ...good().specs, micPreampCount: 99, outputImpedance: 5, unknown: 1 },
    }

    const cleaned = normalizeCustomDevice(tainted)!

    expect(cleaned).not.toHaveProperty('reviewUrl')
    expect(cleaned).not.toHaveProperty('verification') // a shared link cannot claim a device is verified
    expect(cleaned).not.toHaveProperty('affiliateLinks')
    expect(cleaned).not.toHaveProperty('extra')
    expect(cleaned.specs).not.toHaveProperty('micPreampCount')
    expect(cleaned.specs).not.toHaveProperty('unknown')
  })

  it('rejects out-of-range specs rather than clamping them', () => {
    const wild = { ...good(), specs: { ...good().specs, minPreampGain: 9999 } }

    expect(normalizeCustomDevice(wild)).toBeNull()
  })

  it('forces the isCustom flag on, whatever the input said', () => {
    expect(normalizeCustomDevice({ ...good(), isCustom: false })?.isCustom).toBe(true)
  })
})

describe('normalizeCustomDevices', () => {
  it('keeps the valid ones, drops the rest and de-duplicates by id', () => {
    const a = build({ name: 'A' })
    const b = build({ name: 'B' })

    const result = normalizeCustomDevices([a, { nope: true }, b, a, 42])

    expect(result.map((d) => d.name)).toEqual(['A', 'B'])
  })

  it('returns nothing for a non-array', () => {
    expect(normalizeCustomDevices({})).toEqual([])
    expect(normalizeCustomDevices(undefined)).toEqual([])
  })

  it('honours a maximum count', () => {
    const many = Array.from({ length: 10 }, (_, i) => build({ name: `D${i}` }))

    expect(normalizeCustomDevices(many, 3)).toHaveLength(3)
  })
})

describe('resolveChainDevices', () => {
  const sm7b = getDeviceById('shure-sm7b')!

  it('resolves catalog devices', () => {
    const { devices, missingIds } = resolveChainDevices(['shure-sm7b'], [])

    expect(devices).toEqual([sm7b])
    expect(missingIds).toEqual([])
  })

  it('resolves custom devices from the library and from the chain snapshot', () => {
    const inLibrary = build({ name: 'Library' })
    const inSnapshot = build({ name: 'Snapshot' })

    const { devices } = resolveChainDevices([inSnapshot.id, 'shure-sm7b', inLibrary.id], [inLibrary], [inSnapshot])

    expect(devices.map((d) => d.name)).toEqual(['Snapshot', 'SM7B', 'Library'])
  })

  it('prefers the library over a stale snapshot, so edits show up', () => {
    const edited = build({ name: 'Edited' }, 'custom-same')
    const stale = build({ name: 'Stale' }, 'custom-same')

    const { devices } = resolveChainDevices(['custom-same'], [edited], [stale])

    expect(devices[0].name).toBe('Edited')
  })

  it('reports ids it cannot resolve, in order', () => {
    const { devices, missingIds } = resolveChainDevices(['gone', 'shure-sm7b', 'custom-gone'], [])

    expect(devices).toEqual([sm7b])
    expect(missingIds).toEqual(['gone', 'custom-gone'])
  })

  it('allows the same device more than once', () => {
    expect(resolveChainDevices(['shure-sm7b', 'shure-sm7b'], []).devices).toHaveLength(2)
  })
})

describe('customDevicesUsedBy', () => {
  it('lists each custom device once, in order of first use, ignoring catalog devices', () => {
    const a = build({ name: 'A' })
    const b = build({ name: 'B' })

    const used = customDevicesUsedBy([b.id, 'shure-sm7b', a.id, b.id], [a, b])

    expect(used.map((d) => d.name)).toEqual(['B', 'A'])
  })

  it('leaves out library devices the chain does not use', () => {
    const a = build({ name: 'A' })
    const unused = build({ name: 'Unused' })

    expect(customDevicesUsedBy([a.id], [a, unused])).toEqual([a])
  })

  it('falls back to the snapshot when the library no longer has the device', () => {
    const a = build({ name: 'A' })

    expect(customDevicesUsedBy([a.id], [], [a])).toEqual([a])
  })

  it('returns an empty list for a chain with no custom devices', () => {
    expect(customDevicesUsedBy(['shure-sm7b'], [build()])).toEqual([])
  })
})
