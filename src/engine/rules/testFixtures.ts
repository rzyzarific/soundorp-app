import type { Device } from '../../data/devices.schema'

export function device(overrides: Partial<Device>): Device {
  return {
    id: 'test',
    name: 'Test Device',
    brand: 'Test',
    category: 'microphone',
    specs: {},
    ...overrides,
  }
}
