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
    ['yamaha-mg20xu', { maxPreampGain: 64, micPreampCount: 16 }, 'musicredone.com; Yamaha technical specifications'],
    ['grace-design-m101', { maxPreampGain: 75 }, 'gracedesign.com: mic input 10-65 dB plus 10 dB output trim, "overall maximum of 75dB"'],
    ['tascam-series-208i', { maxPreampGain: 58, micPreampCount: 4 }, 'Tascam spec sheet: maximum gain 58 dB, four mic/line combo inputs'],
    ['zoom-ams-24', { maxPreampGain: 58 }, 'Zoom AMS-24 manual: input gain -inf to +58 dB'],
    ['alto-professional-zmx122fx', { maxPreampGain: 50, micPreampCount: 4 }, 'andertons.co.uk; bajaao.com: 0 dB to 50 dB (Mic), four mic inputs'],
    ['dbx-286s', { maxPreampGain: 60, outputConnectors: ['TRS'] }, 'dbxpro.com datasheet: mic gain 0 to 60 dB; line output 1/4" TRS only'],
    ['presonus-studio-68c', { micPreampCount: 4 }, 'presonus.com: four XMAX-L mic preamps'],
    ['motu-m2', { maxPreampGain: 60 }, 'MOTU M-Series user guide: mic gain range 0 to +60 dB'],
    ['motu-m4', { maxPreampGain: 60 }, 'MOTU M-Series user guide: mic gain range 0 to +60 dB'],
    ['steinberg-ur44c', { maxPreampGain: 60, micPreampCount: 4 }, 'UR44C operation manual: mic input gain range +6 to +60 dB'],
    ['yamaha-mg10xu', { maxPreampGain: 64, micPreampCount: 4 }, 'Yamaha MG10XU technical specifications: GAIN trim +64 dB'],
    ['yamaha-mg12xu', { maxPreampGain: 64, micPreampCount: 6 }, 'Yamaha MG12X/MG12XU technical specifications: GAIN trim +64 dB'],
    ['yamaha-mg16xu', { maxPreampGain: 64, micPreampCount: 10 }, 'Yamaha MG16X/MG16XU technical specifications: GAIN trim +64 dB'],
    ['yamaha-mg06', { maxPreampGain: 64, micPreampCount: 2 }, 'Yamaha MG06 technical specifications: GAIN trim +64 dB'],
    ['behringer-xenyx-302usb', { maxPreampGain: 55 }, 'musiciansfriend.com: +15dB to +55dB'],
    ['focusrite-vocaster-two', { maxPreampGain: 70 }, 'us.focusrite.com/products/vocaster-two'],
    ['focusrite-vocaster-one', { maxPreampGain: 70 }, 'us.focusrite.com/products/vocaster-one'],
    ['golden-age-pre-73', { maxPreampGain: 80 }, 'greentoe.com: PRE-73 MKIII 20 to 80 dB'],
    ['focusrite-scarlett-solo-4gen', { maxPreampGain: 57 }, 'us.focusrite.com/products/scarlett-solo'],
    ['motu-8a', { inputConnectors: ['TRS'] }, 'motu.com/products/avb/8a/specs.html: 8 x 1/4" TRS line inputs'],
  ]

  it('gives the MOTU 8A no mic preamp, phantom power or gain: it has line inputs only', () => {
    const specs = getDeviceById('motu-8a')!.specs
    expect(specs.providesPhantomPower).toBeUndefined()
    expect(specs.maxPreampGain).toBeUndefined()
    expect(specs.micPreampCount).toBeUndefined()
  })

  it('has no "Scarlett 4i4 (2nd Gen)": Focusrite has no such product', () => {
    // Focusrite's 2nd Gen range is Solo, Solo Studio, 2i2, 2i2 Studio, 2i4, 6i6, 18i8 and 18i20
    // (downloads.focusrite.com/focusrite/scarlett-2nd-gen). The 4i4 arrived with the 3rd Gen.
    expect(getDeviceById('focusrite-scarlett-4i4-2gen')).toBeUndefined()
    expect(getDeviceById('focusrite-scarlett-4i4-3gen')).toBeDefined()
    expect(getDeviceById('focusrite-scarlett-4i4-4gen')).toBeDefined()
  })

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

  const questionOn = (id: string, field: string) => {
    const v = (rawDevices.find((d) => d.id === id) as { verification?: { status: string; fields?: string[] } } | undefined)
      ?.verification
    return v?.status === 'in_question' && (v.fields ?? []).includes(field)
  }

  it('flags minPreampGain on every microphone: it is an estimate no manufacturer publishes', () => {
    const mics = rawDevices.filter((d) => d.category === 'microphone' && d.specs.minPreampGain !== undefined)
    expect(mics.length).toBeGreaterThan(70)
    for (const m of mics) expect(questionOn(m.id, 'minPreampGain'), m.id).toBe(true)
  })

  it('flags the input list of every DAW: software has no connectors', () => {
    for (const d of rawDevices.filter((x) => x.category === 'daw' && x.specs.inputConnectors)) {
      expect(questionOn(d.id, 'inputConnectors'), d.id).toBe(true)
    }
  })

  it.each([
    'native-instruments-komplete-audio-2',
    'native-instruments-komplete-audio-6',
    'antelope-zen-go-synergy-core',
    'presonus-studio-26c',
    'presonus-studio-1810c',
    'art-pro-mpa-ii',
    'behringer-umc204hd',
    'behringer-umc1820',
    'zoom-h4essential',
    'universal-audio-la610-mkii',
    'yamaha-mgp12x',
    'soundcraft-notepad-12fx',
    'soundcraft-ui12',
  ])('flags the gain of %s: it could not be confirmed against a source', (id) => {
    expect(questionOn(id, 'maxPreampGain'), id).toBe(true)
  })

  it('flags the values that agree with a source only through a search extract', () => {
    for (const [id, field] of [
      ['steinberg-ur22c', 'maxPreampGain'],
      ['behringer-xenyx-x1204usb', 'maxPreampGain'],
      ['behringer-xenyx-802', 'maxPreampGain'],
      ['zoom-uac-2', 'maxPreampGain'],
      ['spl-crimson-3', 'maxPreampGain'],
      ['rupert-neve-shelford-channel', 'maxPreampGain'],
      ['shure-srh440', 'inputConnectors'],
    ]) {
      expect(questionOn(id, field), id).toBe(true)
    }
  })

  it.each([
    'presonus-studio-68c',
    'presonus-quantum-2626',
    'presonus-studio-192',
    'presonus-dp88',
    'ik-multimedia-axe-io',
    'tc-helicon-goxlr',
  ])('flags the gain of %s: no maximum gain is stated by a source', (id) => {
    expect(questionOn(id, 'maxPreampGain'), id).toBe(true)
  })

  it('flags a USB port type that a manufacturer says is not what the catalog lists', () => {
    // Both name a USB-B port; the schema has no USB-B, and the cable list prints the entry as the cable to buy.
    expect(questionOn('tascam-series-208i', 'outputConnectors')).toBe(true)
    expect(questionOn('ik-multimedia-axe-io', 'outputConnectors')).toBe(true)
  })

  it('flags the ZMX122FX phantom power: one flag per device cannot say "only two of four inputs"', () => {
    expect(questionOn('alto-professional-zmx122fx', 'providesPhantomPower')).toBe(true)
  })

  it('labels combined input-plus-trim gain figures as such', () => {
    for (const id of ['grace-design-m101', 'great-river-mp2nv']) {
      const v = (rawDevices.find((d) => d.id === id) as { verification?: { status: string; note?: string } }).verification
      expect(v?.status, id).toBe('verified')
      expect(v?.note, id).toMatch(/combined figure/i)
    }
  })

  it('does not flag gains that a manufacturer document confirmed', () => {
    for (const id of ['motu-m2', 'motu-m4', 'steinberg-ur44c', 'dbx-286s', 'grace-design-m101', 'tascam-series-208i', 'zoom-ams-24']) {
      expect(questionOn(id, 'maxPreampGain'), id).toBe(false)
    }
    for (const id of ['yamaha-mg20xu', 'yamaha-mg10xu', 'allen-heath-zed60-14fx', 'allen-heath-qu16', 'mackie-profx6v3', 'tascam-us-2x2']) {
      expect(questionOn(id, 'maxPreampGain'), id).toBe(false)
    }
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
