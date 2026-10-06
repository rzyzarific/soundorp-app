// Draws the stratified random sample used by the spec audit, reproducibly.
//
//   node scripts/audit/sample.mjs            # prints the sample for the recorded seed
//   node scripts/audit/sample.mjs 12345      # any other seed
//
// Same seed + same catalog = same sample. The pool for each stratum is sorted by id first, so the
// order of rows in devices.json does not matter, then drawn with a seeded partial Fisher-Yates
// shuffle (mulberry32). Strata are drawn in the order listed in STRATA from one stream of random
// numbers, so adding a stratum at the end never changes the earlier picks.
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

/** The seed recorded for the 2026-10-06 audit. */
export const SEED = 20261006

/** 'other' is every category not named: monitors, headphones, DAWs. */
export const STRATA = [
  ['audio_interface', 8],
  ['microphone', 8],
  ['preamp', 6],
  ['mixer', 4],
  ['other', 4],
]

/**
 * Devices that were checked on their own in the first part of the audit (the WA273 family and the
 * other devices at 55 dB), so they are left out of the random pool rather than counted twice.
 * The three in-line boosters are left out too: they are checked separately.
 */
export const ALREADY_CHECKED = [
  'warm-audio-wa273-eq',
  'warm-audio-wa273',
  'warm-audio-wa12',
  'warm-audio-wa412',
  'universal-audio-volt-2',
  'great-river-mp2nv',
  'native-instruments-komplete-audio-2',
  'native-instruments-komplete-audio-6',
  'focusrite-scarlett-4i4-2gen',
]

export function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function drawSample(devices, seed = SEED, exclude = ALREADY_CHECKED) {
  const skip = new Set(exclude)
  const eligible = devices.filter((d) => !skip.has(d.id) && d.specs.gainBoost === undefined)
  const named = new Set(STRATA.map(([c]) => c).filter((c) => c !== 'other'))
  const rng = mulberry32(seed)
  const picked = []
  for (const [stratum, count] of STRATA) {
    const pool = eligible
      .filter((d) => (stratum === 'other' ? !named.has(d.category) : d.category === stratum))
      .map((d) => d.id)
      .sort()
    for (let i = 0; i < count; i++) {
      const j = i + Math.floor(rng() * (pool.length - i))
      ;[pool[i], pool[j]] = [pool[j], pool[i]]
      picked.push({ stratum, id: pool[i] })
    }
  }
  return picked
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const seed = process.argv[2] ? Number(process.argv[2]) : SEED
  const devices = JSON.parse(fs.readFileSync(new URL('../../src/data/devices.json', import.meta.url), 'utf8'))
  const byId = new Map(devices.map((d) => [d.id, d]))
  const sample = drawSample(devices, seed)
  console.log(`seed ${seed}, ${sample.length} devices\n`)
  for (const { stratum, id } of sample) {
    const d = byId.get(id)
    console.log(`${stratum.padEnd(16)} ${id.padEnd(48)} ${d.brand} ${d.name} (${d.category})`)
  }
}
