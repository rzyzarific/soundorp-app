import { describe, expect, it } from 'vitest'
import config from '../vercel.json'

// vercel.json is the only place the host's behaviour is configured, and a typo there fails
// silently in production (the header just doesn't appear), so pin down what it must say.

describe('vercel.json', () => {
  it('keeps the catch-all rewrite that serves the app for every path, including /c/<chain>', () => {
    expect(config.rewrites).toEqual([{ source: '/(.*)', destination: '/index.html' }])
  })

  it('asks search engines not to index public chain pages, with a real response header', () => {
    const rule = config.headers.find((h) => h.source === '/c/(.*)')

    expect(rule, 'no header rule for /c/*').toBeDefined()
    const tag = rule!.headers.find((h) => h.key.toLowerCase() === 'x-robots-tag')
    expect(tag?.value).toBe('noindex, nofollow')
  })

  it('applies the header to /c/ pages only, not to the builder or the assets', () => {
    const sources = config.headers.map((h) => h.source)

    expect(sources).toEqual(['/c/(.*)'])
    for (const source of sources) {
      const matches = (path: string) => new RegExp(`^${source}$`).test(path)
      expect(matches('/')).toBe(false)
      expect(matches('/assets/index-abc.js')).toBe(false)
      expect(matches('/?chain=abc')).toBe(false)
      expect(matches('/c/N4IgbiBc+BM$A-x')).toBe(true)
    }
  })

  it('has no other header rules that could add anything unexpected', () => {
    for (const rule of config.headers) {
      expect(rule.headers.map((h) => h.key)).toEqual(['X-Robots-Tag'])
    }
  })
})

describe('robots.txt', () => {
  // There is none today, which is fine. If one is ever added it must not block /c/, because a
  // crawler has to fetch a page to see its noindex; blocking it would hide the very instruction.
  const files = import.meta.glob('../public/robots.txt', { query: '?raw', import: 'default', eager: true })
  const text = Object.values(files)[0] as string | undefined

  it('does not block /c/ (or the whole site) from crawlers', () => {
    if (text === undefined) return

    const lines = text.split(/\r?\n/).map((l) => l.trim().toLowerCase())
    expect(lines.some((l) => /^disallow:\s*\/c(\/|$)/.test(l))).toBe(false)
    expect(lines.some((l) => /^disallow:\s*\/\s*$/.test(l))).toBe(false)
  })
})
