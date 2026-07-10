import { describe, expect, it } from 'vitest'
import { checkPhantomPowerDamage } from './phantomPowerDamage'
import { device } from './testFixtures'

describe('checkPhantomPowerDamage', () => {
  it('flags critical when a ribbon mic meets a phantom-capable interface', () => {
    const ribbon = device({
      id: 'royer-r121',
      name: 'R-121',
      specs: { phantomPowerDamages: true },
    })
    const interfaceWithPhantom = device({
      id: 'scarlett-2i2',
      name: 'Scarlett 2i2',
      category: 'audio_interface',
      specs: { providesPhantomPower: true },
    })

    const result = checkPhantomPowerDamage(ribbon, interfaceWithPhantom)

    expect(result?.severity).toBe('critical')
  })

  it('is silent when the downstream device has no phantom power', () => {
    const ribbon = device({ specs: { phantomPowerDamages: true } })
    const noPhantom = device({ specs: { providesPhantomPower: false } })

    expect(checkPhantomPowerDamage(ribbon, noPhantom)).toBeNull()
  })

  it('is silent for a device that is not phantom-sensitive', () => {
    const dynamic = device({ specs: { phantomPowerDamages: false } })
    const withPhantom = device({ specs: { providesPhantomPower: true } })

    expect(checkPhantomPowerDamage(dynamic, withPhantom)).toBeNull()
  })
})
