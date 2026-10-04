import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ChainPrintLayout } from './ChainPrintLayout'
import { getDeviceById } from '../../data/devices'
import type { Device } from '../../data/devices.schema'
import { evaluateChain } from '../../engine/evaluateChain'
import { buildCableList } from '../../lib/cableList'
import { createCustomDevice, emptyCustomDeviceInput } from '../../lib/customDevices'
import { PRICE_DISCLAIMER, buildShoppingList } from '../../lib/shoppingList'

const dev = (id: string) => getDeviceById(id)!
const sm7b = dev('shure-sm7b')
const scarlett = dev('focusrite-scarlett-2i2-4gen')
const hs5 = dev('yamaha-hs5')

function render(devices: Device[], budget: number | null = null): string {
  return renderToStaticMarkup(
    createElement(ChainPrintLayout, {
      chainName: 'Test chain',
      devices,
      connections: evaluateChain(devices),
      generatedAt: new Date('2026-10-04T12:00:00Z'),
      cables: buildCableList(devices),
      shopping: buildShoppingList(devices),
      budget,
    }),
  )
}

// html2canvas needs plain text and stable order, so tests look at the text, not the markup.
const textOf = (html: string) =>
  html
    .replace(/<br\s*\/?>/g, ' ')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/\n\s*\n+/g, '\n')

const customDevice = (name: string, overrides = {}): Device => {
  const built = createCustomDevice({ ...emptyCustomDeviceInput('microphone'), name, ...overrides })
  if (!built.ok) throw new Error('fixture failed')
  return built.device
}

describe('ChainPrintLayout sections', () => {
  const html = render([sm7b, scarlett, hs5])
  const text = textOf(html)

  it('has every section, in order, before the footer', () => {
    const order = ['Signal chain', 'Compatibility report', 'Cables & adapters', 'Shopping list', 'Created with the soundorp']
    const positions = order.map((s) => text.indexOf(s))

    expect(positions.every((p) => p >= 0), JSON.stringify(positions)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
  })

  it('keeps the existing signal chain and report content', () => {
    expect(text).toContain('SM7B')
    expect(text).toContain('Insufficient gain headroom')
    expect(text).toContain('Connectors match')
    expect(text).toContain('3 devices')
  })

  it('uses only inline styles: no classes and none of the colour functions html2canvas cannot parse', () => {
    expect(html).not.toMatch(/\sclass=/)
    expect(html).not.toMatch(/oklch|color-mix|lab\(|lch\(/)
  })
})

describe('cables in the PDF', () => {
  it('lists the same cables as the on-screen list, with quantities and the connections they cover', () => {
    const devices = [sm7b, scarlett, hs5]
    const text = textOf(render(devices))

    for (const line of buildCableList(devices).lines) {
      expect(text).toContain(`${line.quantity}×`)
      expect(text).toContain(line.label)
      expect(text).toContain(line.connections.join(', '))
    }
    expect(text).toContain('XLR cable')
    expect(text).toContain('TRS cable')
  })

  it('shows an adapter line in the warning colour when connectors do not overlap', () => {
    const um2 = dev('behringer-um2')
    const strict = dev('yamaha-hs5')
    const html = render([um2, strict])

    expect(textOf(html)).toContain('RCA → TRS/XLR adapter')
    expect(html).toContain('#b45309') // SEVERITY.warning.accent
  })

  it('says why a headphone-only device has no cable listed', () => {
    const text = textOf(render([dev('zoom-podtrak-p4'), hs5]))

    expect(text).toContain('No line-level output, so no cable is listed for:')
    expect(text).toContain('PodTrak P4 → HS5')
  })

  it('says when nothing could be worked out, and notes pairs with no connector data', () => {
    const daw = dev('logic-pro')
    const text = textOf(render([daw, hs5]))

    expect(text).toContain('No cables could be worked out for this chain.')
    expect(text).toContain('Not included (no connector data):')
  })

  it("always reminds the reader that lengths aren't specified", () => {
    expect(textOf(render([sm7b, scarlett]))).toContain("Cable lengths aren't specified")
  })
})

describe('shopping list in the PDF', () => {
  it('lists each device with its price and the total', () => {
    const devices = [sm7b, scarlett, hs5]
    const text = textOf(render(devices))
    const { total } = buildShoppingList(devices)

    expect(total).toBe(797)
    expect(text).toContain('$399')
    expect(text).toContain('$199')
    expect(text).toContain('Estimated total')
    expect(text).toContain('$797')
  })

  it('folds a repeated device into a "2×" line with a per-unit price and subtotal', () => {
    const sm58 = dev('shure-sm58')
    const text = textOf(render([sm58, scarlett, sm58]))

    expect(text).toContain('2× SM58')
    expect(text).toContain('$99 each')
    expect(text).toContain('$198')
  })

  it('shows "No price" for an unpriced device, leaves it out of the total, and says so', () => {
    const unpriced = customDevice('Mystery Mic')
    const text = textOf(render([unpriced, scarlett]))

    expect(text).toContain('No price')
    expect(text).toContain("1 device without a price isn't included in the total.")
    expect(text).toContain('Estimated total $199')
  })

  it('pluralises the unpriced note', () => {
    const text = textOf(render([customDevice('A'), customDevice('B'), scarlett]))

    expect(text).toContain("2 devices without a price aren't included in the total.")
  })

  it('counts a custom device’s own price and marks it as custom', () => {
    const priced = customDevice('My Mic', { msrp: 180 })
    const text = textOf(render([priced, scarlett]))

    expect(text).toContain('(custom)')
    expect(text).toContain('· Custom') // in the signal chain list
    expect(text).toContain('$180')
    expect(text).toContain('$379') // 180 + 199
  })

  it('does not write "by Custom" for a custom device that was never given a brand', () => {
    const text = textOf(render([customDevice('Plain Mic'), scarlett]))

    expect(text).toContain('Plain Mic')
    expect(text).toContain('(custom)')
    expect(text).not.toContain('by Custom')
  })

  it('still shows a brand the owner did enter', () => {
    const text = textOf(render([customDevice('Fancy Mic', { brand: 'Acme' }), scarlett]))

    expect(text).toContain('by Acme')
    expect(text).toContain('(custom)')
  })

  it('always shows catalog brands, including one literally named "Custom"', () => {
    const text = textOf(render([sm7b, scarlett]))

    expect(text).toContain('by Shure')
    expect(text).toContain('by Focusrite')
  })

  it('carries the dated price disclaimer', () => {
    const text = textOf(render([sm7b, scarlett]))

    expect(text).toContain(PRICE_DISCLAIMER)
    expect(text).toContain('September 2026')
    expect(text).toMatch(/check current pricing before buying/i)
  })

  it('puts the disclaimer after the total, inside the shopping section', () => {
    const text = textOf(render([sm7b, scarlett]))
    const shopping = text.slice(text.indexOf('Shopping list'))

    expect(shopping.indexOf('Estimated total')).toBeLessThan(shopping.indexOf('Prices are approximate'))
    expect(shopping.indexOf('Prices are approximate')).toBeLessThan(shopping.indexOf('Created with the soundorp'))
  })

  it('treats a price of zero as a real price, not as missing', () => {
    const free = customDevice('Free Thing', { msrp: 0 })
    const text = textOf(render([free, scarlett]))

    expect(text).not.toContain('No price')
    expect(text).toContain('$0')
  })

  it('escapes device names rather than injecting markup', () => {
    const nasty = customDevice('<img src=x onerror=alert(1)>', { msrp: 5 })
    const html = render([nasty, scarlett])

    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
  })
})

describe('budget status in the PDF summary', () => {
  const chain = [sm7b, scarlett, hs5] // $797

  it('says how far over budget', () => {
    const text = textOf(render(chain, 600))

    expect(text).toContain('Budget $600')
    expect(text).toContain('$197 over budget')
  })

  it('says how far under budget', () => {
    expect(textOf(render(chain, 1000))).toContain('$203 under budget')
  })

  it('says when exactly on budget', () => {
    expect(textOf(render(chain, 797))).toContain('Right on budget')
  })

  it('treats a $0 budget as a real budget', () => {
    expect(textOf(render(chain, 0))).toContain('$797 over budget')
  })

  it('leaves budget wording out entirely when none is set', () => {
    const text = textOf(render(chain, null))

    expect(text).not.toContain('Budget')
    expect(text).not.toMatch(/over budget|under budget|on budget/)
  })

  it('uses the same wording as the on-screen list', async () => {
    const { budgetStatus, budgetStatusText } = await import('../../lib/shoppingList')
    const status = budgetStatus(797, 600)!

    expect(textOf(render(chain, 600))).toContain(budgetStatusText(status))
  })
})

describe('device icons in the PDF', () => {
  const icons = (html: string) => [...html.matchAll(/data-icon="([a-z_]+)"/g)].map((m) => m[1])

  it('draws each device twice: once in the at-a-glance strip, once on its signal-chain row', () => {
    const html = render([sm7b, scarlett, hs5])

    expect(icons(html)).toEqual([
      'mic_dynamic', 'interface', 'monitor', // strip
      'mic_dynamic', 'interface', 'monitor', // rows
    ])
  })

  it('shows the right kind of drawing for each kind of gear', () => {
    const condenser = dev('rode-nt1')
    const ribbon = dev('royer-r121')
    const booster = dev('triton-audio-fethead')
    const mixer = dev('yamaha-mg10xu')
    const html = render([condenser, ribbon, booster, scarlett, mixer, hs5, dev('sony-mdr7506'), dev('ableton-live-12')])

    expect(new Set(icons(html))).toEqual(
      new Set(['mic_condenser', 'mic_ribbon', 'booster', 'interface', 'mixer', 'monitor', 'headphones', 'daw']),
    )
  })

  it('draws custom devices from their specs, so no image is ever needed for them', () => {
    const ribbon = customDevice('My Ribbon', { phantomPowerDamages: true })
    const condenser = customDevice('My Condenser', { needsPhantomPower: true })
    const dynamic = customDevice('My Dynamic')

    expect(icons(render([ribbon, condenser, dynamic])).slice(0, 3)).toEqual([
      'mic_ribbon',
      'mic_condenser',
      'mic_dynamic',
    ])
  })

  it('is plain inline SVG: no images, no external references, no classes', () => {
    const html = render([sm7b, scarlett, hs5])

    expect(html).toContain('<svg')
    expect(html).not.toMatch(/<img|<image|href=|url\(|xlink/)
    expect(html).not.toMatch(/\sclass=/)
  })

  it('hides the drawings from assistive tech, since the device name says it all', () => {
    const html = render([sm7b, scarlett])

    expect((html.match(/<svg[^>]*aria-hidden="true"/g) ?? []).length).toBe(4)
  })

  it('colours each arrow by the worst result for that connection', () => {
    const html = render([sm7b, scarlett, hs5]) // gain warning, then a clean connection
    const arrows = [...html.matchAll(/<span style="[^"]*color:(#[0-9a-f]{6})[^"]*">→<\/span>/gi)].map((m) => m[1])

    expect(arrows).toEqual(['#b45309', '#15803d']) // amber warning, green pass
  })

  it('uses a critical colour for a critical connection', () => {
    const ribbon = dev('royer-r121')
    const html = render([ribbon, scarlett])
    const arrows = [...html.matchAll(/<span style="[^"]*color:(#[0-9a-f]{6})[^"]*">→<\/span>/gi)].map((m) => m[1])

    expect(arrows).toEqual(['#b91c1c'])
  })

  it('uses a neutral colour where a connection has no applicable checks', () => {
    const html = render([hs5, sm7b]) // nothing applies from a monitor onward
    const arrows = [...html.matchAll(/<span style="[^"]*color:(#[0-9a-f]{6})[^"]*">→<\/span>/gi)].map((m) => m[1])

    expect(arrows).toEqual(['#6b7280'])
  })

  it('explains what the arrow colours mean', () => {
    expect(textOf(render([sm7b, scarlett]))).toContain('Arrows show the worst result for each connection')
  })

  it('has no arrow after the last device, and one fewer arrow than devices', () => {
    const html = render([sm7b, scarlett, hs5])

    expect((html.match(/>→<\/span>/g) ?? []).length).toBe(2)
  })

  it('still lays out a long chain (the strip wraps rather than overflowing)', () => {
    const long = Array.from({ length: 15 }, (_, i) => [sm7b, scarlett, hs5][i % 3])
    const html = render(long)

    expect(icons(html)).toHaveLength(30)
    expect(html).toContain('flex-wrap:wrap')
  })
})

describe('page-break markers', () => {
  it('marks every section and every row after the first, so a page never cuts through a line', () => {
    const devices = [sm7b, scarlett, hs5]
    const connections = evaluateChain(devices)
    const cables = buildCableList(devices)
    const shopping = buildShoppingList(devices)

    const html = render(devices)
    const markers = (html.match(/data-pdf-break/g) ?? []).length

    const sections = 5 // at a glance, chain, report, cables, shopping
    const expected =
      sections +
      (devices.length - 1) +
      (connections.length - 1) +
      (cables.lines.length - 1) +
      (shopping.lines.length - 1)
    // No marker on the total row: see the next test.
    expect(markers).toBe(expected)
  })

  it('never lets a page cut between the last item and the total, so the total is not stranded', () => {
    const html = render([sm7b, scarlett, hs5])
    const total = html.indexOf('Estimated total</span>')
    const lastItem = html.lastIndexOf('HS5</span>', total)

    // The total row itself carries no marker, and nothing between the last item and the
    // total does either; a cut can only fall before the last item, taking the total with it.
    expect(html.slice(html.lastIndexOf('<div', total), total)).not.toContain('data-pdf-break')
    expect(html.slice(lastItem, total)).not.toContain('data-pdf-break')
  })

  it('does allow a cut before the last item, so a long list can still split', () => {
    const html = render([sm7b, scarlett, hs5])
    const hs5Row = html.lastIndexOf('<div', html.lastIndexOf('HS5</span>', html.indexOf('Estimated total</span>')))

    expect(html.slice(hs5Row, hs5Row + 60)).toContain('data-pdf-break')
  })

  it('does not put a break between the total and the disclaimer under it', () => {
    const html = render([sm7b, scarlett])
    const afterTotal = html.slice(html.indexOf('Estimated total</span>'))
    const disclaimerAt = afterTotal.indexOf('Prices are approximate')

    expect(afterTotal.slice(0, disclaimerAt)).not.toContain('data-pdf-break')
  })

  it('still produces a complete document for a long chain', () => {
    const long = [sm7b, scarlett, hs5, sm7b, scarlett, hs5, sm7b, scarlett, hs5, sm7b, scarlett, hs5]
    const text = textOf(render(long))

    expect(text).toContain('12 devices')
    expect(text).toContain('4× SM7B')
    expect(text).toContain('Created with the soundorp')
  })
})
