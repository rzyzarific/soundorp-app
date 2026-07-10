import { describe, expect, it } from 'vitest'
import { evaluateChain } from './evaluateChain'
import { device } from './rules/testFixtures'

describe('evaluateChain', () => {
  it('returns one connection entry per adjacent pair', () => {
    const chain = [
      device({ id: 'a', specs: {} }),
      device({ id: 'b', specs: {} }),
      device({ id: 'c', specs: {} }),
    ]

    const connections = evaluateChain(chain)

    expect(connections).toHaveLength(2)
    expect(connections[0]).toMatchObject({ connectionIndex: 0, upstreamId: 'a', downstreamId: 'b' })
    expect(connections[1]).toMatchObject({ connectionIndex: 1, upstreamId: 'b', downstreamId: 'c' })
  })

  it('returns only pass results for a fully compatible chain', () => {
    const condenser = device({
      id: 'condenser',
      specs: { outputConnectors: ['XLR'], needsPhantomPower: true, minPreampGain: 30 },
    })
    const goodInterface = device({
      id: 'interface',
      category: 'audio_interface',
      specs: {
        inputConnectors: ['XLR'],
        outputConnectors: ['USB-C'],
        providesPhantomPower: true,
        maxPreampGain: 60,
      },
    })
    const daw = device({
      id: 'daw',
      category: 'daw',
      specs: { inputConnectors: ['USB-C'] },
    })

    const connections = evaluateChain([condenser, goodInterface, daw])

    // Every applicable rule should report "pass" explicitly — never silence, never a warning/critical.
    expect(connections[0].results.length).toBeGreaterThan(0)
    expect(connections[0].results.every((r) => r.severity === 'pass')).toBe(true)
    expect(connections[1].results.length).toBeGreaterThan(0)
    expect(connections[1].results.every((r) => r.severity === 'pass')).toBe(true)
  })

  it('flags a critical result when a ribbon mic meets a phantom-capable interface', () => {
    const ribbon = device({ id: 'ribbon', specs: { outputConnectors: ['XLR'], phantomPowerDamages: true } })
    const phantomInterface = device({
      id: 'interface',
      category: 'audio_interface',
      specs: { inputConnectors: ['XLR'], providesPhantomPower: true },
    })

    const connections = evaluateChain([ribbon, phantomInterface])

    expect(connections[0].results.some((r) => r.severity === 'critical')).toBe(true)
  })

  it('collects multiple issues on the same connection', () => {
    const usbCondenser = device({
      id: 'usb-condenser',
      specs: { outputConnectors: ['USB-A'], needsPhantomPower: true, minPreampGain: 60 },
    })
    const mismatchedPreamp = device({
      id: 'preamp',
      category: 'preamp',
      specs: { inputConnectors: ['XLR'], providesPhantomPower: false, maxPreampGain: 40 },
    })

    const connections = evaluateChain([usbCondenser, mismatchedPreamp])
    const severities = connections[0].results.map((r) => r.severity)

    expect(severities).toContain('critical') // no phantom power available
    expect(severities).toContain('warning') // connector mismatch (USB-A vs XLR)
  })

  it('returns an empty array for a chain of 0 or 1 devices', () => {
    expect(evaluateChain([])).toEqual([])
    expect(evaluateChain([device({ id: 'solo' })])).toEqual([])
  })
})
