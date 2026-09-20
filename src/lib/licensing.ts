export const CHECKOUT_URL =
  'https://soundorp.lemonsqueezy.com/checkout/buy/91105e7c-48a6-46fd-bb15-27349b154581'

// Lemon Squeezy's License API (activate/validate/deactivate) is public — it
// authenticates with the license key itself, so no API key ships to the browser.
const ACTIVATE_URL = 'https://api.lemonsqueezy.com/v1/licenses/activate'

export interface StoredLicense {
  licenseKey: string
  instanceId: string
}

export type ActivationResult = { ok: true; license: StoredLicense } | { ok: false; error: string }

interface ActivateResponse {
  activated?: boolean
  error?: string | null
  license_key?: { status?: string; expires_at?: string | null }
  instance?: { id?: string }
  meta?: { store_id?: number; product_id?: number }
}

const MSG = {
  empty: 'Enter your license key first.',
  invalid: "That license key wasn't recognised. Check it for typos, or copy it again from your purchase email.",
  limit:
    'This license key has already been used on the maximum number of browsers. Contact info@soundorp.com if you need it reset.',
  expired: 'This license key has expired.',
  disabled: 'This license key has been disabled (for example after a refund). Contact info@soundorp.com if you think this is a mistake.',
  wrongProduct: "That license key isn't for the Signal Chain Builder.",
  network: "Couldn't reach the license server. Check your connection and try again.",
  unknown: "Couldn't activate that license key. Please try again, or contact info@soundorp.com.",
}

function optionalEnvNumber(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function messageForApiError(apiError: string | null | undefined): string {
  const e = (apiError ?? '').toLowerCase()
  if (e.includes('not found')) return MSG.invalid
  if (e.includes('activation limit')) return MSG.limit
  if (e.includes('expired')) return MSG.expired
  if (e.includes('disabled')) return MSG.disabled
  return MSG.unknown
}

function messageForLicenseStatus(status: string | undefined, expiresAt: string | null | undefined) {
  if (status === 'expired') return MSG.expired
  if (status === 'disabled') return MSG.disabled
  if (expiresAt && new Date(expiresAt).getTime() < Date.now()) return MSG.expired
  return null
}

export async function activateLicenseKey(rawKey: string): Promise<ActivationResult> {
  const licenseKey = rawKey.trim()
  if (licenseKey === '') return { ok: false, error: MSG.empty }

  let data: ActivateResponse
  try {
    const res = await fetch(ACTIVATE_URL, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      // URLSearchParams sends application/x-www-form-urlencoded, which keeps this a
      // CORS "simple" request (no preflight).
      body: new URLSearchParams({
        license_key: licenseKey,
        instance_name: `soundorp-web-${crypto.randomUUID().slice(0, 8)}`,
      }),
    })
    // Lemon Squeezy returns a JSON body on 4xx too (404 unknown key, 400 limit reached).
    data = (await res.json()) as ActivateResponse
  } catch {
    return { ok: false, error: MSG.network }
  }

  if (!data.activated) return { ok: false, error: messageForApiError(data.error) }

  const statusError = messageForLicenseStatus(data.license_key?.status, data.license_key?.expires_at)
  if (statusError) return { ok: false, error: statusError }

  // A key from any other Lemon Squeezy store/product would otherwise unlock Pro.
  const expectedStore = optionalEnvNumber(import.meta.env.VITE_LEMONSQUEEZY_STORE_ID)
  const expectedProduct = optionalEnvNumber(import.meta.env.VITE_LEMONSQUEEZY_PRODUCT_ID)
  if (expectedStore !== null && data.meta?.store_id !== expectedStore)
    return { ok: false, error: MSG.wrongProduct }
  if (expectedProduct !== null && data.meta?.product_id !== expectedProduct)
    return { ok: false, error: MSG.wrongProduct }

  if (!data.instance?.id) return { ok: false, error: MSG.unknown }

  return { ok: true, license: { licenseKey, instanceId: data.instance.id } }
}
