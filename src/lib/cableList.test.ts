import { describe, expect, it } from 'vitest'
import { buildCableList } from './cableList'
import { device } from '../engine/rules/testFixtures'
import { ALL_DEVICES, getDeviceById } from '../data/devices'
import { evaluateChain } from '../engine/evaluateChain'

const mic = device({ id: 'mic', name: 'Mic', specs: { outputConnectors: ['XLR'] } })
const preamp = device({
  id: 'pre',
  name: 'Preamp',
  category: 'preamp',
  specs: { inputConnectors: ['XLR'], outputConnectors: ['XLR', 'TRS'] },
})
const interfaceUsb = device({
  id: 'iface',
  name: 'Interface',
  category: 'audio_interface',
  specs: { inputConnectors: ['XLR', 'TRS'], outputConnectors: ['USB-C'] },
})
const daw = device({
  id: 'daw',
  name: 'DAW',
  category: 'daw',
  specs: { inputConnectors: ['USB-A', 'USB-C'] },
})
const trsOnlyInput = device({
  id: 'trs',
  name: 'TRS Box',
  category: 'mixer',
  specs: { inputConnectors: ['TRS'] },
})

describe('buildCableList', () => {
  it('returns nothing for an empty chain and for a single device', () => {
    expect(buildCableList([])).toEqual({ lines: [], skipped: [], noLineOutput: [] })
    expect(buildCableList([mic])).toEqual({ lines: [], skipped: [], noLineOutput: [] })
  })

  it('lists one cable for a matched connection, named after the shared connector', () => {
    const { lines, skipped } = buildCableList([mic, preamp])

    expect(skipped).toEqual([])
    expect(lines).toEqual([
      { kind: 'cable', label: 'XLR cable', quantity: 1, connections: ['Mic → Preamp'] },
    ])
  })

  it('consolidates identical cables into a counted line, keeping every connection', () => {
    // Mic → Preamp → Interface: XLR both times (preamp's first output matches the interface).
    const { lines } = buildCableList([mic, preamp, interfaceUsb])

    expect(lines).toEqual([
      {
        kind: 'cable',
        label: 'XLR cable',
        quantity: 2,
        connections: ['Mic → Preamp', 'Preamp → Interface'],
      },
    ])
  })

  it('lists different cables as separate lines, in first-seen order', () => {
    const { lines } = buildCableList([mic, preamp, interfaceUsb, daw])

    expect(lines.map((l) => [l.label, l.quantity])).toEqual([
      ['XLR cable', 2],
      ['USB-C cable', 1],
    ])
  })

  it('lists an adapter when connectors do not overlap, after the cables', () => {
    const { lines } = buildCableList([interfaceUsb, trsOnlyInput, mic, preamp])

    // Interface (USB-C) → TRS Box has no overlap; TRS Box → Mic is unknown (mic has no inputs);
    // Mic → Preamp is a plain XLR cable which must sort ahead of the adapter.
    expect(lines).toEqual([
      { kind: 'cable', label: 'XLR cable', quantity: 1, connections: ['Mic → Preamp'] },
      {
        kind: 'adapter',
        label: 'USB-C → TRS adapter',
        quantity: 1,
        connections: ['Interface → TRS Box'],
      },
    ])
  })

  it('shows the full connector lists in an adapter label', () => {
    const { lines } = buildCableList([
      device({ name: 'A', specs: { outputConnectors: ['RCA', 'TS'] } }),
      device({ name: 'B', specs: { inputConnectors: ['XLR', 'TRS'] } }),
    ])

    expect(lines[0].label).toBe('RCA/TS → XLR/TRS adapter')
  })

  it('counts the same adapter twice when it is needed twice', () => {
    const { lines } = buildCableList([interfaceUsb, trsOnlyInput, interfaceUsb, trsOnlyInput])

    const adapter = lines.find((l) => l.kind === 'adapter')
    expect(adapter?.quantity).toBe(2)
  })

  it('handles the same device appearing more than once', () => {
    const { lines } = buildCableList([preamp, preamp, preamp])

    expect(lines).toEqual([
      {
        kind: 'cable',
        label: 'XLR cable',
        quantity: 2,
        connections: ['Preamp → Preamp', 'Preamp → Preamp'],
      },
    ])
  })

  it('skips connections where a device has no connector data, and says which', () => {
    // DAW has no outputs, so DAW → Preamp can't be resolved.
    const { lines, skipped } = buildCableList([mic, preamp, interfaceUsb, daw, preamp])

    expect(lines.map((l) => [l.label, l.quantity])).toEqual([
      ['XLR cable', 2],
      ['USB-C cable', 1],
    ])
    expect(skipped).toEqual(['DAW → Preamp'])
  })

  it('picks the first upstream output that the downstream accepts, like the report does', () => {
    const up = device({ name: 'Up', specs: { outputConnectors: ['TRS', 'XLR'] } })
    const down = device({ name: 'Down', specs: { inputConnectors: ['XLR', 'TRS'] } })

    expect(buildCableList([up, down]).lines[0].label).toBe('TRS cable')
  })

  it('does not mutate its input', () => {
    const chain = [mic, preamp, interfaceUsb]
    const snapshot = JSON.stringify(chain)

    buildCableList(chain)

    expect(JSON.stringify(chain)).toBe(snapshot)
  })

  it('agrees with the compatibility engine: adapters appear exactly where the engine warns', () => {
    const sm7b = getDeviceById('shure-sm7b')!
    const interfaces = ALL_DEVICES.filter((d) => d.category === 'audio_interface').slice(0, 5)
    const monitors = ALL_DEVICES.filter((d) => d.category === 'monitor').slice(0, 3)

    for (const iface of interfaces) {
      for (const monitor of monitors) {
        const chain = [sm7b, iface, monitor]
        const warned = evaluateChain(chain).some((c) =>
          c.results.some((r) => r.title === 'No matching connector'),
        )
        const { lines } = buildCableList(chain)
        expect(lines.some((l) => l.kind === 'adapter')).toBe(warned)
      }
    }
  })

  it('builds a sensible list for a typical real-catalog mic → interface → DAW chain', () => {
    const sm7b = getDeviceById('shure-sm7b')!
    const iface = ALL_DEVICES.find((d) => d.category === 'audio_interface')!
    const dawDevice = ALL_DEVICES.find((d) => d.category === 'daw')!

    const { lines, skipped } = buildCableList([sm7b, iface, dawDevice])

    expect(skipped).toEqual([])
    expect(lines.map((l) => l.kind)).toEqual(['cable', 'cable'])
    expect(lines[0].label).toBe('XLR cable')
  })
})
