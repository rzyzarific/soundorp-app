import { describe, expect, it } from 'vitest'
import rawDevices from './devices.json'
import { isValidDevice, isValidVerification } from './devices.schema'
import { ALL_DEVICES, getDeviceById, searchDevices } from './devices'

describe('devices.json', () => {
  it('has a reasonable number of starter devices', () => {
    expect(rawDevices.length).toBeGreaterThanOrEqual(40)
  })

  it('every device passes the runtime validator', () => {
    for (const raw of rawDevices) {
      expect(isValidDevice(raw), `invalid device: ${JSON.stringify(raw)}`).toBe(true)
    }
  })

  it('has unique ids', () => {
    const ids = rawDevices.map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('covers every device category', () => {
    const categories = new Set(rawDevices.map((d) => d.category))
    expect(categories).toEqual(
      new Set(['microphone', 'preamp', 'audio_interface', 'mixer', 'monitor', 'headphones', 'daw']),
    )
  })
})

describe('inline gain boosters', () => {
  const boosters = ALL_DEVICES.filter((d) => d.specs.gainBoost !== undefined)

  it('includes the Cloudlifter, FetHead and DM1', () => {
    expect(boosters.map((d) => d.id).sort()).toEqual([
      'cloud-microphones-cloudlifter-cl-1',
      'se-electronics-dm1-dynamite',
      'triton-audio-fethead',
    ])
  })

  it('models them as XLR in/out devices that need, but never pass on, phantom power', () => {
    for (const b of boosters) {
      expect(b.category).toBe('preamp')
      expect(b.specs.inputConnectors).toEqual(['XLR'])
      expect(b.specs.outputConnectors).toEqual(['XLR'])
      expect(b.specs.needsPhantomPower).toBe(true)
      expect(b.specs.providesPhantomPower).toBeFalsy()
      expect(b.specs.phantomPowerDamages).toBe(false)
      expect(b.specs.maxPreampGain).toBeUndefined()
      expect(b.msrp).toBeGreaterThan(0)
    }
  })

  it('rejects a non-numeric gainBoost', () => {
    const base = boosters[0]
    expect(isValidDevice({ ...base, specs: { ...base.specs, gainBoost: '25' } })).toBe(false)
  })
})

describe('getDeviceById', () => {
  it('resolves a known id', () => {
    expect(getDeviceById('shure-sm7b')?.name).toBe('SM7B')
  })

  it('returns undefined for an unknown id', () => {
    expect(getDeviceById('does-not-exist')).toBeUndefined()
  })
})

describe('searchDevices', () => {
  it('matches by name', () => {
    expect(searchDevices('sm7b').some((d) => d.id === 'shure-sm7b')).toBe(true)
  })

  it('matches by brand', () => {
    expect(searchDevices('shure').length).toBeGreaterThan(0)
  })

  it('returns everything for an empty query', () => {
    expect(searchDevices('')).toEqual(ALL_DEVICES)
  })

  it('returns nothing for a nonsense query', () => {
    expect(searchDevices('zzzznonexistentzzzz')).toEqual([])
  })
})

// Values corrected after checking them against a manufacturer page (or two independent retailer
// listings) in the 2026-10-06 audit. If one of these fails, someone has put back a figure the
// manufacturer contradicts: check the source before changing the test.
describe('specs corrected against manufacturer pages', () => {
  const corrected: Array<[id: string, specs: Record<string, unknown>, source: string]> = [
    ['warm-audio-wa273-eq', { maxPreampGain: 80, micPreampCount: 2 }, 'warmaudio.com/mic-pre-wa73-eq; bswusa.com'],
    ['warm-audio-wa273', { maxPreampGain: 80, micPreampCount: 2 }, 'warmaudio.com/mic-pre-wa73'],
    ['warm-audio-wa412', { maxPreampGain: 65, micPreampCount: 4 }, 'warmaudio.com/wa412'],
    ['warm-audio-wa12', { maxPreampGain: 71 }, 'warmaudio.com/wa12mkii'],
    ['universal-audio-volt-2', { maxPreampGain: 55 }, 'uaudio.com/products/volt-2-usb-audio-interface'],
    ['great-river-mp2nv', { maxPreampGain: 70, micPreampCount: 2 }, 'retrogearshop.com; Great River distributor datasheet'],
    ['tascam-us-2x2', { maxPreampGain: 56 }, 'tascam.com/us/product/us-2x2hr/spec'],
    ['focusrite-scarlett-2i2-4gen', { maxPreampGain: 69 }, 'us.focusrite.com/products/scarlett-2i2'],
    ['apogee-duet-3', { maxPreampGain: 65 }, 'knowledge.apogeedigital.com/how-does-duet-3-compare-to-other-apogee-units'],
    ['universal-audio-solo-610', { maxPreampGain: 60 }, 'uaudio.com/hardware/mic-preamps/solo-610.html'],
    ['audient-mico', { maxPreampGain: 66, micPreampCount: 2 }, 'soundonsound.com/reviews/audient-mico; Audient spec page'],
    ['fmr-audio-rnp8380', { maxPreampGain: 66, micPreampCount: 2 }, 'united-music.by; analoguehaven.com'],
    ['chandler-limited-tg2', { maxPreampGain: 75, micPreampCount: 2 }, 'proaudiodesign.com; zenproaudio.com'],
    ['genelec-8010a', { inputConnectors: ['XLR'] }, 'genelec.com/8010a: "1 x XLR Analog Input"'],
    ['behringer-xenyx-q1202usb', { micPreampCount: 4 }, 'behringer.com/en/products/0601-AGC'],
  ]

  it.each(corrected)('%s matches its source', (id, specs, source) => {
    const device = getDeviceById(id)
    expect(device, id).toBeDefined()
    for (const [key, value] of Object.entries(specs)) {
      expect((device!.specs as Record<string, unknown>)[key], `${id}.${key} (${source})`).toEqual(value)
    }
  })
})

describe('verification', () => {
  const base = getDeviceById('shure-sm58')!
  const withV = (verification: unknown) => ({ ...base, verification })
  const inQuestion = { status: 'in_question', fields: ['minPreampGain'], note: 'Derived estimate.', checkedOn: '2026-10-07' }

  it('accepts each status when it carries what that status needs', () => {
    expect(isValidDevice(withV(inQuestion))).toBe(true)
    expect(isValidDevice(withV({ status: 'in_question', note: 'One review only.', checkedOn: '2026-10-07' }))).toBe(true)
    expect(isValidDevice(withV({ status: 'verified', source: 'https://example.com/spec', checkedOn: '2026-10-07' }))).toBe(true)
    expect(
      isValidDevice(withV({ status: 'inferred', source: 'sibling model', note: 'Jack type not stated.', checkedOn: '2026-10-07' })),
    ).toBe(true)
  })

  it('rejects an entry with no date, a malformed date, or an unknown status', () => {
    const { checkedOn: _omitted, ...noDate } = inQuestion
    expect(isValidDevice(withV(noDate))).toBe(false)
    expect(isValidDevice(withV({ ...inQuestion, checkedOn: '7 Oct 2026' }))).toBe(false)
    expect(isValidDevice(withV({ ...inQuestion, status: 'probably_fine' }))).toBe(false)
  })

  it('rejects "verified" or "inferred" without a source', () => {
    expect(isValidDevice(withV({ status: 'verified', checkedOn: '2026-10-07' }))).toBe(false)
    expect(isValidDevice(withV({ status: 'verified', source: '  ', checkedOn: '2026-10-07' }))).toBe(false)
    expect(isValidDevice(withV({ status: 'inferred', note: 'x', checkedOn: '2026-10-07' }))).toBe(false)
  })

  it('rejects "in_question" or "inferred" without a note saying what is uncertain', () => {
    expect(isValidDevice(withV({ status: 'in_question', checkedOn: '2026-10-07' }))).toBe(false)
    expect(isValidDevice(withV({ status: 'in_question', note: '', checkedOn: '2026-10-07' }))).toBe(false)
    expect(isValidDevice(withV({ status: 'inferred', source: 'sibling', checkedOn: '2026-10-07' }))).toBe(false)
  })

  it('rejects an empty or non-string list of fields', () => {
    expect(isValidDevice(withV({ ...inQuestion, fields: [] }))).toBe(false)
    expect(isValidDevice(withV({ ...inQuestion, fields: [3] }))).toBe(false)
  })

  it('has no entry in the catalog that is incomplete, or that names a spec the device lacks', () => {
    for (const d of rawDevices) {
      const v = (d as { verification?: { fields?: string[] } }).verification
      if (!v) continue
      expect(isValidVerification(v), d.id).toBe(true)
      for (const f of v.fields ?? []) expect(f in d.specs, `${d.id}: no spec "${f}"`).toBe(true)
    }
  })
})
