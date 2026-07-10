import type { Device } from '../data/devices.schema'
import type { ConnectionCheckResult } from './types'
import { rules } from './rules'

export function evaluateChain(devices: Device[]): ConnectionCheckResult[] {
  const connections: ConnectionCheckResult[] = []

  for (let i = 0; i < devices.length - 1; i++) {
    const upstream = devices[i]
    const downstream = devices[i + 1]

    const results = rules
      .map((rule) => rule(upstream, downstream))
      .filter((r) => r !== null)

    connections.push({
      connectionIndex: i,
      upstreamId: upstream.id,
      downstreamId: downstream.id,
      results,
    })
  }

  return connections
}
