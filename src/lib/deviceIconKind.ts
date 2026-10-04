import type { Device } from '../data/devices.schema'

export type DeviceIconKind =
  | 'mic_dynamic'
  | 'mic_condenser'
  | 'mic_ribbon'
  | 'booster'
  | 'preamp'
  | 'interface'
  | 'mixer'
  | 'monitor'
  | 'headphones'
  | 'daw'

/**
 * Which drawing a device gets. Catalog devices use their category and subtype; custom
 * devices have no subtype, so their specs decide: a mic that phantom power can damage is a
 * ribbon, one that needs phantom power is a condenser, and any other is drawn as dynamic.
 */
export function deviceIconKind(device: Device): DeviceIconKind {
  switch (device.category) {
    case 'microphone':
      // A stated type is authoritative: a dynamic mic with a built-in preamp (the SM7dB)
      // needs phantom power but is still a dynamic mic.
      if (device.subtype === 'ribbon') return 'mic_ribbon'
      if (device.subtype === 'condenser') return 'mic_condenser'
      if (device.subtype === 'dynamic') return 'mic_dynamic'
      if (device.specs.phantomPowerDamages === true) return 'mic_ribbon'
      if (device.specs.needsPhantomPower === true) return 'mic_condenser'
      return 'mic_dynamic'
    case 'preamp':
      return device.specs.gainBoost !== undefined ? 'booster' : 'preamp'
    case 'audio_interface':
      return 'interface'
    case 'mixer':
      return 'mixer'
    case 'monitor':
      return 'monitor'
    case 'headphones':
      return 'headphones'
    case 'daw':
      return 'daw'
  }
}
