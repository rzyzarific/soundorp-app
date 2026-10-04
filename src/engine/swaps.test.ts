import { describe, expect, it } from 'vitest'
import { findCheaperAlternatives, isNoWorse } from './swaps'
import { evaluatePairs } from './evaluatePairs'
import { device } from './rules/testFixtures'
import { ALL_DEVICES, getDeviceById } from '../data/devices'
import type { Device } from '../data/devices.schema'
import type { CheckResult, CheckSeverity, ConnectionCheckResult } from './types'

function connection(index: number, ...results: Array<[CheckSeverity, string]>): ConnectionCheckResult {
  return {
    connectionIndex: index,
    upstreamId: 'a',
    downstreamId: 'b',
    results: results.map(([severity, title]): CheckResult => ({ severity, title, detail: '' })),
  }
}

describe('isNoWorse', () => {
  it('accepts an unchanged chain', () => {
    const same = [connection(0, ['warning', 'Insufficient gain headroom'], ['pass', 'Connectors match'])]

    expect(isNoWorse(same, same)).toBe(true)
  })

  it('accepts problems going away', () => {
    const before = [connection(0, ['critical', 'No phantom power available'])]
    const after = [connection(0, ['pass', 'Phantom power available'])]

    expect(isNoWorse(before, after)).toBe(true)
  })

  it('accepts a critical softening to a warning', () => {
    expect(
      isNoWorse([connection(0, ['critical', 'X'])], [connection(0, ['warning', 'X'])]),
    ).toBe(true)
  })

  it('rejects a new warning', () => {
    const before = [connection(0, ['pass', 'Connectors match'])]
    const after = [connection(0, ['warning', 'No matching connector'])]

    expect(isNoWorse(before, after)).toBe(false)
  })

  it('rejects a new critical', () => {
    expect(isNoWorse([connection(0)], [connection(0, ['critical', 'No phantom power available'])])).toBe(false)
  })

  it('rejects a warning escalating to a critical', () => {
    expect(isNoWorse([connection(0, ['warning', 'X'])], [connection(0, ['critical', 'X'])])).toBe(false)
  })

  it('treats the same title on a different connection as a new problem', () => {
    const before = [connection(0, ['warning', 'X']), connection(1)]
    const after = [connection(0), connection(1, ['warning', 'X'])]

    expect(isNoWorse(before, after)).toBe(false)
  })

  it('lets a pre-existing warning stay without counting it as new', () => {
    const before = [connection(0, ['warning', 'X']), connection(1)]
    const after = [connection(0, ['warning', 'X']), connection(1, ['pass', 'ok'])]

    expect(isNoWorse(before, after)).toBe(true)
  })
})

function shortfall(
  index: number,
  gap: number,
  type: 'gain_shortfall' | 'boosted_gain_shortfall' = 'gain_shortfall',
): ConnectionCheckResult {
  return {
    connectionIndex: index,
    upstreamId: 'a',
    downstreamId: 'b',
    results: [
      {
        severity: 'warning',
        title: 'Insufficient gain headroom',
        detail: '',
        problem: { type, gap },
      },
    ],
  }
}

describe('isNoWorse and gain shortfalls', () => {
  it('rejects a shortfall that got bigger, even though it is the same warning at the same severity', () => {
    expect(isNoWorse([shortfall(0, 4)], [shortfall(0, 10)])).toBe(false)
  })

  it('rejects even a one-dB increase', () => {
    expect(isNoWorse([shortfall(0, 4)], [shortfall(0, 5)])).toBe(false)
  })

  it('accepts a shortfall that stays the same', () => {
    expect(isNoWorse([shortfall(0, 4)], [shortfall(0, 4)])).toBe(true)
  })

  it('accepts a shortfall that shrinks', () => {
    expect(isNoWorse([shortfall(0, 10)], [shortfall(0, 4)])).toBe(true)
  })

  it('accepts a shortfall that disappears', () => {
    expect(isNoWorse([shortfall(0, 10)], [connection(0, ['pass', 'Sufficient gain headroom'])])).toBe(true)
  })

  it('applies to the shortfall left over after a booster as well', () => {
    expect(isNoWorse([shortfall(0, 5, 'boosted_gain_shortfall')], [shortfall(0, 9, 'boosted_gain_shortfall')])).toBe(false)
    expect(isNoWorse([shortfall(0, 5, 'boosted_gain_shortfall')], [shortfall(0, 5, 'boosted_gain_shortfall')])).toBe(true)
  })

  it('compares each connection on its own, so one shrinking cannot hide another growing', () => {
    const before = [shortfall(0, 10), shortfall(1, 2)]
    const after = [shortfall(0, 1), shortfall(1, 6)]

    expect(isNoWorse(before, after)).toBe(false)
  })

  it('does not let a shortfall move to a connection that had none', () => {
    expect(isNoWorse([shortfall(0, 4), connection(1)], [connection(0), shortfall(1, 4)])).toBe(false)
  })

  it('still ignores results with no problem attached', () => {
    const plain = [connection(0, ['warning', 'Insufficient gain headroom'])]

    expect(isNoWorse(plain, plain)).toBe(true)
  })
})

describe('findCheaperAlternatives', () => {
  const dynamic = (id: string, msrp: number | undefined, extra: Partial<Device> = {}) =>
    device({
      id,
      name: id,
      msrp,
      subtype: 'dynamic',
      specs: { outputConnectors: ['XLR'], minPreampGain: 40 },
      ...extra,
    })
  const iface = device({
    id: 'iface',
    name: 'iface',
    category: 'audio_interface',
    msrp: 200,
    specs: { inputConnectors: ['XLR'], providesPhantomPower: true, maxPreampGain: 56 },
  })

  it('offers cheaper same-kind devices that keep the chain intact', () => {
    const current = dynamic('pricey', 400)
    const catalog = [dynamic('mid', 150), dynamic('cheap', 50)]

    const result = findCheaperAlternatives([current, iface], 'pricey', catalog)

    expect(result.map((r) => r.to.id)).toEqual(['mid', 'cheap'])
    expect(result.map((r) => r.saving)).toEqual([250, 350])
  })

  it('orders by closest price first (the smallest step down)', () => {
    const catalog = [dynamic('c50', 50), dynamic('c300', 300), dynamic('c120', 120)]

    const ids = findCheaperAlternatives([dynamic('cur', 400), iface], 'cur', catalog).map((r) => r.to.id)

    expect(ids).toEqual(['c300', 'c120', 'c50'])
  })

  it('returns at most the limit', () => {
    const catalog = Array.from({ length: 10 }, (_, i) => dynamic(`m${i}`, 10 + i))

    expect(findCheaperAlternatives([dynamic('cur', 400), iface], 'cur', catalog)).toHaveLength(3)
    expect(findCheaperAlternatives([dynamic('cur', 400), iface], 'cur', catalog, 5)).toHaveLength(5)
  })

  it('never offers something as expensive or dearer', () => {
    const catalog = [dynamic('same', 400), dynamic('dearer', 500)]

    expect(findCheaperAlternatives([dynamic('cur', 400), iface], 'cur', catalog)).toEqual([])
  })

  it('never offers the device itself', () => {
    const cur = dynamic('cur', 400)

    expect(findCheaperAlternatives([cur, iface], 'cur', [cur])).toEqual([])
  })

  it('has no alternatives for a device with no price, or when the candidate has none', () => {
    expect(findCheaperAlternatives([dynamic('cur', undefined), iface], 'cur', [dynamic('c', 10)])).toEqual([])
    expect(findCheaperAlternatives([dynamic('cur', 400), iface], 'cur', [dynamic('unpriced', undefined)])).toEqual([])
  })

  it('treats a price of zero as a real price', () => {
    const result = findCheaperAlternatives([dynamic('cur', 100), iface], 'cur', [dynamic('free', 0)])

    expect(result.map((r) => r.saving)).toEqual([100])
  })

  it('returns nothing for an id that is not in the chain', () => {
    expect(findCheaperAlternatives([dynamic('cur', 400), iface], 'nope', [dynamic('c', 10)])).toEqual([])
  })

  it('stays within the category', () => {
    const wrongCategory = device({ id: 'pre', name: 'pre', category: 'preamp', msrp: 10, specs: { outputConnectors: ['XLR'] } })

    expect(findCheaperAlternatives([dynamic('cur', 400), iface], 'cur', [wrongCategory])).toEqual([])
  })

  it('keeps a mic’s type: dynamic is not swapped for a cheaper condenser', () => {
    const condenser = dynamic('cond', 50, { subtype: 'condenser', specs: { outputConnectors: ['XLR'], minPreampGain: 30 } })

    expect(findCheaperAlternatives([dynamic('cur', 400), iface], 'cur', [condenser])).toEqual([])
  })

  it('rejects a swap that adds a new problem: a cheaper mic that needs phantom power on an interface without it', () => {
    const noPhantom = device({
      ...iface,
      id: 'iface2',
      specs: { ...iface.specs, providesPhantomPower: false },
    })
    const hungry = dynamic('hungry', 50, { specs: { outputConnectors: ['XLR'], minPreampGain: 40, needsPhantomPower: true } })

    // Straight dynamic → no-phantom interface is fine; the phantom-hungry "alternative" is not.
    expect(findCheaperAlternatives([dynamic('cur', 400), noPhantom], 'cur', [hungry])).toEqual([])
  })

  it('rejects a swap that introduces a gain shortfall', () => {
    const lowOutput = dynamic('low', 50, { specs: { outputConnectors: ['XLR'], minPreampGain: 70 } }) // interface tops out at 56
    const fine = dynamic('fine', 60)

    const ids = findCheaperAlternatives([dynamic('cur', 400), iface], 'cur', [lowOutput, fine]).map((r) => r.to.id)

    expect(ids).toEqual(['fine'])
  })

  it('rejects a swap that introduces a connector mismatch', () => {
    const usbMic = dynamic('usb', 50, { specs: { outputConnectors: ['USB-C'], minPreampGain: 40 } })

    expect(findCheaperAlternatives([dynamic('cur', 400), iface], 'cur', [usbMic])).toEqual([])
  })

  it('allows an alternative when the chain already had that same warning (not new)', () => {
    const tooQuiet = dynamic('cur', 400, { specs: { outputConnectors: ['XLR'], minPreampGain: 70 } })
    const stillQuiet = dynamic('alt', 100, { specs: { outputConnectors: ['XLR'], minPreampGain: 70 } })

    const result = findCheaperAlternatives([tooQuiet, iface], 'cur', [stillQuiet])

    expect(result.map((r) => r.to.id)).toEqual(['alt'])
  })

  describe('never makes an existing gain shortfall bigger', () => {
    // 70 dB needed against 56 available: a 14 dB shortfall that is already in the chain.
    const quietMic = dynamic('quiet', 400, { specs: { outputConnectors: ['XLR'], minPreampGain: 70 } })
    const withGain = (id: string, maxPreampGain: number, msrp = 200): Device =>
      device({
        ...iface,
        id,
        name: id,
        msrp,
        specs: { ...iface.specs, maxPreampGain },
      })
    const baseline = withGain('base', 56, 300)

    it('excludes a cheaper interface with less gain, though it is the same warning', () => {
      const ids = findCheaperAlternatives([quietMic, baseline], 'base', [withGain('weaker', 46)]).map((r) => r.to.id)

      expect(ids).toEqual([])
    })

    it('still offers one with the same gain, or more', () => {
      const ids = findCheaperAlternatives([quietMic, baseline], 'base', [
        withGain('same', 56),
        withGain('stronger', 66),
      ]).map((r) => r.to.id)

      expect(ids.sort()).toEqual(['same', 'stronger'])
    })

    it('excludes a cheaper mic that needs more gain, and offers one that needs the same or less', () => {
      const demanding = dynamic('demanding', 100, { specs: { outputConnectors: ['XLR'], minPreampGain: 75 } })
      const same = dynamic('same', 100, { specs: { outputConnectors: ['XLR'], minPreampGain: 70 } })
      const easier = dynamic('easier', 100, { specs: { outputConnectors: ['XLR'], minPreampGain: 50 } })

      const ids = findCheaperAlternatives([quietMic, baseline], 'quiet', [demanding, same, easier]).map((r) => r.to.id)

      expect(ids.sort()).toEqual(['easier', 'same'])
    })

    it('does the same when a booster is already in the chain and a shortfall remains', () => {
      const booster = device({
        id: 'cl',
        name: 'cl',
        category: 'preamp',
        msrp: 149,
        specs: { inputConnectors: ['XLR'], outputConnectors: ['XLR'], needsPhantomPower: true, gainBoost: 10 },
      })
      // 70 - 10 = 60 needed against 56: still 4 dB short even with the booster.
      const chain = [quietMic, booster, baseline]

      const ids = findCheaperAlternatives(chain, 'base', [withGain('weaker', 50), withGain('same', 56)]).map((r) => r.to.id)

      expect(ids).toEqual(['same'])
    })

    it('does not apply when the chain has no shortfall to protect', () => {
      const fine = dynamic('fine', 400, { specs: { outputConnectors: ['XLR'], minPreampGain: 30 } })

      const ids = findCheaperAlternatives([fine, baseline], 'base', [withGain('weaker', 40)]).map((r) => r.to.id)

      expect(ids).toEqual(['weaker']) // 30 dB needed, 40 available: no shortfall created
    })
  })

  describe('never loses a fix the chain already has', () => {
    const booster = (id: string, msrp: number, gainBoost?: number): Device =>
      device({
        id,
        name: id,
        category: 'preamp',
        msrp,
        specs: {
          inputConnectors: ['XLR'],
          outputConnectors: ['XLR'],
          needsPhantomPower: true,
          ...(gainBoost !== undefined && { gainBoost }),
        },
      })
    const quietMic = dynamic('quiet', 300, { specs: { outputConnectors: ['XLR'], minPreampGain: 60 } })
    const weakInterface = device({
      ...iface,
      id: 'weak',
      specs: { ...iface.specs, maxPreampGain: 40 },
    })

    it('swaps a booster only for another booster that still closes the gap', () => {
      const chain = [quietMic, booster('cl', 149, 25), weakInterface] // 60 - 25 = 35 ≤ 40
      const catalog = [booster('fet', 90, 27), booster('weaker', 60, 10), booster('plain-preamp', 40)]

      const ids = findCheaperAlternatives(chain, 'cl', catalog).map((r) => r.to.id)

      expect(ids).toEqual(['fet']) // 'weaker' reopens the shortfall; 'plain-preamp' isn't a booster
    })

    it('never replaces a booster with a non-booster, even if nothing visibly breaks', () => {
      // The interface has headroom to spare, so the chain would still pass without the boost.
      const chain = [dynamic('m', 300), booster('cl', 149, 25), iface]

      expect(findCheaperAlternatives(chain, 'cl', [booster('plain', 40)])).toEqual([])
    })

    it('does not offer a booster as a cheaper alternative to a non-booster', () => {
      const preamp = device({
        id: 'pre',
        name: 'pre',
        category: 'preamp',
        msrp: 400,
        specs: { inputConnectors: ['XLR'], outputConnectors: ['XLR'], maxPreampGain: 60 },
      })

      expect(findCheaperAlternatives([dynamic('m', 100), preamp, iface], 'pre', [booster('cl', 149, 25)])).toEqual([])
    })

    it('keeps a swapped mic from undoing a booster-fixed chain', () => {
      const chain = [quietMic, booster('cl', 149, 25), weakInterface]
      const louder = dynamic('louder', 100, { specs: { outputConnectors: ['XLR'], minPreampGain: 50 } })
      const hopeless = dynamic('hopeless', 90, { specs: { outputConnectors: ['XLR'], minPreampGain: 80 } }) // 80-25=55 > 40

      const ids = findCheaperAlternatives(chain, 'quiet', [louder, hopeless]).map((r) => r.to.id)

      expect(ids).toEqual(['louder'])
    })
  })

  it('replaces every occurrence of a repeated device when testing a swap', () => {
    const chain = [dynamic('cur', 400), iface, dynamic('cur', 400)]
    const bad = dynamic('bad', 50, { specs: { outputConnectors: ['USB-C'], minPreampGain: 40 } })

    // The mismatch would appear at both occurrences, so it is rejected either way.
    expect(findCheaperAlternatives(chain, 'cur', [bad])).toEqual([])
    expect(findCheaperAlternatives(chain, 'cur', [dynamic('ok', 50)]).map((r) => r.to.id)).toEqual(['ok'])
  })

  it('does not mutate the chain or the catalog', () => {
    const chain = [dynamic('cur', 400), iface]
    const catalog = [dynamic('c', 50)]
    const snapshot = JSON.stringify([chain, catalog])

    findCheaperAlternatives(chain, 'cur', catalog)

    expect(JSON.stringify([chain, catalog])).toBe(snapshot)
  })
})

// These sweep thousands of real chains. They take about a second normally, but a loaded machine
// (or a full parallel run) has pushed one past vitest's 5s default, so give them real headroom.
describe('findCheaperAlternatives on the real catalog', { timeout: 60_000 }, () => {
  const sm7b = getDeviceById('shure-sm7b')!
  const scarlett = getDeviceById('focusrite-scarlett-2i2-4gen')!
  const monitor = getDeviceById('yamaha-hs5')!

  it('offers cheaper dynamic mics for an SM7B, all genuinely cheaper and dynamic', () => {
    const result = findCheaperAlternatives([sm7b, scarlett, monitor], 'shure-sm7b')

    expect(result.length).toBeGreaterThan(0)
    for (const r of result) {
      expect(r.to.msrp!).toBeLessThan(sm7b.msrp!)
      expect(r.to.subtype).toBe('dynamic')
      expect(r.to.category).toBe('microphone')
      expect(r.saving).toBe(sm7b.msrp! - r.to.msrp!)
    }
  })

  it('every suggestion across many real chains honours the rule: cheaper, same kind, nothing new or worse', () => {
    const mics = ALL_DEVICES.filter((d) => d.category === 'microphone').slice(0, 25)
    const interfaces = ALL_DEVICES.filter((d) => d.category === 'audio_interface').slice(0, 12)
    const boosters = ALL_DEVICES.filter((d) => d.specs.gainBoost !== undefined)
    let checked = 0

    for (const mic of mics) {
      for (const iface of interfaces) {
        for (const chain of [[mic, iface, monitor], [mic, boosters[0], iface, monitor]]) {
          for (const target of chain) {
            const before = evaluatePairs(chain)
            for (const s of findCheaperAlternatives(chain, target.id)) {
              const swapped = chain.map((d) => (d.id === target.id ? s.to : d))
              expect(s.to.msrp!, `${target.id} → ${s.to.id}`).toBeLessThan(target.msrp ?? Infinity)
              expect(s.to.category).toBe(target.category)
              expect(s.to.specs.gainBoost !== undefined, `${target.id} → ${s.to.id} booster-ness`).toBe(
                target.specs.gainBoost !== undefined,
              )
              expect(isNoWorse(before, evaluatePairs(swapped)), `${target.id} → ${s.to.id}`).toBe(true)
              checked++
            }
          }
        }
      }
    }
    // Guards against the loops silently testing nothing.
    expect(checked).toBeGreaterThan(500)
  })

  it('never makes a gain shortfall bigger, in any real chain that already has one', () => {
    // The check that showed 11.3% of suggestions growing an existing shortfall before the rule
    // was tightened. It must now be exactly zero, with and without a booster in the chain.
    const gapOf = (chain: Device[]) =>
      evaluatePairs(chain)
        .flatMap((c) => c.results)
        .reduce(
          (sum, r) =>
            sum + (r.problem?.type === 'gain_shortfall' || r.problem?.type === 'boosted_gain_shortfall' ? r.problem.gap : 0),
          0,
        )
    const mics = ALL_DEVICES.filter((d) => d.category === 'microphone')
    const interfaces = ALL_DEVICES.filter((d) => d.category === 'audio_interface')
    const fethead = getDeviceById('triton-audio-fethead')!
    const weakBooster = { ...fethead, id: 'weak-booster', name: 'weak-booster', specs: { ...fethead.specs, gainBoost: 8 } }
    let chainsWithShortfall = 0
    let suggestions = 0

    for (const mic of mics) {
      for (const iface of interfaces) {
        for (const chain of [[mic, iface, monitor], [mic, weakBooster, iface, monitor]]) {
          const before = gapOf(chain)
          if (before === 0) continue
          chainsWithShortfall++
          for (const target of chain) {
            for (const s of findCheaperAlternatives(chain, target.id)) {
              suggestions++
              const after = gapOf(chain.map((d) => (d.id === target.id ? s.to : d)))
              expect(after, `${target.id} → ${s.to.id}`).toBeLessThanOrEqual(before)
            }
          }
        }
      }
    }

    // Guards against the loops silently testing nothing.
    expect(chainsWithShortfall).toBeGreaterThan(200)
    expect(suggestions).toBeGreaterThan(500)
  })

  it('never swaps a booster for a non-booster in a real chain', () => {
    const fethead = getDeviceById('triton-audio-fethead')!
    const quiet = [sm7b, fethead, scarlett]

    const result = findCheaperAlternatives(quiet, 'cloud-microphones-cloudlifter-cl-1')
    expect(result).toEqual([]) // not in the chain

    const withCloudlifter = [sm7b, getDeviceById('cloud-microphones-cloudlifter-cl-1')!, scarlett]
    for (const s of findCheaperAlternatives(withCloudlifter, 'cloud-microphones-cloudlifter-cl-1')) {
      expect(s.to.specs.gainBoost).toBeDefined()
    }
  })
})
