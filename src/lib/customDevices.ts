import {
  CONNECTORS,
  DEVICE_CATEGORIES,
  isValidDevice,
  type Connector,
  type Device,
  type DeviceCategory,
} from '../data/devices.schema'
import { getDeviceById } from '../data/devices'

export const CUSTOM_ID_PREFIX = 'custom-'

// Ids come from crypto.randomUUID(), but they also arrive from share links and
// localStorage, so anything else is rejected rather than trusted.
const CUSTOM_ID_PATTERN = /^custom-[A-Za-z0-9-]{1,64}$/

export const isCustomId = (id: string): boolean => id.startsWith(CUSTOM_ID_PREFIX)

export const MAX_NAME_LENGTH = 60
export const MAX_BRAND_LENGTH = 40
export const MAX_CUSTOM_DEVICES_PER_SHARE = 30

/** What the add/edit form collects. Numbers are optional; blank means "not specified". */
export interface CustomDeviceInput {
  brand: string
  name: string
  category: DeviceCategory
  msrp?: number
  inputConnectors: Connector[]
  outputConnectors: Connector[]
  headphoneOutputConnectors: Connector[]
  needsPhantomPower: boolean
  phantomPowerDamages: boolean
  providesPhantomPower: boolean
  minPreampGain?: number
  maxPreampGain?: number
  gainBoost?: number
}

export type CustomDeviceField =
  | 'brand'
  | 'name'
  | 'category'
  | 'msrp'
  | 'minPreampGain'
  | 'maxPreampGain'
  | 'gainBoost'

export type CustomDeviceBuild =
  | { ok: true; device: Device }
  | { ok: false; errors: Partial<Record<CustomDeviceField, string>> }

/** Which spec fields mean something for each category; the rest are dropped on build. */
export interface CategoryFields {
  inputs: boolean
  outputs: boolean
  headphones: boolean
  needsPhantom: boolean
  damagedByPhantom: boolean
  providesPhantom: boolean
  minGain: boolean
  maxGain: boolean
  boost: boolean
}

const NONE: CategoryFields = {
  inputs: false,
  outputs: false,
  headphones: false,
  needsPhantom: false,
  damagedByPhantom: false,
  providesPhantom: false,
  minGain: false,
  maxGain: false,
  boost: false,
}

export const CATEGORY_FIELDS: Record<DeviceCategory, CategoryFields> = {
  microphone: { ...NONE, outputs: true, needsPhantom: true, damagedByPhantom: true, minGain: true },
  // Preamps cover in-line boosters too, which need phantom power and add gain.
  preamp: {
    ...NONE,
    inputs: true,
    outputs: true,
    needsPhantom: true,
    providesPhantom: true,
    maxGain: true,
    boost: true,
  },
  audio_interface: {
    ...NONE,
    inputs: true,
    outputs: true,
    headphones: true,
    providesPhantom: true,
    maxGain: true,
  },
  mixer: {
    ...NONE,
    inputs: true,
    outputs: true,
    headphones: true,
    providesPhantom: true,
    maxGain: true,
  },
  monitor: { ...NONE, inputs: true },
  headphones: { ...NONE, inputs: true },
  daw: { ...NONE, inputs: true },
}

/** Sensible starting connectors when a category is chosen in the form. */
export const DEFAULT_CONNECTORS: Record<
  DeviceCategory,
  { inputs: Connector[]; outputs: Connector[]; headphones: Connector[] }
> = {
  microphone: { inputs: [], outputs: ['XLR'], headphones: [] },
  preamp: { inputs: ['XLR'], outputs: ['XLR'], headphones: [] },
  audio_interface: {
    inputs: ['XLR', 'TRS'],
    outputs: ['USB-C', 'TRS'],
    headphones: ['TRS'],
  },
  mixer: { inputs: ['XLR', 'TRS'], outputs: ['XLR', 'TRS'], headphones: ['TRS'] },
  monitor: { inputs: ['TRS', 'XLR'], outputs: [], headphones: [] },
  headphones: { inputs: ['3.5mm', 'TRS'], outputs: [], headphones: [] },
  daw: { inputs: ['USB-A', 'USB-C'], outputs: [], headphones: [] },
}

export function emptyCustomDeviceInput(category: DeviceCategory = 'microphone'): CustomDeviceInput {
  const defaults = DEFAULT_CONNECTORS[category]
  return {
    brand: '',
    name: '',
    category,
    inputConnectors: [...defaults.inputs],
    outputConnectors: [...defaults.outputs],
    headphoneOutputConnectors: [...defaults.headphones],
    needsPhantomPower: false,
    phantomPowerDamages: false,
    providesPhantomPower: false,
  }
}

const NUMBER_LIMITS = {
  msrp: { max: 100_000, message: 'Enter a price between $0 and $100,000.' },
  minPreampGain: { max: 100, message: 'Enter a number of dB between 0 and 100.' },
  maxPreampGain: { max: 120, message: 'Enter a number of dB between 0 and 120.' },
  gainBoost: { max: 80, message: 'Enter a number of dB between 0 and 80.' },
} as const

function cleanConnectors(list: unknown): Connector[] {
  if (!Array.isArray(list)) return []
  const valid = list.filter((c): c is Connector => CONNECTORS.includes(c as Connector))
  return [...new Set(valid)]
}

/**
 * Validates form input and builds the Device. Fields that don't apply to the chosen
 * category are dropped, so switching category never leaves stale specs behind.
 */
export function createCustomDevice(input: CustomDeviceInput, existingId?: string): CustomDeviceBuild {
  const errors: Partial<Record<CustomDeviceField, string>> = {}

  const name = typeof input.name === 'string' ? input.name.trim() : ''
  if (name === '') errors.name = 'Enter a name.'
  else if (name.length > MAX_NAME_LENGTH) errors.name = `Keep the name under ${MAX_NAME_LENGTH} characters.`

  const brand = typeof input.brand === 'string' ? input.brand.trim() : ''
  if (brand.length > MAX_BRAND_LENGTH) errors.brand = `Keep the brand under ${MAX_BRAND_LENGTH} characters.`

  if (!DEVICE_CATEGORIES.includes(input.category)) errors.category = 'Choose a category.'
  const fields = CATEGORY_FIELDS[input.category] ?? NONE

  const numbers: Partial<Record<keyof typeof NUMBER_LIMITS, number>> = {}
  const checkNumber = (key: keyof typeof NUMBER_LIMITS, applies: boolean) => {
    const value = input[key]
    if (!applies || value === undefined) return
    const { max, message } = NUMBER_LIMITS[key]
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max) {
      errors[key] = message
      return
    }
    numbers[key] = value
  }
  checkNumber('msrp', true)
  checkNumber('minPreampGain', fields.minGain)
  checkNumber('maxPreampGain', fields.maxGain)
  checkNumber('gainBoost', fields.boost)

  if (Object.keys(errors).length > 0) return { ok: false, errors }

  const inputs = cleanConnectors(input.inputConnectors)
  const outputs = cleanConnectors(input.outputConnectors)
  const headphones = cleanConnectors(input.headphoneOutputConnectors)

  const specs: Device['specs'] = {}
  if (fields.inputs && inputs.length > 0) specs.inputConnectors = inputs
  if (fields.outputs && outputs.length > 0) specs.outputConnectors = outputs
  if (fields.headphones && headphones.length > 0) specs.headphoneOutputConnectors = headphones
  if (fields.needsPhantom && input.needsPhantomPower === true) specs.needsPhantomPower = true
  if (fields.damagedByPhantom && input.phantomPowerDamages === true) specs.phantomPowerDamages = true
  if (fields.providesPhantom && input.providesPhantomPower === true) specs.providesPhantomPower = true
  if (numbers.minPreampGain !== undefined) specs.minPreampGain = numbers.minPreampGain
  if (numbers.maxPreampGain !== undefined) specs.maxPreampGain = numbers.maxPreampGain
  if (numbers.gainBoost !== undefined) specs.gainBoost = numbers.gainBoost

  const device: Device = {
    id: existingId ?? `${CUSTOM_ID_PREFIX}${crypto.randomUUID()}`,
    name,
    brand: brand === '' ? 'Custom' : brand,
    category: input.category,
    ...(numbers.msrp !== undefined && { msrp: numbers.msrp }),
    isCustom: true,
    specs,
  }
  return { ok: true, device }
}

/** The inverse of createCustomDevice, used to pre-fill the edit form. */
export function deviceToInput(device: Device): CustomDeviceInput {
  return {
    brand: device.brand === 'Custom' ? '' : device.brand,
    name: device.name,
    category: device.category,
    msrp: device.msrp,
    inputConnectors: [...(device.specs.inputConnectors ?? [])],
    outputConnectors: [...(device.specs.outputConnectors ?? [])],
    headphoneOutputConnectors: [...(device.specs.headphoneOutputConnectors ?? [])],
    needsPhantomPower: device.specs.needsPhantomPower === true,
    phantomPowerDamages: device.specs.phantomPowerDamages === true,
    providesPhantomPower: device.specs.providesPhantomPower === true,
    minPreampGain: device.specs.minPreampGain,
    maxPreampGain: device.specs.maxPreampGain,
    gainBoost: device.specs.gainBoost,
  }
}

/**
 * Rebuilds a custom device from untrusted data (localStorage, a share link) through the
 * same validation as the form. Returns null for anything that isn't a well-formed custom
 * device, and strips everything the form can't produce (URLs, unknown fields), so a link
 * can't smuggle in content or shadow a catalog device.
 */
export function normalizeCustomDevice(raw: unknown): Device | null {
  if (!isValidDevice(raw)) return null
  if (!CUSTOM_ID_PATTERN.test(raw.id)) return null
  const built = createCustomDevice(deviceToInput(raw), raw.id)
  return built.ok ? built.device : null
}

export function normalizeCustomDevices(raw: unknown, max = Infinity): Device[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: Device[] = []
  for (const item of raw.slice(0, max)) {
    const device = normalizeCustomDevice(item)
    if (device && !seen.has(device.id)) {
      seen.add(device.id)
      out.push(device)
    }
  }
  return out
}

/**
 * Looks each id up in the catalog, then the user's library, then the chain's own snapshot.
 * The library wins over the snapshot so edits to a device show up in chains that use it.
 */
export function resolveChainDevices(
  ids: string[],
  library: Device[],
  snapshot: Device[] = [],
): { devices: Device[]; missingIds: string[] } {
  const custom = new Map<string, Device>()
  for (const d of snapshot) custom.set(d.id, d)
  for (const d of library) custom.set(d.id, d)

  const devices: Device[] = []
  const missingIds: string[] = []
  for (const id of ids) {
    const device = getDeviceById(id) ?? custom.get(id)
    if (device) devices.push(device)
    else missingIds.push(id)
  }
  return { devices, missingIds }
}

/** The distinct custom devices a chain uses, in order of first appearance. */
export function customDevicesUsedBy(
  ids: string[],
  library: Device[],
  snapshot: Device[] = [],
): Device[] {
  const wanted = ids.filter(isCustomId)
  if (wanted.length === 0) return []
  const { devices } = resolveChainDevices(wanted, library, snapshot)
  const seen = new Set<string>()
  return devices.filter((d) => (seen.has(d.id) ? false : (seen.add(d.id), true)))
}
