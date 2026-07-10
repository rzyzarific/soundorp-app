import { describe, expect, it } from 'vitest'
import { checkConnectorMatch } from './connectorMatch'
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
