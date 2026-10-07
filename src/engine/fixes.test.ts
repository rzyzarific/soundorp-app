import { unconfirmedNote } from './unconfirmed'
import { describe, expect, it } from 'vitest'
import { suggestGainBoostActions } from './fixes'
import { evaluateChain } from './evaluateChain'
import { evaluatePairs } from './evaluatePairs'
import { worstSeverity } from './types'
import { device } from './rules/testFixtures'
import { ALL_DEVICES, getDeviceById } from '../data/devices'
import type { Device } from '../data/devices.schema'

const sm7b = device({
  id: 'sm7b',
  name: 'SM7B',
  specs: { outputConnectors: ['XLR'], minPreampGain: 60 },
})
const budgetInterface = device({
  id: 'iface',
  name: 'Interface',
  category: 'audio_interface',
  specs: {
    inputConnectors: ['XLR', 'TRS'],
    outputConnectors: ['USB-C'],
    providesPhantomPower: true,
    maxPreampGain: 35,
  },
})

function booster(id: string, gainBoost: number, msrp?: number, overrides: Partial<Device['specs']> = {}) {
  return device({
    id,
    name: id,
    brand: 'Brand',
    category: 'preamp',
    msrp,
    specs: {
      inputConnectors: ['XLR'],
      outputConnectors: ['XLR'],
      needsPhantomPower: true,
      phantomPowerDamages: false,
      gainBoost,
      ...overrides,
    },
  })
}

describe('suggestGainBoostActions', () => {
  it('offers every booster that closes the gap, cheapest first, at the position between the devices', () => {
    const catalog = [booster('pricey', 25, 149), booster('cheap', 27, 90), booster('mid', 28, 129)]

    const actions = suggestGainBoostActions([sm7b, budgetInterface], 0, catalog)

    expect(actions.map((a) => a.deviceId)).toEqual(['cheap', 'mid', 'pricey'])
    expect(actions.every((a) => a.type === 'insert_device' && a.position === 1)).toBe(true)
  })

  it('positions the fix after the upstream device, wherever it sits in the chain', () => {
    const chain = [device({ id: 'x', specs: {} }), sm7b, budgetInterface]

    const [action] = suggestGainBoostActions(chain, 1, [booster('b', 27, 90)])

    expect(action.position).toBe(2)
  })

  it('breaks price ties by preferring the bigger boost, and puts unpriced boosters last', () => {
    const catalog = [booster('unpriced', 28), booster('small', 25, 100), booster('big', 27, 100)]

    const actions = suggestGainBoostActions([sm7b, budgetInterface], 0, catalog)

    expect(actions.map((a) => a.deviceId)).toEqual(['big', 'small', 'unpriced'])
  })

  it('describes the booster with its brand, gain and price', () => {
    const [action] = suggestGainBoostActions([sm7b, budgetInterface], 0, [booster('fethead', 27, 90)])

    expect(action.label).toBe('Add Brand fethead (+27 dB, $90)')
  })

  it('leaves the price out of the label when the booster has none', () => {
    const [action] = suggestGainBoostActions([sm7b, budgetInterface], 0, [booster('fethead', 27)])

    expect(action.label).toBe('Add Brand fethead (+27 dB)')
  })

  it('does not offer a booster that is too weak to close the gap', () => {
    const hungry = device({ ...budgetInterface, specs: { ...budgetInterface.specs, maxPreampGain: 20 } })

    // Needs 40 dB; a 27 dB booster would still leave 13 dB short.
    expect(suggestGainBoostActions([sm7b, hungry], 0, [booster('b', 27, 90)])).toEqual([])
  })

  it('does not offer boosters when the next device cannot supply the phantom power they need', () => {
    const noPhantom = device({
      ...budgetInterface,
      specs: { ...budgetInterface.specs, providesPhantomPower: false },
    })

    expect(suggestGainBoostActions([sm7b, noPhantom], 0, [booster('b', 27, 90)])).toEqual([])
  })

  it('does not offer a booster whose connectors do not fit the next input', () => {
    const trsOnly = device({
      ...budgetInterface,
      specs: { ...budgetInterface.specs, inputConnectors: ['TRS'] },
    })

    expect(suggestGainBoostActions([sm7b, trsOnly], 0, [booster('b', 27, 90)])).toEqual([])
  })

  it('does not offer a booster to a mic that needs phantom power, since boosters block it', () => {
    const condenser = device({
      ...sm7b,
      specs: { ...sm7b.specs, needsPhantomPower: true },
    })

    expect(suggestGainBoostActions([condenser, budgetInterface], 0, [booster('b', 27, 90)])).toEqual([])
  })

  it('ignores catalog devices that are not boosters', () => {
    expect(suggestGainBoostActions([sm7b, budgetInterface], 0, [budgetInterface, sm7b])).toEqual([])
  })

  it('does not mutate the chain it is given', () => {
    const chain = [sm7b, budgetInterface]

    suggestGainBoostActions(chain, 0, [booster('b', 27, 90)])

    expect(chain).toEqual([sm7b, budgetInterface])
  })
})

describe('evaluateChain fix actions', () => {
  it('attaches actions to a gain shortfall and to nothing else', () => {
    const real = [getDeviceById('shure-sm7b')!, getDeviceById('presonus-audiobox-usb-96')!]

    const results = evaluateChain(real)[0].results

    const shortfall = results.find((r) => r.problem?.type === 'gain_shortfall')
    expect(shortfall?.actions?.length).toBeGreaterThan(0)
    expect(results.filter((r) => r !== shortfall).every((r) => r.actions === undefined)).toBe(true)
  })

  it('offers the real boosters cheapest first for an SM7B into a budget interface', () => {
    const real = [getDeviceById('shure-sm7b')!, getDeviceById('presonus-audiobox-usb-96')!]

    const shortfall = evaluateChain(real)[0].results.find((r) => r.problem)

    expect(shortfall?.actions?.map((a) => a.deviceId)).toEqual([
      'triton-audio-fethead',
      'se-electronics-dm1-dynamite',
      'cloud-microphones-cloudlifter-cl-1',
    ])
  })

  it('offers no actions once the shortfall is gone', () => {
    const chain = [
      getDeviceById('shure-sm7b')!,
      getDeviceById('cloud-microphones-cloudlifter-cl-1')!,
      getDeviceById('presonus-audiobox-usb-96')!,
    ]

    const all = evaluateChain(chain).flatMap((c) => c.results)

    expect(all.some((r) => r.actions)).toBe(false)
    expect(all.some((r) => r.severity === 'warning' || r.severity === 'critical')).toBe(false)
  })

  it('does not offer yet another booster for a shortfall left over after one', () => {
    const mic = device({ id: 'm', name: 'M', subtype: 'dynamic', specs: { outputConnectors: ['XLR'], minPreampGain: 70 } })
    const booster = device({
      id: 'b',
      name: 'B',
      category: 'preamp',
      specs: { inputConnectors: ['XLR'], outputConnectors: ['XLR'], needsPhantomPower: true, gainBoost: 10 },
    })
    const iface = device({
      id: 'i',
      name: 'I',
      category: 'audio_interface',
      specs: { inputConnectors: ['XLR'], providesPhantomPower: true, maxPreampGain: 56 },
    })

    const results = evaluateChain([mic, booster, iface]).flatMap((c) => c.results)

    const leftover = results.find((r) => r.problem?.type === 'boosted_gain_shortfall')
    expect(leftover?.severity).toBe('warning') // still short by 4 dB
    expect(results.some((r) => r.actions)).toBe(false) // but nothing more to add
  })

  it('tells the user to switch phantom power on once a booster is in the chain', () => {
    const chain = [
      getDeviceById('shure-sm7b')!,
      getDeviceById('triton-audio-fethead')!,
      getDeviceById('presonus-audiobox-usb-96')!,
    ]

    const details = evaluateChain(chain).flatMap((c) => c.results.map((r) => r.detail))

    expect(details.some((d) => /can supply the 48V phantom power FetHead needs/.test(d))).toBe(true)
  })
})

// Sweeps every mic against every gain device; generous timeout so a loaded machine can't flake it.
describe('real catalog: every offered fix really fixes the chain', { timeout: 60_000 }, () => {
  const mics = ALL_DEVICES.filter((d) => d.specs.minPreampGain !== undefined)
  const gainDevices = ALL_DEVICES.filter((d) => d.specs.maxPreampGain !== undefined)

  it('applying any suggested action leaves both new connections fully clean', () => {
    let shortfalls = 0
    let withActions = 0

    for (const mic of mics) {
      for (const target of gainDevices) {
        const chain = [mic, target]
        const shortfall = evaluateChain(chain)[0].results.find((r) => r.problem)
        if (!shortfall) continue
        shortfalls++
        if (!shortfall.actions) continue
        withActions++

        for (const action of shortfall.actions) {
          const booster = getDeviceById(action.deviceId)!
          const fixed = [...chain.slice(0, action.position), booster, ...chain.slice(action.position)]
          const connections = evaluatePairs(fixed)
          expect(
            connections.map((c) => worstSeverity(c.results)),
            `${mic.id} → ${action.deviceId} → ${target.id}`,
          ).toEqual(['pass', 'pass'])
        }
      }
    }

    // Guards against the loop silently testing nothing.
    expect(shortfalls).toBeGreaterThan(100)
    expect(withActions).toBeGreaterThan(50)
  })

  it('withholds a fix only when a booster genuinely cannot work there', () => {
    for (const mic of mics) {
      for (const target of gainDevices) {
        const shortfall = evaluateChain([mic, target])[0].results.find((r) => r.problem)
        if (!shortfall || shortfall.actions) continue

        const cannotWork =
          mic.specs.needsPhantomPower === true || // boosters block phantom to the mic
          !target.specs.providesPhantomPower || // boosters need 48V from the next device
          // ...and if that is unconfirmed the repaired chain would not be a clean pass, so no
          // one-click fix is offered (the unconfirmed-phantom rule, e.g. the Alto ZMX122FX).
          unconfirmedNote(target, 'providesPhantomPower') !== null ||
          !target.specs.inputConnectors?.includes('XLR') ||
          !mic.specs.outputConnectors?.includes('XLR') ||
          (mic.specs.minPreampGain ?? 0) - (target.specs.maxPreampGain ?? 0) > 28

        expect(cannotWork, `${mic.id} → ${target.id} got no fix but a booster should fit`).toBe(true)
      }
    }
  })

  it('keeps ribbon mics safe: a suggested booster never creates a phantom-damage warning', () => {
    const ribbons = ALL_DEVICES.filter((d) => d.specs.phantomPowerDamages)
    expect(ribbons.length).toBeGreaterThan(0)

    for (const ribbon of ribbons) {
      for (const target of gainDevices.filter((d) => d.specs.providesPhantomPower)) {
        const chain = [ribbon, target]
        const shortfall = evaluateChain(chain)[0].results.find((r) => r.problem)
        // Straight into a phantom-capable input the ribbon is already critical, which
        // is exactly why a booster (which blocks phantom) is the right suggestion.
        for (const action of shortfall?.actions ?? []) {
          const fixed = [ribbon, getDeviceById(action.deviceId)!, target]
          const titles = evaluatePairs(fixed).flatMap((c) => c.results.map((r) => r.title))
          expect(titles).not.toContain('Phantom power can damage this microphone')
        }
      }
    }
  })
})
