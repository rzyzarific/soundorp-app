import type { Device } from '../data/devices.schema'

export const CATEGORY_LABELS: Record<Device['category'], string> = {
  microphone: 'Microphone',
  preamp: 'Preamp',
  audio_interface: 'Audio Interface',
  mixer: 'Mixer',
  monitor: 'Monitor',
  headphones: 'Headphones',
  daw: 'DAW',
}
