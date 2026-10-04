import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { deviceIconKind, type DeviceIconKind } from './deviceIconKind'
import { DeviceIcon } from '../components/PdfExport/DeviceIcon'
import { ALL_DEVICES, getDeviceById } from '../data/devices'
import { device } from '../engine/rules/testFixtures'

const ALL_KINDS: DeviceIconKind[] = [
  'mic_dynamic',
  'mic_condenser',
  'mic_ribbon',
  'booster',
  'preamp',
  'interface',
  'mixer',
  'monitor',
  'headphones',
  'daw',
]

describe('deviceIconKind on the real catalog', () => {
  it('gives every catalog device a drawing', () => {
    for (const d of ALL_DEVICES) {
      expect(ALL_KINDS, d.id).toContain(deviceIconKind(d))
    }
  })

  it('uses every drawing at least once, so none is dead code', () => {
    const used = new Set(ALL_DEVICES.map(deviceIconKind))

    expect([...used].sort()).toEqual([...ALL_KINDS].sort())
  })

  it('draws catalog mics by their type', () => {
    for (const d of ALL_DEVICES.filter((x) => x.category === 'microphone')) {
      const expected = { dynamic: 'mic_dynamic', condenser: 'mic_condenser', ribbon: 'mic_ribbon' }[d.subtype ?? '']
      expect(deviceIconKind(d), d.id).toBe(expected)
    }
  })

  it('draws the in-line boosters as boosters, and other preamps as preamps', () => {
    for (const d of ALL_DEVICES.filter((x) => x.category === 'preamp')) {
      expect(deviceIconKind(d), d.id).toBe(d.specs.gainBoost !== undefined ? 'booster' : 'preamp')
    }
    expect(deviceIconKind(getDeviceById('triton-audio-fethead')!)).toBe('booster')
  })

  it('maps the other categories one to one', () => {
    const expected = { audio_interface: 'interface', mixer: 'mixer', monitor: 'monitor', headphones: 'headphones', daw: 'daw' }
    for (const d of ALL_DEVICES) {
      if (d.category in expected) expect(deviceIconKind(d), d.id).toBe(expected[d.category as keyof typeof expected])
    }
  })
})

describe('deviceIconKind for custom devices (no subtype)', () => {
  const mic = (specs = {}) => device({ category: 'microphone', specs })

  it('treats a mic phantom power can damage as a ribbon', () => {
    expect(deviceIconKind(mic({ phantomPowerDamages: true }))).toBe('mic_ribbon')
  })

  it('treats a mic that needs phantom power as a condenser', () => {
    expect(deviceIconKind(mic({ needsPhantomPower: true }))).toBe('mic_condenser')
  })

  it('draws any other mic as dynamic', () => {
    expect(deviceIconKind(mic())).toBe('mic_dynamic')
  })

  it('lets ribbon win over condenser when both are set', () => {
    expect(deviceIconKind(mic({ phantomPowerDamages: true, needsPhantomPower: true }))).toBe('mic_ribbon')
  })

  it('draws a custom preamp with a gain boost as a booster', () => {
    expect(deviceIconKind(device({ category: 'preamp', specs: { gainBoost: 20 } }))).toBe('booster')
    expect(deviceIconKind(device({ category: 'preamp', specs: { gainBoost: 0 } }))).toBe('booster') // zero is still a booster
    expect(deviceIconKind(device({ category: 'preamp', specs: {} }))).toBe('preamp')
  })

  it('lets a stated subtype win over specs: a dynamic mic that needs phantom power is still dynamic', () => {
    expect(deviceIconKind(device({ category: 'microphone', subtype: 'dynamic', specs: { needsPhantomPower: true } }))).toBe('mic_dynamic')
    expect(deviceIconKind(device({ category: 'microphone', subtype: 'condenser', specs: { phantomPowerDamages: true } }))).toBe('mic_condenser')
    expect(deviceIconKind(device({ category: 'microphone', subtype: 'ribbon', specs: { needsPhantomPower: true } }))).toBe('mic_ribbon')
  })

  it('draws the real SM7dB (dynamic, needs phantom power for its preamp) as a dynamic mic', () => {
    const sm7db = getDeviceById('shure-sm7db')!

    expect(sm7db.specs.needsPhantomPower).toBe(true)
    expect(deviceIconKind(sm7db)).toBe('mic_dynamic')
  })

  it('falls back to the specs for an unrecognised subtype', () => {
    expect(deviceIconKind(device({ category: 'microphone', subtype: 'electret', specs: { needsPhantomPower: true } }))).toBe('mic_condenser')
  })
})

describe('DeviceIcon', () => {
  it.each(ALL_KINDS)('renders a real drawing for %s', (kind) => {
    const sample = ALL_DEVICES.find((d) => deviceIconKind(d) === kind)!
    const svg = renderToStaticMarkup(createElement(DeviceIcon, { device: sample }))

    expect(svg).toContain(`data-icon="${kind}"`)
    expect(svg).toContain('viewBox="0 0 48 48"')
    // a single scribble would not be a drawing: expect several shapes
    expect((svg.match(/<(rect|circle|path|line|polyline)\b/g) ?? []).length).toBeGreaterThanOrEqual(3)
  })

  it('uses only literal hex colours, because html2canvas cannot read modern colour functions', () => {
    for (const kind of ALL_KINDS) {
      const sample = ALL_DEVICES.find((d) => deviceIconKind(d) === kind)!
      const svg = renderToStaticMarkup(createElement(DeviceIcon, { device: sample }))

      expect(svg, kind).not.toMatch(/oklch|color-mix|lab\(|lch\(|var\(|currentColor|class=/)
      for (const colour of svg.match(/(?:fill|stroke)="([^"]+)"/g) ?? []) {
        expect(colour, kind).toMatch(/="(#[0-9a-f]{6}|none)"/i)
      }
    }
  })

  it('honours the requested size', () => {
    const svg = renderToStaticMarkup(createElement(DeviceIcon, { device: ALL_DEVICES[0], size: 44 }))

    expect(svg).toContain('width="44"')
    expect(svg).toContain('height="44"')
  })
})
