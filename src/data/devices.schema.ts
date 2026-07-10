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

export interface Device {
  id: string
  name: string
  brand: string
  category: DeviceCategory
  subtype?: string
  msrp?: number
  reviewUrl?: string
  affiliateLinks?: {
    amazon?: string
    sweetwater?: string
    bhphoto?: string
  }
  specs: {
    outputConnectors?: Connector[]
    inputConnectors?: Connector[]

    needsPhantomPower?: boolean
    phantomPowerDamages?: boolean
    minPreampGain?: number
    outputImpedance?: number

    providesPhantomPower?: boolean
    maxPreampGain?: number
    inputImpedance?: number
    micPreampCount?: number
  }
}

export interface SignalChain {
  id: string
  name: string
  deviceIds: string[]
  createdAt: number
  updatedAt: number
}

const DEVICE_CATEGORIES: DeviceCategory[] = [
  'microphone',
  'preamp',
  'audio_interface',
  'mixer',
  'monitor',
  'headphones',
  'daw',
]

const CONNECTORS: Connector[] = [
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
  if (d.reviewUrl !== undefined && typeof d.reviewUrl !== 'string') return false

  if (typeof d.specs !== 'object' || d.specs === null) return false
  const s = d.specs as Record<string, unknown>

  if (s.outputConnectors !== undefined && !isConnectorArray(s.outputConnectors)) return false
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

  return true
}
