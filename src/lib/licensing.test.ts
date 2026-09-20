import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { activateLicenseKey } from './licensing'

function mockFetchJson(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue({ status, json: async () => body })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const successBody = {
  activated: true,
  error: null,
  license_key: { status: 'active', key: 'abc', expires_at: null },
  instance: { id: 'inst-123', name: 'x' },
  meta: { store_id: 111, product_id: 222 },
}

describe('activateLicenseKey', () => {
  beforeEach(() => {
    // Don't let a developer's .env.local product/store ids leak into these tests.
    vi.stubEnv('VITE_LEMONSQUEEZY_STORE_ID', '')
    vi.stubEnv('VITE_LEMONSQUEEZY_PRODUCT_ID', '')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('posts form-encoded key + instance_name with no Authorization header', async () => {
    const fetchMock = mockFetchJson(successBody)

    await activateLicenseKey('  my-key  ')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.lemonsqueezy.com/v1/licenses/activate')
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ Accept: 'application/json' })
    const body = init.body as URLSearchParams
    expect(body.get('license_key')).toBe('my-key')
    expect(body.get('instance_name')).toMatch(/^soundorp-web-/)
  })

  it('returns the key and instance id on success', async () => {
    mockFetchJson(successBody)
    expect(await activateLicenseKey('my-key')).toEqual({
      ok: true,
      license: { licenseKey: 'my-key', instanceId: 'inst-123' },
    })
  })

  it('rejects an empty key without calling the API', async () => {
    const fetchMock = mockFetchJson(successBody)
    const result = await activateLicenseKey('   ')
    expect(result.ok).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('maps an unknown key (real 404 body) to the invalid-key message', async () => {
    mockFetchJson({ activated: false, error: 'license_key not found.' }, 404)
    const result = await activateLicenseKey('nope')
    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/wasn't recognised/i) })
  })

  it('maps the activation-limit error to the already-used message', async () => {
    mockFetchJson({ activated: false, error: 'This license key has reached the activation limit.' }, 400)
    const result = await activateLicenseKey('used')
    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/already been used/i) })
  })

  it('rejects an expired license even when activation succeeded', async () => {
    mockFetchJson({ ...successBody, license_key: { status: 'expired', expires_at: null } })
    const result = await activateLicenseKey('old')
    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/expired/i) })
  })

  it('rejects a disabled license', async () => {
    mockFetchJson({ ...successBody, license_key: { status: 'disabled', expires_at: null } })
    const result = await activateLicenseKey('refunded')
    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/disabled/i) })
  })

  it('rejects a key whose expires_at is in the past', async () => {
    mockFetchJson({ ...successBody, license_key: { status: 'active', expires_at: '2020-01-01T00:00:00Z' } })
    const result = await activateLicenseKey('lapsed')
    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/expired/i) })
  })

  it('reports a network failure clearly', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const result = await activateLicenseKey('any')
    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/reach the license server/i) })
  })

  it('rejects a key from a different product when product/store ids are configured', async () => {
    vi.stubEnv('VITE_LEMONSQUEEZY_STORE_ID', '111')
    vi.stubEnv('VITE_LEMONSQUEEZY_PRODUCT_ID', '999')
    mockFetchJson(successBody)
    const result = await activateLicenseKey('other-product')
    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/isn't for the Signal Chain Builder/i) })
  })

  it('accepts a key when configured store/product ids match', async () => {
    vi.stubEnv('VITE_LEMONSQUEEZY_STORE_ID', '111')
    vi.stubEnv('VITE_LEMONSQUEEZY_PRODUCT_ID', '222')
    mockFetchJson(successBody)
    expect((await activateLicenseKey('ok')).ok).toBe(true)
  })
})
