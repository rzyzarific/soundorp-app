import { describe, expect, it } from 'vitest'
import devices from '../../src/data/devices.json'
import { FROZEN, SEED_AT_60, STRATA_AT_60, drawAt60 } from './sample-at-60.mjs'

describe('the at-60 dB sample', () => {
  it('is exactly the 18 devices that were checked on 2026-10-07', () => {
    expect(drawAt60(devices, SEED_AT_60).map((d) => d.id)).toEqual([
      'yamaha-mg20xu',
      'behringer-xenyx-x1204usb',
      'allen-heath-zed60-14fx',
      'mackie-profx6v3',
      'behringer-xenyx-302usb',
      'behringer-xenyx-802',
      'behringer-xenyx-2442fx',
      'yamaha-ag06-mkii',
      'antelope-zen-go-synergy-core',
      'presonus-studio-26c',
      'focusrite-vocaster-two',
      'mackie-onyx-producer-2-2',
      'motu-8a',
      'zoom-uac-2',
      'golden-age-pre-73',
      'art-pro-mpa-ii',
      'behringer-mic200',
      'spl-crimson-3',
    ])
  })

  it('keeps its pool of 72 frozen, with the per-stratum counts asked for', () => {
    expect(FROZEN.at60).toHaveLength(72)
    const counts = {}
    for (const { stratum } of drawAt60(devices)) counts[stratum] = (counts[stratum] ?? 0) + 1
    expect(counts).toEqual(Object.fromEntries(STRATA_AT_60))
  })

  it('never draws a device that was already audited', () => {
    const audited = new Set(FROZEN.auditedBefore)
    for (const { id } of drawAt60(devices)) expect(audited.has(id), id).toBe(false)
  })
})
