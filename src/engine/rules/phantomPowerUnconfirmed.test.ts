import { describe, expect, it } from 'vitest'
import { ALL_DEVICES, getDeviceById } from '../../data/devices'
import type { Verification } from '../../data/devices.schema'
import { evaluateChain } from '../evaluateChain'
import { checkPhantomPowerAvailability } from './phantomPowerAvailability'
import { checkPhantomPowerDamage } from './phantomPowerDamage'
import { device } from './testFixtures'

const NOTE = 'Sources disagree about which inputs have phantom power.'
const inQuestion = (fields?: string[], over: Partial<Verification> = {}): Verification => ({
  status: 'in_question',
  fields,
  note: NOTE,
  checkedOn: '2026-10-07',
  ...over,
})

const condenser = (extra = {}) => device({ name: 'Condenser', specs: { needsPhantomPower: true }, ...extra })
const ribbon = (extra = {}) => device({ name: 'Ribbon', specs: { phantomPowerDamages: true }, ...extra })
const mixer = (specs = {}, extra = {}) => device({ name: 'Mixer', category: 'mixer', specs, ...extra })

describe('phantom power availability, when a phantom spec is in question', () => {
  it('turns a would-be pass into an explicit "unconfirmed" warning', () => {
    const r = checkPhantomPowerAvailability(
      condenser(),
      mixer({ providesPhantomPower: true }, { verification: inQuestion(['providesPhantomPower']) }),
    )

    expect(r?.severity).toBe('warning')
    expect(r?.title).toBe('Phantom power unconfirmed')
    expect(r?.unconfirmed).toBe(true)
    expect(r?.detail).toContain(NOTE)
    expect(r?.fix).toMatch(/manual/i)
  })

  it('turns a would-be critical into the same warning, since "no phantom power" is not known either', () => {
    const r = checkPhantomPowerAvailability(
      condenser(),
      mixer({ providesPhantomPower: false }, { verification: inQuestion(['providesPhantomPower']) }),
    )

    expect(r?.severity).toBe('warning')
    expect(r?.unconfirmed).toBe(true)
  })

  it('warns when it is the mic\'s need for phantom power that is in question, even if the mic is listed as not needing it', () => {
    const mic = device({ specs: { needsPhantomPower: false }, verification: inQuestion(['needsPhantomPower']) })
    const r = checkPhantomPowerAvailability(mic, mixer({ providesPhantomPower: false }))

    expect(r?.severity).toBe('warning')
    expect(r?.detail).toContain('needs phantom power is unconfirmed')
  })

  it('reports both doubts in one result when both sides are in question', () => {
    const mic = condenser({ verification: inQuestion(['needsPhantomPower'], { note: 'Mic note.' }) })
    const mix = mixer({ providesPhantomPower: true }, { verification: inQuestion(['providesPhantomPower'], { note: 'Mixer note.' }) })
    const r = checkPhantomPowerAvailability(mic, mix)

    expect(r?.detail).toContain('Mic note.')
    expect(r?.detail).toContain('Mixer note.')
  })

  it('stays silent when the mic is known not to need phantom power, whatever is doubtful downstream', () => {
    const dynamic = device({ specs: { needsPhantomPower: false } })
    const r = checkPhantomPowerAvailability(dynamic, mixer({ providesPhantomPower: true }, { verification: inQuestion(['providesPhantomPower']) }))

    expect(r).toBeNull()
  })

  it('treats an entry with no fields (the whole device) as covering phantom power', () => {
    const r = checkPhantomPowerAvailability(condenser(), mixer({ providesPhantomPower: true }, { verification: inQuestion() }))

    expect(r?.title).toBe('Phantom power unconfirmed')
  })

  it('does not change anything when the doubt is about some other spec, or the entry is not a doubt', () => {
    const otherSpec = mixer({ providesPhantomPower: true }, { verification: inQuestion(['maxPreampGain']) })
    const verified = mixer({ providesPhantomPower: true }, { verification: inQuestion(['providesPhantomPower'], { status: 'verified', source: 'a page' }) })
    const noPhantom = mixer({ providesPhantomPower: false }, { verification: inQuestion(['maxPreampGain']) })

    expect(checkPhantomPowerAvailability(condenser(), otherSpec)?.severity).toBe('pass')
    expect(checkPhantomPowerAvailability(condenser(), verified)?.severity).toBe('pass')
    expect(checkPhantomPowerAvailability(condenser(), noPhantom)?.severity).toBe('critical')
  })
})

describe('phantom power damage, when a phantom spec is in question', () => {
  it('turns a would-be critical into an "unconfirmed" warning when the input\'s phantom supply is in question', () => {
    const r = checkPhantomPowerDamage(
      ribbon(),
      mixer({ providesPhantomPower: true }, { verification: inQuestion(['providesPhantomPower']) }),
    )

    expect(r?.severity).toBe('warning')
    expect(r?.title).toBe('Phantom power risk unconfirmed')
    expect(r?.unconfirmed).toBe(true)
    expect(r?.fix).toMatch(/switched off/i)
  })

  it('still warns when the input is listed as having no phantom power but that is in question: it might', () => {
    const r = checkPhantomPowerDamage(
      ribbon(),
      mixer({ providesPhantomPower: false }, { verification: inQuestion(['providesPhantomPower']) }),
    )

    expect(r?.severity).toBe('warning')
  })

  it('warns when it is the mic\'s vulnerability that is in question, if the input supplies phantom power', () => {
    const mic = device({ specs: { phantomPowerDamages: false }, verification: inQuestion(['phantomPowerDamages']) })

    expect(checkPhantomPowerDamage(mic, mixer({ providesPhantomPower: true }))?.severity).toBe('warning')
  })

  it('stays silent when there can be no damage on either reading', () => {
    const toughMic = device({ specs: { phantomPowerDamages: false } })
    const noSupply = mixer({ providesPhantomPower: false })

    expect(checkPhantomPowerDamage(toughMic, mixer({ providesPhantomPower: true }, { verification: inQuestion(['providesPhantomPower']) }))).toBeNull()
    expect(checkPhantomPowerDamage(device({ specs: { phantomPowerDamages: true }, verification: inQuestion(['phantomPowerDamages']) }), noSupply)).toBeNull()
  })
})

// The concrete case that prompted this: sources disagree on which ZMX122FX inputs have phantom power.
describe('the Alto ZMX122FX, in the real catalog', () => {
  const alto = getDeviceById('alto-professional-zmx122fx')!
  const titles = (chain: ReturnType<typeof getDeviceById>[]) =>
    evaluateChain(chain as never).flatMap((c) => c.results)

  it('is marked in question on phantom power, with the reason', () => {
    expect(alto.verification?.status).toBe('in_question')
    expect(alto.verification?.fields).toContain('providesPhantomPower')
    expect(alto.verification?.note).toMatch(/two with Phantom Power/i)
  })

  it('no longer tells a condenser mic that phantom power is available', () => {
    const results = titles([getDeviceById('rode-nt1a'), alto])

    expect(results.map((r) => r.title)).toContain('Phantom power unconfirmed')
    expect(results.map((r) => r.title)).not.toContain('Phantom power available')
    expect(results.find((r) => r.title === 'Phantom power unconfirmed')?.detail).toMatch(/two with Phantom Power/i)
  })

  it('downgrades the ribbon-mic damage result from critical to unconfirmed', () => {
    const results = titles([getDeviceById('royer-r121'), alto])

    expect(results.map((r) => r.title)).toContain('Phantom power risk unconfirmed')
    expect(results.some((r) => r.severity === 'critical' && /phantom/i.test(r.title))).toBe(false)
  })

  it('does not offer a one-click booster into it: the booster would need phantom power that is unconfirmed', () => {
    const shortfall = evaluateChain([getDeviceById('shure-sm7b')!, alto])[0].results.find((r) => r.problem)

    expect(shortfall).toBeDefined() // the SM7B needs 60 dB; the ZMX122FX gives 50
    expect(shortfall?.actions).toBeUndefined()
  })

  it('leaves a device that is not in question exactly as before', () => {
    const profx = getDeviceById('mackie-profx6v3')!
    expect(titles([getDeviceById('rode-nt1a'), profx]).map((r) => r.title)).toContain('Phantom power available')
    expect(titles([getDeviceById('royer-r121'), profx]).some((r) => r.severity === 'critical' && /damage/i.test(r.title))).toBe(true)
  })
})

// The gain-shortfall advice must match what the app actually offers.
describe('the gain-shortfall advice when no booster is offered because phantom power is unconfirmed', () => {
  const sm7b = getDeviceById('shure-sm7b')!
  const shortfall = (chain: Parameters<typeof evaluateChain>[0]) =>
    evaluateChain(chain)[0].results.find((r) => r.problem?.type === 'gain_shortfall')
  const lowGainMixer = (specs = {}, extra = {}) =>
    mixer({ inputConnectors: ['XLR', 'TRS'], outputConnectors: ['TRS'], providesPhantomPower: true, maxPreampGain: 50, ...specs }, extra)

  it('SM7B into the Alto: no booster button, and no advice to add an inline booster', () => {
    const r = shortfall([sm7b, getDeviceById('alto-professional-zmx122fx')!])

    expect(r).toBeDefined()
    expect(r?.actions).toBeUndefined()
    expect(r?.fix).not.toMatch(/inline gain booster|Cloudlifter/i)
    expect(r?.fix).toMatch(/can't be safely recommended/i)
    expect(r?.fix).toContain("ZMX122FX's phantom power support")
    expect(r?.fix).toMatch(/manufacturer's manual/i)
  })

  it('the same, for a synthetic device (the rule is general)', () => {
    const r = shortfall([sm7b, lowGainMixer({}, { verification: inQuestion(['providesPhantomPower']) })])

    expect(r?.actions).toBeUndefined()
    expect(r?.fix).toMatch(/can't be safely recommended/i)
    expect(r?.fix).toContain("Mixer's phantom power support")
  })

  it('once phantom power is confirmed the booster button returns and the original advice is untouched', () => {
    const r = shortfall([sm7b, lowGainMixer()])

    expect(r?.actions?.length).toBeGreaterThan(0)
    expect(r?.fix).toMatch(/inline gain booster/i)
  })

  it('keeps the original advice when a booster cannot work for some other reason', () => {
    // No phantom power at all (confirmed): a booster could never work, and the doubt is not why.
    const noPhantom = shortfall([sm7b, lowGainMixer({ providesPhantomPower: false })])
    // The doubt is there, but the input has no XLR, so a booster would not fit even if it were lifted.
    const noXlr = shortfall([
      sm7b,
      lowGainMixer({ inputConnectors: ['TRS'] }, { verification: inQuestion(['providesPhantomPower']) }),
    ])

    for (const r of [noPhantom, noXlr]) {
      expect(r?.actions).toBeUndefined()
      expect(r?.fix).toMatch(/inline gain booster/i)
    }
  })

  it('ignores a doubt that is about some other spec', () => {
    const r = shortfall([sm7b, lowGainMixer({}, { verification: inQuestion(['maxPreampGain']) })])

    expect(r?.actions?.length).toBeGreaterThan(0)
    expect(r?.fix).toMatch(/inline gain booster/i)
  })
})

// The general rule, over the whole catalog, so a device flagged in a later audit batch is covered
// without anyone remembering to write a test for it.
describe('every catalog device whose phantom supply is in question', () => {
  const flagged = ALL_DEVICES.filter(
    (d) => d.verification?.status === 'in_question' && (d.verification.fields === undefined || d.verification.fields.includes('providesPhantomPower')),
  )

  it('exists (the Alto is the first)', () => {
    expect(flagged.map((d) => d.id)).toContain('alto-professional-zmx122fx')
  })

  it.each(flagged.map((d) => [d.id, d] as const))('%s never gets a clean pass or a critical about phantom power', (_id, d) => {
    const mic = condenser()
    const rib = ribbon()
    for (const r of [checkPhantomPowerAvailability(mic, d), checkPhantomPowerDamage(rib, d)]) {
      expect(r?.severity).toBe('warning')
      expect(r?.unconfirmed).toBe(true)
    }
  })
})
