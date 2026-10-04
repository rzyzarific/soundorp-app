import { describe, expect, it } from 'vitest'
import { buildBuilderUrl, buildPublicChainUrl, publicChainPath, readPublicChainRoute } from './publicLink'
import { decodeShareParam, encodeChainToShareParam } from './share'
import { scrubAnalyticsUrl } from './analytics'
import { ALL_DEVICES } from '../data/devices'

const ids = ALL_DEVICES.slice(0, 6).map((d) => d.id)

describe('building links', () => {
  it('puts the encoded chain under /c/', () => {
    expect(publicChainPath('abc')).toBe('/c/abc')
    expect(buildPublicChainUrl('https://soundorp.com', 'abc')).toBe('https://soundorp.com/c/abc')
  })

  it('builds the builder link the existing ?chain= flow understands', () => {
    expect(buildBuilderUrl('abc')).toBe('/?chain=abc')
  })
})

describe('readPublicChainRoute', () => {
  it('is not a public route for the builder and anything else', () => {
    for (const path of ['/', '/index.html', '/c', '/c/', '/cc/abc', '/x/c/abc', '/c/abc/def', '/C/abc', '/assets/c/abc']) {
      expect(readPublicChainRoute(path), path).toBeNull()
    }
  })

  it('returns the payload for /c/<payload>', () => {
    expect(readPublicChainRoute('/c/abc')).toEqual({ encoded: 'abc' })
  })

  it('accepts one trailing slash', () => {
    expect(readPublicChainRoute('/c/abc/')).toEqual({ encoded: 'abc' })
  })

  it('percent-decodes the segment, as chat apps sometimes encode $ and +', () => {
    expect(readPublicChainRoute('/c/a%24b%2Bc')).toEqual({ encoded: 'a$b+c' })
  })

  it('flags a /c/ route whose segment cannot be decoded, rather than falling back to the builder', () => {
    expect(readPublicChainRoute('/c/%E0%A4%A')).toEqual({ encoded: null })
    expect(readPublicChainRoute('/c/%')).toEqual({ encoded: null })
  })

  it('ignores a query string or hash if a caller passes a full path-like value', () => {
    // pathname never includes them; a stray "?" simply stays part of the segment and fails to decode as a chain.
    expect(readPublicChainRoute('/c/abc?x=1')).toEqual({ encoded: 'abc?x=1' })
  })
})

describe('a real chain through the whole link round trip', () => {
  it('survives the browser URL parser, including the + and $ characters lz-string can emit', () => {
    // Try many chains so the encoder emits every character of its alphabet.
    const seen = new Set<string>()
    for (let n = 1; n <= 40; n++) {
      const deviceIds = ALL_DEVICES.slice(n, n + 8).map((d) => d.id)
      const encoded = encodeChainToShareParam({ name: `Chain ${n} $+-`, deviceIds })
      for (const c of encoded) seen.add(c)

      const url = new URL(buildPublicChainUrl('https://soundorp.com', encoded))
      const route = readPublicChainRoute(url.pathname)

      expect(route, encoded).toEqual({ encoded })
      expect(decodeShareParam(route!.encoded!)?.deviceIds).toEqual(deviceIds)
    }
    expect(seen.has('+') || seen.has('$') || seen.has('-')).toBe(true) // the awkward characters were exercised
  })

  it('also survives being percent-encoded in transit', () => {
    const encoded = encodeChainToShareParam({ name: 'Podcast $+ rig', deviceIds: ids })

    const route = readPublicChainRoute(`/c/${encodeURIComponent(encoded)}`)

    expect(decodeShareParam(route!.encoded!)?.name).toBe('Podcast $+ rig')
  })

  it('decodes the same chain from the public link and the builder link', () => {
    const encoded = encodeChainToShareParam({ name: 'Same', deviceIds: ids })

    const fromPublic = decodeShareParam(readPublicChainRoute(publicChainPath(encoded))!.encoded!)
    const fromBuilder = decodeShareParam(new URL(buildBuilderUrl(encoded), 'https://x.test').searchParams.get('chain')!)

    expect(fromPublic).toEqual(fromBuilder)
  })
})

describe('scrubAnalyticsUrl', () => {
  it('collapses a public chain URL to one path', () => {
    expect(scrubAnalyticsUrl('https://soundorp.com/c/N4IgbiBc+BM$A-x')).toBe('https://soundorp.com/c/:chain')
  })

  it('keeps any query or hash that follows', () => {
    expect(scrubAnalyticsUrl('https://soundorp.com/c/abc?utm=1#top')).toBe('https://soundorp.com/c/:chain?utm=1#top')
  })

  it('scrubs a ?chain= value too', () => {
    expect(scrubAnalyticsUrl('https://soundorp.com/?chain=N4Igbi')).toBe('https://soundorp.com/?chain=:chain')
    expect(scrubAnalyticsUrl('https://soundorp.com/?a=1&chain=N4Igbi&b=2')).toBe('https://soundorp.com/?a=1&chain=:chain&b=2')
  })

  it('leaves ordinary URLs alone', () => {
    expect(scrubAnalyticsUrl('https://soundorp.com/')).toBe('https://soundorp.com/')
    expect(scrubAnalyticsUrl('https://soundorp.com/about')).toBe('https://soundorp.com/about')
    expect(scrubAnalyticsUrl('https://soundorp.com/cables')).toBe('https://soundorp.com/cables')
  })

  it('never leaves chain contents behind', () => {
    const encoded = encodeChainToShareParam({ name: 'Secret studio plan', deviceIds: ids })

    expect(scrubAnalyticsUrl(`https://soundorp.com/c/${encoded}`)).not.toContain(encoded)
    expect(scrubAnalyticsUrl(`https://soundorp.com/?chain=${encoded}`)).not.toContain(encoded)
  })
})
