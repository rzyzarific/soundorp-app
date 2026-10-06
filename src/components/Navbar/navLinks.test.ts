import { describe, expect, it } from 'vitest'
import { BRAND_LINK, CURRENT_SECTION, LINK_REL, LINK_TARGET, NAV_LINKS } from './navLinks'

describe('navbar links', () => {
  it('sends the wordmark to the main site', () => {
    expect(BRAND_LINK.href).toBe('https://soundorp.com')
  })

  it('links Gear Guide, Blog and Contact to their exact soundorp.com pages', () => {
    expect(NAV_LINKS.map((l) => [l.label, l.href])).toEqual([
      ['Gear Guide', 'https://soundorp.com/equipments/'],
      ['Blog', 'https://soundorp.com/blog/'],
      ['Contact', 'https://soundorp.com/contact/'],
    ])
  })

  it('opens in a new tab, with noopener, and without stripping the referrer', () => {
    expect(LINK_TARGET).toBe('_blank')
    expect(LINK_REL.split(' ')).toContain('noopener')
    expect(LINK_REL.split(' ')).not.toContain('noreferrer')
  })

  it('names the current section, which is not among the links', () => {
    expect(CURRENT_SECTION).toBe('Signal Chain Builder')
    expect(NAV_LINKS.some((l) => l.label === CURRENT_SECTION)).toBe(false)
    expect(BRAND_LINK.label).not.toBe(CURRENT_SECTION)
  })

  it('only ever links to https soundorp.com', () => {
    for (const l of [BRAND_LINK, ...NAV_LINKS]) expect(new URL(l.href).origin).toBe('https://soundorp.com')
  })
})
