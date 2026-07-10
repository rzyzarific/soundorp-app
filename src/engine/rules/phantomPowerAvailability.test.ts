import { describe, expect, it } from 'vitest'
import { checkPhantomPowerAvailability } from './phantomPowerAvailability'
import { device } from './testFixtures'

describe('checkPhantomPowerAvailability', () => {
  it('flags critical when a condenser meets an interface with no phantom power', () => {
    const condenser = device({ specs: { needsPhantomPower: true } })
    const noPhantom = device({ category: 'audio_interface', specs: { providesPhantomPower: false } })

    const result = checkPhantomPowerAvailability(condenser, noPhantom)

    expect(result?.severity).toBe('critical')
  })

  it('passes with a reminder when a condenser meets a phantom-capable interface', () => {
    const condenser = device({ specs: { needsPhantomPower: true } })
    const withPhantom = device({ category: 'audio_interface', specs: { providesPhantomPower: true } })

    const result = checkPhantomPowerAvailability(condenser, withPhantom)

    expect(result?.severity).toBe('pass')
    expect(result?.fix).toMatch(/switch on phantom power/i)
  })

  it('is silent for a mic that does not need phantom power', () => {
    const dynamic = device({ specs: { needsPhantomPower: false } })
    const noPhantom = device({ category: 'audio_interface', specs: { providesPhantomPower: false } })

    expect(checkPhantomPowerAvailability(dynamic, noPhantom)).toBeNull()
  })
})
