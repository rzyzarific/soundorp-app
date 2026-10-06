import { describe, expect, it } from 'vitest'
import { ALL_DEVICES, getDeviceById } from '../data/devices'
import type { Device } from '../data/devices.schema'
import { evaluateChain } from './evaluateChain'
import { buildCableList } from '../lib/cableList'

const interfaces = ALL_DEVICES.filter((d) => d.category === 'audio_interface')
const monitors = ALL_DEVICES.filter((d) => d.category === 'monitor')
const headphones = ALL_DEVICES.filter((d) => d.category === 'headphones')
const sm7b = getDeviceById('shure-sm7b')!

const ANALOG = ['TRS', 'XLR', 'RCA', 'TS', '3.5mm']
const hasAnalogLineOut = (d: Device) =>
  (d.specs.outputConnectors ?? []).some((c) => ANALOG.includes(c))

function connectorWarnings(chain: Device[]) {
  return evaluateChain(chain)
    .flatMap((c) => c.results)
    .filter((r) => r.title === 'No matching connector')
}

// Sweeps every interface against every monitor and pair of headphones; generous timeout for loaded machines.
describe('audio interface analog outputs (the false "No matching connector" bug)', { timeout: 60_000 }, () => {
  it('gives every interface a headphone jack', () => {
    for (const i of interfaces) {
      expect(i.specs.headphoneOutputConnectors?.length, i.id).toBeGreaterThan(0)
    }
  })

  it('gives every interface a digital host link and, except the PodTrak, an analog line out', () => {
    const digital = ['USB-A', 'USB-C', 'Thunderbolt']
    for (const i of interfaces) {
      expect((i.specs.outputConnectors ?? []).some((c) => digital.includes(c)), i.id).toBe(true)
    }
    // The PodTrak P4 records to SD and has headphone outputs only: no line out to feed monitors.
    expect(interfaces.filter((i) => !hasAnalogLineOut(i)).map((i) => i.id)).toEqual([
      'zoom-podtrak-p4',
    ])
  })

  it('no longer warns on mic → interface → studio monitors for interfaces with TRS or XLR outs', () => {
    const yamahaHs5 = getDeviceById('yamaha-hs5')!
    expect(yamahaHs5.specs.inputConnectors).toEqual(expect.arrayContaining(['TRS', 'XLR']))

    for (const i of interfaces) {
      const hasBalanced = (i.specs.outputConnectors ?? []).some((c) => c === 'TRS' || c === 'XLR')
      if (!hasBalanced) continue
      expect(connectorWarnings([sm7b, i, yamahaHs5]), i.id).toEqual([])
    }
  })

  it('lets every interface with a TRS line out feed every studio monitor that takes TRS', () => {
    const takesTrs = monitors.filter((m) => m.specs.inputConnectors?.includes('TRS'))
    // Only the Genelec 8010A is left out: it has a single XLR input (genelec.com/8010a).
    expect(monitors.filter((m) => !takesTrs.includes(m)).map((m) => m.id)).toEqual(['genelec-8010a'])

    for (const i of interfaces) {
      if (!i.specs.outputConnectors?.includes('TRS')) continue
      for (const m of takesTrs) {
        expect(connectorWarnings([i, m]), `${i.id} → ${m.id}`).toEqual([])
      }
    }
  })

  it('asks for a TRS-to-XLR cable where a TRS-only line out meets the XLR-only Genelec 8010A', () => {
    const genelec = getDeviceById('genelec-8010a')!
    expect(genelec.specs.inputConnectors).toEqual(['XLR'])
    const trsOnly = interfaces.find(
      (i) => i.specs.outputConnectors?.includes('TRS') && !i.specs.outputConnectors.includes('XLR'),
    )!

    expect(connectorWarnings([trsOnly, genelec])).toHaveLength(1)
    expect(buildCableList([trsOnly, genelec]).lines[0].kind).toBe('adapter')
  })

  it('asks for an XLR-to-TRS cable where an XLR-only line out meets a monitor with no XLR input', () => {
    const babyface = getDeviceById('rme-babyface-pro-fs')!
    const noXlrMonitor = monitors.find((m) => !m.specs.inputConnectors?.includes('XLR'))!

    expect(connectorWarnings([babyface, noXlrMonitor])).toHaveLength(1)
    expect(connectorWarnings([babyface, getDeviceById('yamaha-hs5')!])).toEqual([])
  })

  it('lets every interface feed every pair of headphones through its headphone jack', () => {
    for (const i of interfaces) {
      for (const h of headphones) {
        expect(connectorWarnings([i, h]), `${i.id} → ${h.id}`).toEqual([])
      }
    }
  })

  it('still warns where an interface genuinely has no matching output', () => {
    // These have no balanced TRS/XLR line out: RCA-only, 3.5mm-only, or no line out at all.
    const unbalanced = interfaces
      .filter((i) => !(i.specs.outputConnectors ?? []).some((c) => c === 'TRS' || c === 'XLR'))
      .map((i) => i.id)
      .sort()
    expect(unbalanced).toEqual([
      'behringer-um2',
      'tc-helicon-goxlr',
      'zoom-h4essential',
      'zoom-podtrak-p4',
    ])

    // A monitor that only takes TRS/XLR can't be fed by them without an adapter. The PodTrak
    // has no line output to adapt, so it gets its own message (below) instead.
    const strictMonitor = monitors.find(
      (m) => !m.specs.inputConnectors?.some((c) => c === 'RCA' || c === '3.5mm'),
    )!
    for (const id of unbalanced.filter((id) => id !== 'zoom-podtrak-p4')) {
      expect(connectorWarnings([getDeviceById(id)!, strictMonitor]), id).toHaveLength(1)
    }
  })

  it('says a headphone-only device has no line output instead of suggesting an adapter', () => {
    const p4 = getDeviceById('zoom-podtrak-p4')!

    for (const monitor of monitors) {
      const results = evaluateChain([p4, monitor]).flatMap((c) => c.results)

      expect(results.map((r) => r.title), monitor.id).toContain('No line-level output')
      expect(results.map((r) => r.title), monitor.id).not.toContain('No matching connector')
    }

    const result = evaluateChain([p4, monitors[0]])[0].results.find(
      (r) => r.title === 'No line-level output',
    )
    expect(result?.severity).toBe('warning')
    expect(result?.detail).toContain('no line-level output')
    expect(result?.fix).toBe('Use its headphone jack instead.')
    expect(result?.fix).not.toMatch(/adapter/i)
  })

  it('lists no cable for a headphone-only device feeding monitors, and says why', () => {
    const p4 = getDeviceById('zoom-podtrak-p4')!

    const { lines, noLineOutput } = buildCableList([p4, monitors[0]])

    expect(lines).toEqual([])
    expect(noLineOutput).toEqual([`${p4.name} → ${monitors[0].name}`])
  })

  it('still lets a headphone-only device feed headphones through its jack', () => {
    const p4 = getDeviceById('zoom-podtrak-p4')!

    expect(connectorWarnings([p4, headphones[0]])).toEqual([])
    const results = evaluateChain([p4, headphones[0]]).flatMap((c) => c.results)
    expect(results.map((r) => r.title)).not.toContain('No line-level output')
    expect(buildCableList([p4, headphones[0]]).lines.map((l) => l.label)).toEqual(['3.5mm cable'])
  })

  it('accepts an RCA-only interface into a monitor that has RCA inputs', () => {
    const rcaMonitor = monitors.find((m) => m.specs.inputConnectors?.includes('RCA'))!

    expect(connectorWarnings([getDeviceById('behringer-um2')!, rcaMonitor])).toEqual([])
  })

  it('keeps interface → DAW on the USB link, whatever analog outputs are added', () => {
    const daw = ALL_DEVICES.find((d) => d.category === 'daw')!
    for (const i of interfaces) {
      expect(connectorWarnings([i, daw]), i.id).toEqual([])
    }
  })
})

describe('cable list for chains through an interface', () => {
  const scarlett = getDeviceById('focusrite-scarlett-2i2-4gen')!
  const monitor = getDeviceById('yamaha-hs5')!

  it('lists an XLR and a TRS cable, and no adapter, for mic → Scarlett 2i2 → monitors', () => {
    const { lines } = buildCableList([sm7b, scarlett, monitor])

    expect(lines.map((l) => [l.kind, l.label, l.quantity])).toEqual([
      ['cable', 'XLR cable', 1],
      ['cable', 'TRS cable', 1],
    ])
  })

  it('lists the headphone jack cable when headphones follow an interface', () => {
    const apogee = getDeviceById('apogee-duet-3')! // 3.5mm headphone jack
    const cans = headphones[0]

    const { lines } = buildCableList([apogee, cans])

    expect(lines.map((l) => l.label)).toEqual(['3.5mm cable'])
  })

  it('still asks for an adapter where an RCA-only interface meets TRS/XLR-only monitors', () => {
    const um2 = getDeviceById('behringer-um2')!
    const strictMonitor = monitors.find(
      (m) => !m.specs.inputConnectors?.some((c) => c === 'RCA' || c === '3.5mm'),
    )!

    const { lines } = buildCableList([um2, strictMonitor])

    expect(lines).toHaveLength(1)
    expect(lines[0].kind).toBe('adapter')
    expect(lines[0].label).toBe('RCA → TRS/XLR adapter')
  })
})
