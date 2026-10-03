import type { Device } from '../data/devices.schema'
import type { ConnectionCheckResult } from './types'
import { rules } from './rules'

/**
 * Runs every rule over each adjacent pair, with no fix suggestions attached.
 * Fix suggestions are built on top of this (fixes.ts) by simulating candidate
 * chains, so this has to stay free of them.
 */
export function evaluatePairs(devices: Device[]): ConnectionCheckResult[] {
  const connections: ConnectionCheckResult[] = []

  for (let i = 0; i < devices.length - 1; i++) {
    const upstream = devices[i]
    const downstream = devices[i + 1]
    const context = { devices, upstreamIndex: i }

    const results = rules
      .map((rule) => rule(upstream, downstream, context))
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
