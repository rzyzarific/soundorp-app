import { describe, expect, it } from 'vitest'
import { checkConnectorMatch, findConnectorLink } from './connectorMatch'
import { device } from './testFixtures'

describe('checkConnectorMatch', () => {
  it('warns when a USB mic is chained into an XLR-only preamp', () => {
    const usbMic = device({ specs: { outputConnectors: ['USB-A'] } })
    const xlrPreamp = device({ category: 'preamp', specs: { inputConnectors: ['XLR'] } })

    const result = checkConnectorMatch(usbMic, xlrPreamp)

    expect(result?.severity).toBe('warning')
    expect(result?.detail).toContain('USB-A')
    expect(result?.detail).toContain('XLR')
  })

  it('passes naming the matching connector when at least one overlaps', () => {
    const mic = device({ specs: { outputConnectors: ['XLR'] } })
    const preamp = device({
      category: 'preamp',
      specs: { inputConnectors: ['XLR', 'TRS'] },
    })

    const result = checkConnectorMatch(mic, preamp)

    expect(result?.severity).toBe('pass')
    expect(result?.detail).toContain('XLR')
  })

  it('is silent when either side has no connector spec', () => {
    const mic = device({ specs: {} })
    const preamp = device({ category: 'preamp', specs: { inputConnectors: ['XLR'] } })

    expect(checkConnectorMatch(mic, preamp)).toBeNull()
  })
})

describe('findConnectorLink with headphone jacks', () => {
  // An interface whose line outs are RCA, but whose headphone jack is ¼" TRS.
  const rcaInterface = device({
    name: 'RCA Interface',
    category: 'audio_interface',
    specs: { outputConnectors: ['USB-A', 'RCA'], headphoneOutputConnectors: ['TRS'] },
  })
  const headphones = device({
    category: 'headphones',
    specs: { inputConnectors: ['3.5mm', 'TRS'] },
  })
  const trsMonitor = device({ category: 'monitor', specs: { inputConnectors: ['TRS', 'XLR'] } })

  it('plugs headphones into the headphone jack, not the line outs', () => {
    expect(findConnectorLink(rcaInterface, headphones)).toEqual({
      status: 'match',
      connector: 'TRS',
    })
  })

  it('does not let a headphone jack stand in for the line outs when feeding monitors', () => {
    // The ¼" headphone jack must not hide that the RCA line outs don't fit TRS/XLR monitors.
    expect(findConnectorLink(rcaInterface, trsMonitor)).toEqual({
      status: 'mismatch',
      outputs: ['RCA'],
      inputs: ['TRS', 'XLR'],
    })
  })

  it('blames only the analog outs, not the USB link, when the next device takes analog audio', () => {
    const detail = checkConnectorMatch(rcaInterface, trsMonitor)?.detail

    expect(detail).toContain('outputs RCA,')
    expect(detail).not.toContain('USB-A')
  })

  it('keeps the full output list when the next device takes digital input', () => {
    const digitalOnly = device({ category: 'daw', specs: { inputConnectors: ['ADAT'] } })

    expect(findConnectorLink(rcaInterface, digitalOnly)).toEqual({
      status: 'mismatch',
      outputs: ['USB-A', 'RCA'],
      inputs: ['ADAT'],
    })
  })

  it('keeps the full output list when the device has no analog outputs to blame', () => {
    const usbOnly = device({ category: 'audio_interface', specs: { outputConnectors: ['USB-C'] } })

    expect(findConnectorLink(usbOnly, trsMonitor)).toEqual({
      status: 'mismatch',
      outputs: ['USB-C'],
      inputs: ['TRS', 'XLR'],
    })
  })

  it('falls back to the normal outputs for headphones when no headphone jack is listed', () => {
    const mixer = device({
      category: 'mixer',
      specs: { outputConnectors: ['XLR', 'TRS', 'USB-A'] },
    })

    expect(findConnectorLink(mixer, headphones)).toEqual({ status: 'match', connector: 'TRS' })
  })

  it('treats an empty headphone list as absent', () => {
    const iface = device({
      category: 'audio_interface',
      specs: { outputConnectors: ['TRS'], headphoneOutputConnectors: [] },
    })

    expect(findConnectorLink(iface, headphones)).toEqual({ status: 'match', connector: 'TRS' })
  })

  it('reports no line output for a headphone-only device feeding analog gear', () => {
    const recorder = device({
      name: 'Recorder',
      category: 'audio_interface',
      specs: { outputConnectors: ['USB-C'], headphoneOutputConnectors: ['3.5mm'] },
    })

    expect(findConnectorLink(recorder, trsMonitor)).toEqual({ status: 'no_line_output' })
    expect(checkConnectorMatch(recorder, trsMonitor)?.title).toBe('No line-level output')
  })

  it('does not claim "no line output" for devices that never listed a headphone jack', () => {
    const usbMic = device({ specs: { outputConnectors: ['USB-A'] } })
    const xlrPreamp = device({ category: 'preamp', specs: { inputConnectors: ['XLR'] } })

    expect(findConnectorLink(usbMic, xlrPreamp).status).toBe('mismatch')
  })

  it('does not claim "no line output" when the next device takes digital audio', () => {
    const recorder = device({
      category: 'audio_interface',
      specs: { outputConnectors: ['USB-C'], headphoneOutputConnectors: ['3.5mm'] },
    })
    const digital = device({ category: 'daw', specs: { inputConnectors: ['ADAT'] } })

    expect(findConnectorLink(recorder, digital).status).toBe('mismatch')
  })

  it('reports a genuine mismatch when the headphone jack does not fit the headphones', () => {
    const quarterInchOnly = device({
      category: 'headphones',
      specs: { inputConnectors: ['3.5mm'] },
    })

    const link = findConnectorLink(rcaInterface, quarterInchOnly)

    expect(link).toEqual({ status: 'mismatch', outputs: ['TRS'], inputs: ['3.5mm'] })
  })
})
