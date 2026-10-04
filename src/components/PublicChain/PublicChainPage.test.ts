import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { compressToEncodedURIComponent } from 'lz-string'
import { PublicChainPage } from './PublicChainPage'
import { CheckRow } from '../CompatibilityReport/CheckRow'
import type { Device } from '../../data/devices.schema'
import { createCustomDevice, emptyCustomDeviceInput } from '../../lib/customDevices'
import { buildBuilderUrl } from '../../lib/publicLink'
import { encodeChainToShareParam } from '../../lib/share'

const sm7b = 'shure-sm7b'
const audiobox = 'presonus-audiobox-usb-96' // SM7B into this has a gain shortfall, so fix buttons would normally appear
const scarlett = 'focusrite-scarlett-2i2-4gen'
const hs5 = 'yamaha-hs5'

function render(encoded: string | null): string {
  return renderToStaticMarkup(createElement(PublicChainPage, { encoded }))
}

function link(deviceIds: string[], name = 'Test chain', customDevices?: Device[]): string {
  return encodeChainToShareParam({ name, deviceIds, customDevices })
}

const textOf = (html: string) =>
  html
    .replace(/<[^>]+>/g, '\n')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n\s*\n+/g, '\n')

const customDevice = (name: string, overrides = {}): Device => {
  const built = createCustomDevice({ ...emptyCustomDeviceInput('microphone'), name, ...overrides })
  if (!built.ok) throw new Error('fixture failed')
  return built.device
}

describe('a valid public chain page', () => {
  const encoded = link([sm7b, audiobox, hs5], 'Home podcast rig')
  const html = render(encoded)
  const text = textOf(html)

  it('shows the chain name, its devices, the report, the cables and the footer', () => {
    expect(text).toContain('Home podcast rig')
    expect(text).toContain('3 devices')
    for (const name of ['SM7B', 'AudioBox USB 96', 'HS5']) expect(text).toContain(name)
    expect(text).toContain('Compatibility Report')
    expect(text).toContain('Insufficient gain headroom')
    expect(text).toContain('Cables & Adapters')
    expect(text).toContain('XLR cable')
    expect(text).toContain('Made with the')
    expect(text).toContain('soundorp Signal Chain Builder')
  })

  it('offers "Open in builder" at the top and the bottom, pointing at the same chain', () => {
    const href = buildBuilderUrl(encoded)

    // Plain string counting: the href contains regex metacharacters (?, +, $).
    expect(html.split(`href="${href}"`).length - 1).toBe(2)
    expect(text).toContain('Open in builder')
    expect(text).toContain('Open this chain in the builder')
  })

  it('is read-only: no buttons at all', () => {
    expect(html).not.toContain('<button')
  })

  it('has no way to drag, remove, flag or fix anything', () => {
    expect(html).not.toMatch(/aria-label="Remove /)
    expect(html).not.toMatch(/Report incorrect spec/)
    expect(html).not.toMatch(/\(\+\d+ dB/) // the one-click booster buttons
    expect(html).not.toMatch(/aria-roledescription="sortable"|draggable/)
  })

  it('shows the written advice where the fix buttons would have been', () => {
    expect(text).toContain('Fix: Add an inline gain booster')
  })

  it('lays the chain out as a list, with one connection between each pair', () => {
    expect((html.match(/<li\b/g) ?? []).length).toBe(3)
    expect(html).toContain('aria-label="Signal chain"')
    expect((html.match(/Connection status:/g) ?? []).length).toBe(2)
  })

  it('runs the connectors down between stacked devices on small screens, and across on wide ones', () => {
    // One connector per pair, carrying both layouts as responsive classes (no duplicate elements).
    expect((html.match(/title="Connection status/g) ?? []).length).toBe(2)
    expect(html).toContain('sm:flex-row') // the list switches to a row from the small breakpoint
    expect(html).toContain('flex-col items-center') // …and is a column below it
    expect(html).toContain('h-full w-0.5 sm:h-0.5 sm:w-full') // the line is vertical, then horizontal
  })

  it('says it was shared by a user, not written by soundorp', () => {
    expect(text).toContain('Shared by a user')
  })

  it('shows nothing from the Pro features', () => {
    expect(text).not.toMatch(/Shopping|Estimated total|Budget|\$\d/)
  })

  it('does not depend on the visitor having a builder or any saved state', () => {
    expect(text).not.toMatch(/Saved chains|New chain|Export PDF|Get Pro|Search gear/)
  })
})

describe('custom devices on the page', () => {
  it('shows a custom device from the link, tagged, with no spec-report flag', () => {
    const mic = customDevice('Guest Condenser', { needsPhantomPower: true })
    const html = render(link([mic.id, scarlett], 'With custom', [mic]))
    const text = textOf(html)

    expect(text).toContain('Guest Condenser')
    expect(text).toContain('Custom')
    expect(text).toContain('Phantom power available') // checked with the embedded specs
    expect(html).not.toMatch(/Report incorrect spec/)
  })

  it('skips a custom device whose specs are not in the link, and says so', () => {
    const text = textOf(render(link([scarlett, 'custom-missing', hs5])))

    expect(text).toContain('1 device in this link is no longer in the catalog and was skipped.')
    expect(text).toContain('2 devices')
  })
})

describe('skipped devices', () => {
  it('warns, singular and plural', () => {
    expect(textOf(render(link([sm7b, 'gone', scarlett])))).toContain('1 device in this link is no longer in the catalog and was skipped.')
    expect(textOf(render(link([sm7b, 'gone', 'gone-too', scarlett])))).toContain('2 devices in this link are no longer in the catalog and were skipped.')
  })

  it('does not warn when nothing was skipped', () => {
    expect(textOf(render(link([sm7b, scarlett])))).not.toContain('no longer in the catalog')
  })
})

describe('small chains', () => {
  it('says an empty chain is empty, keeps the builder link, and shows no report', () => {
    const encoded = link([])
    const html = render(encoded)
    const text = textOf(html)

    expect(text).toContain('This chain is empty.')
    expect(text).toContain('0 devices')
    expect(text).not.toContain('Compatibility Report')
    expect(html).toContain(`href="${buildBuilderUrl(encoded)}"`)
  })

  it('shows one device without a report or cables', () => {
    const text = textOf(render(link([sm7b])))

    expect(text).toContain('1 device ·')
    expect(text).not.toContain('Compatibility Report')
    expect(text).not.toContain('Cables & Adapters')
  })
})

describe('an invalid link', () => {
  it.each([
    ['garbage', 'not-a-real-encoded-string'],
    ['an undecodable address', null],
    ['an empty payload', ''],
  ])('shows a friendly page for %s, with a way back', (_label, encoded) => {
    const html = render(encoded)
    const text = textOf(html)

    expect(text).toContain("This link isn't valid")
    expect(text).toContain('Ask for a fresh link')
    expect(html).toContain('href="/"')
    expect(text).toContain('Open the builder')
    expect(text).not.toContain('Compatibility Report')
    expect(html).not.toContain('<button')
  })

  it('shows it for a well-formed payload of the wrong version', () => {
    expect(textOf(render(compressToEncodedURIComponent(JSON.stringify({ v: 9, n: 'x', d: [] }))))).toContain("This link isn't valid")
  })
})

describe('what a link can put on the page', () => {
  it('escapes markup in the chain name instead of interpreting it', () => {
    const html = render(link([sm7b, scarlett], '<script>alert(1)</script><img src=x onerror=alert(1)>'))

    expect(html).not.toContain('<script')
    expect(html).not.toMatch(/<img[^>]*onerror/)
    expect(html).toContain('&lt;script&gt;')
  })

  it('strips direction overrides and control characters from the name', () => {
    const text = textOf(render(link([sm7b, scarlett], 'invoice‮gnp.exe\nsecond line')))

    expect(text).not.toContain('‮')
    expect(text).toContain('invoice gnp.exe second line')
  })

  it('caps an enormous name', () => {
    const text = textOf(render(link([sm7b, scarlett], 'x'.repeat(10_000))))

    expect(text).toContain('x'.repeat(120))
    expect(text).not.toContain('x'.repeat(121))
  })

  it('falls back to "Shared chain" for a blank or all-unsafe name', () => {
    expect(textOf(render(link([sm7b, scarlett], '   ')))).toContain('Shared chain')
    expect(textOf(render(link([sm7b, scarlett], '‮\u0000')))).toContain('Shared chain')
  })

  it('escapes markup in a custom device name too', () => {
    const mic = customDevice('<b onmouseover=alert(1)>x</b>')
    const html = render(link([mic.id, scarlett], 'c', [mic]))

    expect(html).not.toMatch(/<b onmouseover/)
    expect(html).toContain('&lt;b')
  })
})

describe('CheckRow read-only mode', () => {
  const withActions = {
    severity: 'warning' as const,
    title: 'Insufficient gain headroom',
    detail: 'needs more gain',
    fix: 'Add an inline gain booster.',
    actions: [{ type: 'insert_device' as const, deviceId: 'triton-audio-fethead', position: 1, label: 'Add FetHead (+27 dB, $90)' }],
  }
  const render = (props: object) => renderToStaticMarkup(createElement(CheckRow, { result: withActions, ...props }))

  it('normally shows the fix buttons and hides the written advice', () => {
    const html = render({})

    expect(html).toContain('<button')
    expect(html).toContain('Add FetHead')
    expect(html).not.toContain('Add an inline gain booster.')
  })

  it('in read-only mode shows the written advice and no buttons', () => {
    const html = render({ readOnly: true })

    expect(html).not.toContain('<button')
    expect(html).not.toContain('Add FetHead')
    expect(html).toContain('Fix: Add an inline gain booster.')
  })

  it('read-only mode still shows rows that never had actions the same as before', () => {
    const plain = { severity: 'pass' as const, title: 'Connectors match', detail: 'ok' }

    expect(renderToStaticMarkup(createElement(CheckRow, { result: plain, readOnly: true }))).toBe(
      renderToStaticMarkup(createElement(CheckRow, { result: plain })),
    )
  })
})
