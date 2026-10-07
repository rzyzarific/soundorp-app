export type DeviceCategory =
  | 'microphone'
  | 'preamp'
  | 'audio_interface'
  | 'mixer'
  | 'monitor'
  | 'headphones'
  | 'daw'

export type Connector =
  | 'XLR'
  | 'TRS'
  | 'TS'
  | 'USB-A'
  | 'USB-C'
  | 'Thunderbolt'
  | 'RCA'
  | '3.5mm'
  | 'SPDIF'
  | 'ADAT'

/**
 * How far a device's specs can be trusted. A device with no `verification` has not been checked
 * against a source at all.
 *  - verified:    read from a manufacturer page, or two independent retailer pages that agree.
 *  - inferred:    not stated by any source that was read; filled in from a sibling or a pattern.
 *  - in_question: could not be confirmed (no source, one source, or sources that disagree with the
 *                 value). The value is kept as it is, but should not be relied on.
 */
export type VerificationStatus = 'verified' | 'inferred' | 'in_question'

export interface Verification {
  status: VerificationStatus
  // The specs this is about (keys of `specs`, e.g. 'minPreampGain'). Omitted: the device as a whole.
  fields?: string[]
  // Where it was checked. Required for 'verified' and 'inferred'; optional for 'in_question'.
  source?: string
  // Required for 'in_question' and 'inferred': what is uncertain, and why.
  note?: string
  // When it was last looked at, as YYYY-MM-DD.
  checkedOn: string
}

export const VERIFICATION_STATUSES: VerificationStatus[] = ['verified', 'inferred', 'in_question']

export interface Device {
  id: string
  name: string
  brand: string
  category: DeviceCategory
  subtype?: string
  msrp?: number
  // Set on devices a user created themselves (never on catalog rows).
  isCustom?: boolean
  reviewUrl?: string
  // Set by hand in the catalog only; never on custom devices, which are rebuilt from form input.
  verification?: Verification
  affiliateLinks?: {
    amazon?: string
    sweetwater?: string
    bhphoto?: string
  }
  specs: {
    // Everything this device can send to the next one: digital host links (USB,
    // Thunderbolt) and analog line/monitor outs alike. Mixed on purpose, as mixers do.
    outputConnectors?: Connector[]
    // The headphone jack(s), kept apart so a ¼" headphone jack never counts as a line
    // output into monitors. Used when the next device is headphones.
    headphoneOutputConnectors?: Connector[]
    inputConnectors?: Connector[]

    needsPhantomPower?: boolean
    phantomPowerDamages?: boolean
    minPreampGain?: number
    outputImpedance?: number

    providesPhantomPower?: boolean
    maxPreampGain?: number
    inputImpedance?: number
    micPreampCount?: number

    // In-line gain boosters (Cloudlifter, FetHead, DM1): clean dB added between a
    // low-output mic and the next device's preamp.
    gainBoost?: number
  }
}

export interface SignalChain {
  id: string
  name: string
  deviceIds: string[]
  // Snapshot of the custom devices this chain uses, so a saved or shared chain is
  // self-contained and still renders where those devices were never created.
  customDevices?: Device[]
  createdAt: number
  updatedAt: number
}

export const DEVICE_CATEGORIES: DeviceCategory[] = [
  'microphone',
  'preamp',
  'audio_interface',
  'mixer',
  'monitor',
  'headphones',
  'daw',
]

export const CONNECTORS: Connector[] = [
  'XLR',
  'TRS',
  'TS',
  'USB-A',
  'USB-C',
  'Thunderbolt',
  'RCA',
  '3.5mm',
  'SPDIF',
  'ADAT',
]

function isConnectorArray(x: unknown): x is Connector[] {
  return Array.isArray(x) && x.every((c) => CONNECTORS.includes(c as Connector))
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const isNonEmptyString = (x: unknown): x is string => typeof x === 'string' && x.trim().length > 0

/** A verification entry must say what it covers and when, and (by status) where or why. */
export function isValidVerification(x: unknown): x is Verification {
  if (typeof x !== 'object' || x === null) return false
  const v = x as Record<string, unknown>
  if (typeof v.status !== 'string' || !VERIFICATION_STATUSES.includes(v.status as VerificationStatus))
    return false
  if (typeof v.checkedOn !== 'string' || !ISO_DATE.test(v.checkedOn)) return false
  if (v.fields !== undefined && !(Array.isArray(v.fields) && v.fields.length > 0 && v.fields.every(isNonEmptyString)))
    return false
  if (v.source !== undefined && !isNonEmptyString(v.source)) return false
  if (v.note !== undefined && !isNonEmptyString(v.note)) return false
  if ((v.status === 'verified' || v.status === 'inferred') && !isNonEmptyString(v.source)) return false
  if ((v.status === 'in_question' || v.status === 'inferred') && !isNonEmptyString(v.note)) return false
  return true
}

/**
 * Runtime validator for hand-curated devices.json rows. TS types only catch
 * authoring mistakes at build time; this catches them when the data file
 * changes, via devices.test.ts, before a bad row silently breaks the engine.
 */
export function isValidDevice(x: unknown): x is Device {
  if (typeof x !== 'object' || x === null) return false
  const d = x as Record<string, unknown>

  if (typeof d.id !== 'string' || d.id.length === 0) return false
  if (typeof d.name !== 'string' || d.name.length === 0) return false
  if (typeof d.brand !== 'string' || d.brand.length === 0) return false
  if (typeof d.category !== 'string' || !DEVICE_CATEGORIES.includes(d.category as DeviceCategory))
    return false
  if (d.subtype !== undefined && typeof d.subtype !== 'string') return false
  if (d.msrp !== undefined && typeof d.msrp !== 'number') return false
  if (d.isCustom !== undefined && typeof d.isCustom !== 'boolean') return false
  if (d.reviewUrl !== undefined && typeof d.reviewUrl !== 'string') return false
  if (d.verification !== undefined && !isValidVerification(d.verification)) return false

  if (typeof d.specs !== 'object' || d.specs === null) return false
  const s = d.specs as Record<string, unknown>

  if (s.outputConnectors !== undefined && !isConnectorArray(s.outputConnectors)) return false
  if (s.headphoneOutputConnectors !== undefined && !isConnectorArray(s.headphoneOutputConnectors))
    return false
  if (s.inputConnectors !== undefined && !isConnectorArray(s.inputConnectors)) return false
  if (s.needsPhantomPower !== undefined && typeof s.needsPhantomPower !== 'boolean') return false
  if (s.phantomPowerDamages !== undefined && typeof s.phantomPowerDamages !== 'boolean')
    return false
  if (s.minPreampGain !== undefined && typeof s.minPreampGain !== 'number') return false
  if (s.outputImpedance !== undefined && typeof s.outputImpedance !== 'number') return false
  if (s.providesPhantomPower !== undefined && typeof s.providesPhantomPower !== 'boolean')
    return false
  if (s.maxPreampGain !== undefined && typeof s.maxPreampGain !== 'number') return false
  if (s.inputImpedance !== undefined && typeof s.inputImpedance !== 'number') return false
  if (s.micPreampCount !== undefined && typeof s.micPreampCount !== 'number') return false
  if (s.gainBoost !== undefined && typeof s.gainBoost !== 'number') return false

  return true
}
