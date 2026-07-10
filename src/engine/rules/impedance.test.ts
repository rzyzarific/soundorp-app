import { describe, expect, it } from 'vitest'
import { checkImpedance } from './impedance'
import { device } from './testFixtures'

describe('checkImpedance (stub)', () => {
  it('always returns null until Milestone 1.5 implements it', () => {
    const mic = device({ specs: { outputImpedance: 300 } })
    const preamp = device({ category: 'preamp', specs: { inputImpedance: 1500 } })

    expect(checkImpedance(mic, preamp)).toBeNull()
  })
})
