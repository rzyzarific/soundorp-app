import { describe, expect, it } from 'vitest'
import { encodeChainToShareParam, decodeShareParam } from './share'
import { ALL_DEVICES } from '../data/devices'

const TEN_DEVICE_IDS = ALL_DEVICES.slice(0, 10).map((d) => d.id)

describe('encodeChainToShareParam', () => {
  it('keeps a realistic 10-device chain well under the ~2000 char URL-safe limit', () => {
    const encoded = encodeChainToShareParam({ name: 'My home studio chain', deviceIds: TEN_DEVICE_IDS })

    expect(encoded.length).toBeLessThan(500)
  })
})

describe('encode -> decode round trip', () => {
  it('reconstructs the original name and deviceIds', () => {
    const original = { name: 'Podcast setup', deviceIds: TEN_DEVICE_IDS }
    const encoded = encodeChainToShareParam(original)

    const decoded = decodeShareParam(encoded)

    expect(decoded).not.toBeNull()
    expect(decoded?.name).toBe(original.name)
    expect(decoded?.deviceIds).toEqual(original.deviceIds)
    expect(decoded?.droppedCount).toBe(0)
  })

  it('filters out deviceIds no longer present in the catalog', () => {
    const encoded = encodeChainToShareParam({
      name: 'Chain with a removed device',
      deviceIds: [TEN_DEVICE_IDS[0], 'no-longer-exists', TEN_DEVICE_IDS[1]],
    })

    const decoded = decodeShareParam(encoded)

    expect(decoded?.deviceIds).toEqual([TEN_DEVICE_IDS[0], TEN_DEVICE_IDS[1]])
    expect(decoded?.droppedCount).toBe(1)
  })

  it('returns null for garbage input', () => {
    expect(decodeShareParam('not-a-real-encoded-string')).toBeNull()
  })
})
