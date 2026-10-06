import { describe, expect, it } from 'vitest'
import devices from '../../src/data/devices.json'
import { ALREADY_CHECKED, SEED, STRATA, drawSample, mulberry32 } from './sample.mjs'

describe('audit sample', () => {
  it('is the same list every time for the same seed and catalog', () => {
    expect(drawSample(devices, SEED)).toEqual(drawSample(devices, SEED))
    expect(drawSample([...devices].reverse(), SEED)).toEqual(drawSample(devices, SEED)) // row order is irrelevant
  })

  it('is a different list for a different seed', () => {
    expect(drawSample(devices, SEED + 1).map((d) => d.id)).not.toEqual(drawSample(devices, SEED).map((d) => d.id))
  })

  it('has 8 interfaces, 8 microphones, 6 preamps, 4 mixers and 4 from the remaining categories', () => {
    const byId = new Map(devices.map((d) => [d.id, d]))
    const counts = {}
    for (const { stratum, id } of drawSample(devices)) {
      counts[stratum] = (counts[stratum] ?? 0) + 1
      if (stratum !== 'other') expect(byId.get(id).category).toBe(stratum)
      else expect(['monitor', 'headphones', 'daw']).toContain(byId.get(id).category)
    }
    expect(counts).toEqual(Object.fromEntries(STRATA))
  })

  it('has no repeats, and skips devices already checked and the in-line boosters', () => {
    const ids = drawSample(devices).map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
    const boosters = devices.filter((d) => d.specs.gainBoost !== undefined).map((d) => d.id)
    for (const id of [...ALREADY_CHECKED, ...boosters]) expect(ids).not.toContain(id)
  })

  it('uses a seeded generator that repeats exactly', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
})
