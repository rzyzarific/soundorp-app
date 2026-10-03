import { ALL_DEVICES } from '../data/devices'
import type { Device } from '../data/devices.schema'
import { evaluatePairs } from './evaluatePairs'
import { worstSeverity, type FixAction } from './types'

/**
 * Inline gain boosters that would close a gain shortfall between devices[upstreamIndex]
 * and its downstream neighbour, cheapest first.
 *
 * Each catalog booster is tried in the actual chain and offered only if both of the
 * connections it creates come back fully clean. That drops boosters the next device
 * can't phantom-power, ones with the wrong connectors, or ones that still leave a
 * shortfall, so a suggested fix never trades one problem for another.
 */
export function suggestGainBoostActions(
  devices: Device[],
  upstreamIndex: number,
  catalog: Device[] = ALL_DEVICES,
): FixAction[] {
  const position = upstreamIndex + 1

  return catalog
    .filter((candidate) => candidate.specs.gainBoost !== undefined)
    .filter((booster) => {
      const trial = [...devices.slice(0, position), booster, ...devices.slice(position)]
      const connections = evaluatePairs(trial)
      return [connections[upstreamIndex], connections[upstreamIndex + 1]].every(
        (c) => worstSeverity(c.results) === 'pass',
      )
    })
    .sort(
      (a, b) =>
        (a.msrp ?? Infinity) - (b.msrp ?? Infinity) ||
        (b.specs.gainBoost ?? 0) - (a.specs.gainBoost ?? 0),
    )
    .map((booster) => ({
      type: 'insert_device' as const,
      deviceId: booster.id,
      position,
      label: boosterLabel(booster),
    }))
}

function boosterLabel(booster: Device): string {
  const details = [`+${booster.specs.gainBoost} dB`, booster.msrp !== undefined && `$${booster.msrp}`]
    .filter(Boolean)
    .join(', ')
  return `Add ${booster.brand} ${booster.name} (${details})`
}
