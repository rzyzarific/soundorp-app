import { describe, expect, it } from 'vitest'
import { checkGainHeadroom } from './gainHeadroom'
import { device } from './testFixtures'

describe('checkGainHeadroom', () => {
  it('warns when the SM7B needs more gain than a budget interface provides', () => {
    const sm7b = device({ id: 'shure-sm7b', name: 'SM7B', specs: { minPreampGain: 60 } })
    const budgetInterface = device({
      id: 'presonus-audiobox-usb-96',
      name: 'AudioBox USB 96',
      category: 'audio_interface',
      specs: { maxPreampGain: 35 },
    })

    const result = checkGainHeadroom(sm7b, budgetInterface)

    expect(result?.severity).toBe('warning')
    expect(result?.detail).toContain('25dB')
    expect(result?.fix).toMatch(/cloudlifter/i)
  })

  it('passes with the spare headroom when the interface provides enough gain', () => {
    const condenser = device({ specs: { minPreampGain: 30 } })
    const goodInterface = device({ category: 'audio_interface', specs: { maxPreampGain: 60 } })

    const result = checkGainHeadroom(condenser, goodInterface)

    expect(result?.severity).toBe('pass')
    expect(result?.detail).toContain('30dB')
  })

  it('is silent when either device has no gain spec', () => {
    const noSpec = device({ specs: {} })
    const goodInterface = device({ category: 'audio_interface', specs: { maxPreampGain: 60 } })

    expect(checkGainHeadroom(noSpec, goodInterface)).toBeNull()
  })
})
