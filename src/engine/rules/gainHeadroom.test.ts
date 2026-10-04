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

  it('tags a shortfall with its size so fixes can be derived without parsing text', () => {
    const sm7b = device({ specs: { minPreampGain: 60 } })
    const budgetInterface = device({ category: 'audio_interface', specs: { maxPreampGain: 35 } })

    expect(checkGainHeadroom(sm7b, budgetInterface)?.problem).toEqual({
      type: 'gain_shortfall',
      gap: 25,
    })
  })

  it('does not tag a passing result as a problem', () => {
    const condenser = device({ specs: { minPreampGain: 30 } })
    const goodInterface = device({ category: 'audio_interface', specs: { maxPreampGain: 60 } })

    expect(checkGainHeadroom(condenser, goodInterface)?.problem).toBeUndefined()
  })
})

describe('checkGainHeadroom with an inline booster in the chain', () => {
  const sm7b = device({ name: 'SM7B', specs: { minPreampGain: 60 } })
  const booster = (name: string, gainBoost: number) =>
    device({ name, category: 'preamp', specs: { gainBoost } })
  const iface = (maxPreampGain: number) =>
    device({ name: 'Interface', category: 'audio_interface', specs: { maxPreampGain } })

  function check(chain: ReturnType<typeof device>[], upstreamIndex: number) {
    return checkGainHeadroom(chain[upstreamIndex], chain[upstreamIndex + 1], {
      devices: chain,
      upstreamIndex,
    })
  }

  it('credits the boost against the mic, so a fixed shortfall now passes', () => {
    const chain = [sm7b, booster('Cloudlifter', 25), iface(56)]

    const result = check(chain, 1)

    expect(result?.severity).toBe('pass')
    expect(result?.detail).toContain('SM7B needs about 60dB')
    expect(result?.detail).toContain('Cloudlifter adds 25dB')
    expect(result?.detail).toContain('supply about 35dB')
    expect(result?.detail).toContain('21dB of headroom')
  })

  it('passes with zero headroom when the boosted need exactly equals what the input provides', () => {
    const result = check([sm7b, booster('Cloudlifter', 25), iface(35)], 1)

    expect(result?.severity).toBe('pass')
    expect(result?.detail).toContain('0dB of headroom')
  })

  it('still warns when the booster is not enough, without offering to add another one', () => {
    const result = check([sm7b, booster('Cloudlifter', 25), iface(30)], 1)

    expect(result?.severity).toBe('warning')
    expect(result?.detail).toContain('5dB shortfall even with the booster')
    // Its size is recorded so swaps can be compared, but it is not the "add a booster"
    // kind of problem, so no further booster is offered for it.
    expect(result?.problem).toEqual({ type: 'boosted_gain_shortfall', gap: 5 })
  })

  it('adds up boosters stacked back to back', () => {
    const chain = [sm7b, booster('A', 25), booster('B', 27), iface(10)]

    const result = check(chain, 2)

    expect(result?.severity).toBe('pass')
    expect(result?.detail).toContain('A + B adds 52dB')
    expect(result?.detail).toContain('supply about 8dB')
  })

  it('never reports a negative requirement when the boost exceeds the mic need', () => {
    const lowNeed = device({ name: 'Condenser', specs: { minPreampGain: 20 } })

    const result = check([lowNeed, booster('FetHead', 27), iface(40)], 1)

    expect(result?.detail).toContain('supply about 0dB')
  })

  it('has nothing to say about the mic → booster connection itself', () => {
    expect(check([sm7b, booster('Cloudlifter', 25), iface(56)], 0)).toBeNull()
  })

  it('is silent for a booster with no mic upstream', () => {
    expect(check([booster('Cloudlifter', 25), iface(56)], 0)).toBeNull()
    const preamp = device({ category: 'preamp', specs: { maxPreampGain: 50 } })
    expect(check([preamp, booster('Cloudlifter', 25), iface(56)], 1)).toBeNull()
  })

  it('is silent for a booster when called without chain context', () => {
    expect(checkGainHeadroom(booster('Cloudlifter', 25), iface(56))).toBeNull()
  })

  it('ignores a context that does not match the upstream device', () => {
    const chain = [sm7b, booster('Cloudlifter', 25), iface(56)]

    expect(checkGainHeadroom(chain[1], chain[2], { devices: chain, upstreamIndex: 0 })).toBeNull()
  })
})
