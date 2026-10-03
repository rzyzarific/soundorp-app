import type { Connector, Device } from '../../data/devices.schema'
import type { CheckResult } from '../types'

export type ConnectorLink =
  | { status: 'match'; connector: Connector }
  | { status: 'mismatch'; outputs: Connector[]; inputs: Connector[] }
  // The device has headphone jacks but nothing line-level to feed analog gear with.
  | { status: 'no_line_output' }
  | { status: 'unknown' }

const ANALOG_CONNECTORS: Connector[] = ['XLR', 'TRS', 'TS', 'RCA', '3.5mm']

const isAnalog = (c: Connector) => ANALOG_CONNECTORS.includes(c)

// Headphone-only devices (e.g. the PodTrak P4) list a headphone jack but no analog outputs.
function hasNoLineOutput(device: Device): boolean {
  const jacks = device.specs.headphoneOutputConnectors
  return (
    jacks !== undefined && jacks.length > 0 && !(device.specs.outputConnectors ?? []).some(isAnalog)
  )
}

// A device that mixes a USB host link with analog outs (every interface and mixer) shouldn't
// have the USB link blamed when the next device takes analog audio: "RCA → TRS adapter"
// reads right, "USB-A/RCA → TRS adapter" doesn't.
function relevantOutputs(outputs: Connector[], inputs: Connector[]): Connector[] {
  if (!inputs.every(isAnalog)) return outputs
  const analog = outputs.filter(isAnalog)
  return analog.length > 0 ? analog : outputs
}

/**
 * How two adjacent devices physically connect. Shared by the compatibility rule
 * and the cable list so the two can never disagree. 'unknown' means either side
 * omits its connector list (irrelevant for that device), so there's nothing to say.
 */
export function findConnectorLink(upstream: Device, downstream: Device): ConnectorLink {
  // Headphones plug into the upstream device's headphone jack, not its line outs.
  const headphoneJacks = upstream.specs.headphoneOutputConnectors
  const usingHeadphoneJack =
    downstream.category === 'headphones' && headphoneJacks !== undefined && headphoneJacks.length > 0
  const outputs = usingHeadphoneJack ? headphoneJacks : upstream.specs.outputConnectors
  const inputs = downstream.specs.inputConnectors
  if (!outputs || outputs.length === 0 || !inputs || inputs.length === 0)
    return { status: 'unknown' }

  const connector = outputs.find((c) => inputs.includes(c))
  if (connector === undefined) {
    // Suggesting an adapter would be wrong here: there is no line output to adapt.
    if (!usingHeadphoneJack && hasNoLineOutput(upstream) && inputs.every(isAnalog))
      return { status: 'no_line_output' }
    return { status: 'mismatch', outputs: relevantOutputs(outputs, inputs), inputs }
  }

  return { status: 'match', connector }
}

/**
 * Flags when nothing in the upstream device's outputs overlaps with the
 * downstream device's inputs. If either side omits its connector list
 * (irrelevant for that device), there's nothing to check.
 */
export function checkConnectorMatch(upstream: Device, downstream: Device): CheckResult | null {
  const link = findConnectorLink(upstream, downstream)
  if (link.status === 'unknown') return null

  if (link.status === 'no_line_output') {
    return {
      severity: 'warning',
      title: 'No line-level output',
      detail: `${upstream.name} has no line-level output, so it can't send audio to ${downstream.name} directly.`,
      fix: 'Use its headphone jack instead.',
    }
  }

  if (link.status === 'mismatch') {
    const { outputs, inputs } = link
    return {
      severity: 'warning',
      title: 'No matching connector',
      detail: `${upstream.name} outputs ${outputs.join('/')}, but ${downstream.name} only accepts ${inputs.join('/')} on this input.`,
      fix: `You'll need a cable or adapter that converts ${outputs.join('/')} to ${inputs.join('/')}.`,
    }
  }

  return {
    severity: 'pass',
    title: 'Connectors match',
    detail: `${upstream.name} connects to ${downstream.name} via ${link.connector}.`,
  }
}
