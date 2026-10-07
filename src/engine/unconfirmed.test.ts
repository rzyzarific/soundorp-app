import { describe, expect, it } from 'vitest'
import type { Verification } from '../data/devices.schema'
import { device } from './rules/testFixtures'
import { unconfirmedNote } from './unconfirmed'

const entry = (over: Partial<Verification>): Verification => ({
  status: 'in_question',
  note: 'Sources disagree.',
  checkedOn: '2026-10-07',
  ...over,
})

describe('unconfirmedNote', () => {
  it('is null for a device with no verification at all', () => {
    expect(unconfirmedNote(device({}), 'providesPhantomPower')).toBeNull()
  })

  it('returns the note when the named spec is in question', () => {
    const d = device({ verification: entry({ fields: ['providesPhantomPower'] }) })
    expect(unconfirmedNote(d, 'providesPhantomPower')).toBe('Sources disagree.')
  })

  it('is null for a spec the entry is not about', () => {
    const d = device({ verification: entry({ fields: ['minPreampGain'] }) })
    expect(unconfirmedNote(d, 'providesPhantomPower')).toBeNull()
  })

  it('matches if any of several named specs is in question', () => {
    const d = device({ verification: entry({ fields: ['needsPhantomPower'] }) })
    expect(unconfirmedNote(d, 'phantomPowerDamages', 'needsPhantomPower')).not.toBeNull()
  })

  it('treats an entry with no fields as being about the whole device', () => {
    expect(unconfirmedNote(device({ verification: entry({}) }), 'providesPhantomPower')).toBe('Sources disagree.')
  })

  it('ignores verified and inferred entries: only a doubt makes a result unconfirmed', () => {
    for (const status of ['verified', 'inferred'] as const) {
      const d = device({ verification: entry({ status, source: 'a page', fields: ['providesPhantomPower'] }) })
      expect(unconfirmedNote(d, 'providesPhantomPower'), status).toBeNull()
    }
  })
})
