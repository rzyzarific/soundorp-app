import type { Connector, Device } from '../data/devices.schema'
import { findConnectorLink } from '../engine/rules/connectorMatch'

export interface CableLine {
  kind: 'cable' | 'adapter'
  label: string
  quantity: number
  // Human-readable "A → B" for every connection this line covers.
  connections: string[]
}

export interface CableListResult {
  lines: CableLine[]
  // Connections we couldn't resolve because a device has no connector data.
  skipped: string[]
  // Connections from a device with no line-level output into analog gear.
  noLineOutput: string[]
}

const CABLE_LABELS: Record<Connector, string> = {
  XLR: 'XLR cable',
  TRS: 'TRS cable',
  TS: 'TS (instrument) cable',
  'USB-A': 'USB-A cable',
  'USB-C': 'USB-C cable',
  Thunderbolt: 'Thunderbolt cable',
  RCA: 'RCA cable',
  '3.5mm': '3.5mm cable',
  SPDIF: 'S/PDIF cable',
  ADAT: 'ADAT (optical) cable',
}

/**
 * Derives the cables (and, where connectors don't overlap, adapters) a chain needs,
 * one per adjacent pair, consolidated into counted lines in first-seen order with
 * cables listed before adapters. Mirrors the compatibility report's connector logic.
 */
export function buildCableList(devices: Device[]): CableListResult {
  const byKey = new Map<string, CableLine>()
  const skipped: string[] = []
  const noLineOutput: string[] = []

  for (let i = 0; i < devices.length - 1; i++) {
    const upstream = devices[i]
    const downstream = devices[i + 1]
    const connection = `${upstream.name} → ${downstream.name}`
    const link = findConnectorLink(upstream, downstream)

    if (link.status === 'unknown') {
      skipped.push(connection)
      continue
    }

    // No cable or adapter exists for this; the report explains what to do instead.
    if (link.status === 'no_line_output') {
      noLineOutput.push(connection)
      continue
    }

    const kind = link.status === 'match' ? 'cable' : 'adapter'
    const label =
      link.status === 'match'
        ? CABLE_LABELS[link.connector]
        : `${link.outputs.join('/')} → ${link.inputs.join('/')} adapter`

    const key = `${kind}:${label}`
    const existing = byKey.get(key)
    if (existing) {
      existing.quantity += 1
      existing.connections.push(connection)
    } else {
      byKey.set(key, { kind, label, quantity: 1, connections: [connection] })
    }
  }

  const lines = [...byKey.values()]
  return {
    lines: [...lines.filter((l) => l.kind === 'cable'), ...lines.filter((l) => l.kind === 'adapter')],
    skipped,
    noLineOutput,
  }
}
