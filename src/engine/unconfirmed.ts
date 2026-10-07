import type { Device } from '../data/devices.schema'

/**
 * Whether a spec is marked `in_question` in the catalog: it could not be confirmed against a
 * real source, so a rule that leans on it should say so instead of answering as if it were
 * known. Returns the catalog's note on why, or null when the spec is not in question.
 *
 * An entry with no `fields` is about the device as a whole, so it covers every spec.
 */
export function unconfirmedNote(device: Device, ...specs: string[]): string | null {
  const v = device.verification
  if (!v || v.status !== 'in_question') return null
  if (v.fields !== undefined && !specs.some((s) => v.fields!.includes(s))) return null
  return v.note ?? 'No reason was recorded.'
}

/** What a rule appends so the reader can act on it: the catalog's reason, in plain words. */
export const VERIFY_BEFORE_RELYING =
  "Check the manufacturer's manual before relying on this result."
