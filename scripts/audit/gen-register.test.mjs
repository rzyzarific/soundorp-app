import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import devices from '../../src/data/devices.json'
import groupsFile from './audit-groups.json'
import { buildRegister, register } from './gen-register.mjs'
import { drawSample, SEED } from './sample.mjs'
import { drawAt60, SEED_AT_60 } from './sample-at-60.mjs'

const byId = new Map(devices.map((d) => [d.id, d]))
const committed = fs.readFileSync(new URL('../../docs/spec-verification.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n')

describe('docs/spec-verification.md', () => {
  it('is exactly what the generator produces from the catalog (run `node scripts/audit/gen-register.mjs`)', () => {
    expect(committed).toBe(register())
  })

  it('states the real scope up front: how many devices were examined, and that the rest are unexamined', () => {
    const examined = new Set(groupsFile.groups.flatMap((g) => g.ids))
    const scope = committed.slice(committed.indexOf('## Scope'), committed.indexOf('## Records by status'))
    expect(scope).toContain(`Only ${examined.size} of ${devices.length} devices in the catalog have been examined`)
    expect(scope).toContain(`The other ${devices.length - examined.size} are unexamined`)
    expect(scope).toMatch(/original 8 devices of the first verification pass are not covered/)
    expect(scope).toMatch(/stratified random sample found real errors outside everything/)
  })

  it('does not present flag-only records as examination', () => {
    expect(committed).toMatch(/must not be read as/)
  })
})

describe('audit-groups.json', () => {
  it('names only devices that are in the catalog', () => {
    for (const g of groupsFile.groups) for (const id of g.ids) expect(byId.has(id), `${g.key}: ${id}`).toBe(true)
  })

  it('lists exactly the devices the two recorded samples drew', () => {
    const group = (key) => groupsFile.groups.find((g) => g.key === key).ids
    expect(group('partB')).toEqual(drawSample(devices, SEED).map((d) => d.id))
    expect(group('at60')).toEqual(drawAt60(devices, SEED_AT_60).map((d) => d.id))
  })

  it('does not list a device that was removed because the product does not exist', () => {
    for (const g of groupsFile.groups) for (const id of g.removed ?? []) expect(byId.has(id), id).toBe(false)
  })
})

describe('the verification records', () => {
  it('give verified and inferred records only fields the device actually has', () => {
    for (const d of devices) {
      const v = d.verification
      if (!v || v.status === 'in_question') continue
      for (const f of v.fields ?? []) expect(d.specs, `${d.id}.${f}`).toHaveProperty(f)
    }
  })

  it('never record a verified or inferred status on a device that no audit examined', () => {
    const examined = new Set(groupsFile.groups.flatMap((g) => g.ids))
    for (const d of devices) {
      if (d.verification && d.verification.status !== 'in_question') expect(examined.has(d.id), d.id).toBe(true)
    }
  })

  it('carry the combined-figure note on the two devices whose gain includes an output trim', () => {
    for (const id of ['great-river-mp2nv', 'grace-design-m101']) {
      expect(byId.get(id).verification.note, id).toMatch(/combined figure/)
    }
  })

  it('have a generator that refuses a group naming a device the catalog lacks', () => {
    const bad = { groups: [{ key: 'x', title: 'x', ids: ['no-such-device'] }] }
    expect(() => buildRegister(devices, bad, '')).toThrow(/not in the catalog/)
  })
})
