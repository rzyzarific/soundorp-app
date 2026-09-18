import { describe, expect, it } from 'vitest'
import { isConventionalSignalFlow } from './signalFlowOrder'
import { device } from '../engine/rules/testFixtures'

describe('isConventionalSignalFlow', () => {
  it('is true for an empty chain', () => {
    expect(isConventionalSignalFlow([])).toBe(true)
  })

  it('is true for a single device', () => {
    expect(isConventionalSignalFlow([device({ category: 'microphone' })])).toBe(true)
  })

  it('is true for mic -> preamp -> interface -> daw -> monitor', () => {
    const devices = [
      device({ category: 'microphone' }),
      device({ category: 'preamp' }),
      device({ category: 'audio_interface' }),
      device({ category: 'daw' }),
      device({ category: 'monitor' }),
    ]
    expect(isConventionalSignalFlow(devices)).toBe(true)
  })

  it('treats monitor and headphones as the same end rank', () => {
    const devices = [
      device({ category: 'audio_interface' }),
      device({ category: 'monitor' }),
      device({ category: 'headphones' }),
    ]
    expect(isConventionalSignalFlow(devices)).toBe(true)
  })

  it('allows repeated categories at the same rank', () => {
    const devices = [
      device({ category: 'microphone' }),
      device({ category: 'preamp' }),
      device({ category: 'preamp' }),
    ]
    expect(isConventionalSignalFlow(devices)).toBe(true)
  })

  it('is false when a mixer comes before a microphone', () => {
    const devices = [device({ category: 'mixer' }), device({ category: 'microphone' })]
    expect(isConventionalSignalFlow(devices)).toBe(false)
  })

  it('is false when a monitor comes before the interface', () => {
    const devices = [
      device({ category: 'microphone' }),
      device({ category: 'monitor' }),
      device({ category: 'audio_interface' }),
    ]
    expect(isConventionalSignalFlow(devices)).toBe(false)
  })
})
