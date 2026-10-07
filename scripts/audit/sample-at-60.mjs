// Draws the sample used to test the "72 devices sit at exactly 60 dB" suspicion, reproducibly.
//
//   node scripts/audit/sample-at-60.mjs
//
// The pool is the 72 devices that had maxPreampGain === 60 on 2026-10-07 (frozen in
// fixtures/at-60-2026-10-07.json, so later corrections that move a device off 60 do not change
// the draw), minus the ones already audited. Drawn with the same seeded generator and the same
// partial Fisher-Yates as sample.mjs: 8 mixers, 6 interfaces, 4 preamps.
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'
import { mulberry32 } from './sample.mjs'

export const SEED_AT_60 = 20261007
export const STRATA_AT_60 = [
  ['mixer', 8],
  ['audio_interface', 6],
  ['preamp', 4],
]

export const FROZEN = JSON.parse(
  fs.readFileSync(new URL('./fixtures/at-60-2026-10-07.json', import.meta.url), 'utf8'),
)

export function drawAt60(devices, seed = SEED_AT_60) {
  const categoryOf = new Map(devices.map((d) => [d.id, d.category]))
  const audited = new Set(FROZEN.auditedBefore)
  const eligible = FROZEN.at60.filter((id) => !audited.has(id))
  const rng = mulberry32(seed)
  const picked = []
  for (const [stratum, count] of STRATA_AT_60) {
    const pool = eligible.filter((id) => categoryOf.get(id) === stratum).sort()
    for (let i = 0; i < count; i++) {
      const j = i + Math.floor(rng() * (pool.length - i))
      ;[pool[i], pool[j]] = [pool[j], pool[i]]
      picked.push({ stratum, id: pool[i] })
    }
  }
  return picked
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const devices = JSON.parse(fs.readFileSync(new URL('../../src/data/devices.json', import.meta.url), 'utf8'))
  const byId = new Map(devices.map((d) => [d.id, d]))
  const sample = drawAt60(devices)
  console.log(`seed ${SEED_AT_60}: ${sample.length} of ${FROZEN.at60.length - new Set(FROZEN.auditedBefore.filter((i) => FROZEN.at60.includes(i))).size} eligible\n`)
  for (const { stratum, id } of sample) console.log(`${stratum.padEnd(16)} ${id.padEnd(34)} ${byId.get(id).brand} ${byId.get(id).name}`)
}
