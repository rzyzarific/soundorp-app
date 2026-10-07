// Runs every browser script against the app at APP (default http://localhost:5199) and prints
// one line per script. Exits non-zero if any check failed. See README.md.
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { APP_URL } from './lib.mjs'

const SCRIPTS = ['m0', 'm0b', 'm1', 'm2', 'm2b', 'm3', 'm4', 'm5', 'm6', 'ui-layout', 'touch-drag', 'unconfirmed']
const only = process.argv.slice(2)
const chosen = only.length ? SCRIPTS.filter((s) => only.includes(s)) : SCRIPTS

console.log(`Running ${chosen.length} browser scripts against ${APP_URL}\n`)
let failed = 0
let checks = 0
for (const name of chosen) {
  const started = Date.now()
  const run = spawnSync(process.execPath, [fileURLToPath(new URL(`./${name}.mjs`, import.meta.url))], {
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
  })
  const out = `${run.stdout ?? ''}${run.stderr ?? ''}`
  const summary = out.match(/(\d+)\/(\d+) (?:live browser )?checks passed/)
  const ok = run.status === 0 && summary && summary[1] === summary[2]
  if (summary) checks += Number(summary[2])
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(10)} ${summary ? `${summary[1]}/${summary[2]}` : 'no summary'}  (${Math.round((Date.now() - started) / 1000)}s)`)
  if (!ok) console.log(out.split('\n').filter((l) => /^FAIL|Error|error/.test(l)).slice(0, 15).join('\n'))
}
console.log(`\n${chosen.length - failed}/${chosen.length} scripts passed, ${checks} checks in total`)
process.exit(failed ? 1 : 0)
