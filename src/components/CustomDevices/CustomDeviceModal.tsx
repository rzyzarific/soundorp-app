import { useState, type FormEvent, type ReactNode } from 'react'
import { CONNECTORS, DEVICE_CATEGORIES, type Connector, type Device } from '../../data/devices.schema'
import {
  CATEGORY_FIELDS,
  DEFAULT_CONNECTORS,
  MAX_BRAND_LENGTH,
  MAX_NAME_LENGTH,
  deviceToInput,
  emptyCustomDeviceInput,
  type CustomDeviceField,
  type CustomDeviceInput,
} from '../../lib/customDevices'
import { CATEGORY_LABELS } from '../../lib/categoryLabels'
import { useChainStore } from '../../store/useChainStore'
import { Modal } from '../Pro/Modal'

type ConnectorListKey = 'inputConnectors' | 'outputConnectors' | 'headphoneOutputConnectors'
type NumberKey = 'msrp' | 'minPreampGain' | 'maxPreampGain' | 'gainBoost'

// A headphone jack is a ¼" or 3.5mm socket; offering USB or ADAT there would only confuse.
const HEADPHONE_CONNECTORS: Connector[] = ['TRS', '3.5mm']

interface CustomDeviceModalProps {
  // Present when editing an existing device; absent when adding a new one.
  editing?: Device
  onClose: () => void
}

const inputClass =
  'w-full rounded-md border border-soundorp-border bg-soundorp-bg px-2 py-1.5 text-sm text-soundorp-text outline-none placeholder:text-soundorp-muted focus:border-soundorp-red aria-[invalid=true]:border-status-critical'

function numberText(value: number | undefined): string {
  return value === undefined ? '' : String(value)
}

// Blank means "not specified"; anything that isn't a number becomes NaN so validation flags it.
function parseNumber(text: string): number | undefined {
  const trimmed = text.trim()
  return trimmed === '' ? undefined : Number(trimmed)
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-semibold text-soundorp-text">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-soundorp-muted">{hint}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-status-critical-text">
          {error}
        </p>
      )}
    </div>
  )
}

function ConnectorPicker({
  legend,
  options,
  selected,
  onToggle,
}: {
  legend: string
  options: Connector[]
  selected: Connector[]
  onToggle: (c: Connector) => void
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1 text-xs font-semibold text-soundorp-text">{legend}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((c) => {
          const on = selected.includes(c)
          return (
            <label
              key={c}
              className={
                on
                  ? 'cursor-pointer rounded-md border border-soundorp-red bg-soundorp-red/10 px-2 py-1 text-xs font-medium text-soundorp-text'
                  : 'cursor-pointer rounded-md border border-soundorp-border px-2 py-1 text-xs font-medium text-soundorp-muted hover:bg-[#1f1f1f]'
              }
            >
              <input
                type="checkbox"
                checked={on}
                onChange={() => onToggle(c)}
                className="sr-only"
              />
              {c}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 accent-[#ee1d1d]"
      />
      <span className="flex flex-col">
        <span className="text-sm text-soundorp-text">{label}</span>
        <span className="text-xs text-soundorp-muted">{hint}</span>
      </span>
    </label>
  )
}

export function CustomDeviceModal({ editing, onClose }: CustomDeviceModalProps) {
  const addCustomDevice = useChainStore((s) => s.addCustomDevice)
  const updateCustomDevice = useChainStore((s) => s.updateCustomDevice)

  const [input, setInput] = useState<CustomDeviceInput>(() =>
    editing ? deviceToInput(editing) : emptyCustomDeviceInput('microphone'),
  )
  const [texts, setTexts] = useState<Record<NumberKey, string>>(() => ({
    msrp: numberText(input.msrp),
    minPreampGain: numberText(input.minPreampGain),
    maxPreampGain: numberText(input.maxPreampGain),
    gainBoost: numberText(input.gainBoost),
  }))
  const [errors, setErrors] = useState<Partial<Record<CustomDeviceField, string>>>({})

  const fields = CATEGORY_FIELDS[input.category]

  function changeCategory(category: CustomDeviceInput['category']) {
    setInput((prev) => {
      // When adding, start from the new category's usual connectors. When editing, never
      // overwrite connectors the user has already set.
      if (editing) return { ...prev, category }
      const defaults = DEFAULT_CONNECTORS[category]
      return {
        ...prev,
        category,
        inputConnectors: [...defaults.inputs],
        outputConnectors: [...defaults.outputs],
        headphoneOutputConnectors: [...defaults.headphones],
      }
    })
  }

  function toggleConnector(key: ConnectorListKey, connector: Connector) {
    setInput((prev) => ({
      ...prev,
      [key]: prev[key].includes(connector)
        ? prev[key].filter((c) => c !== connector)
        : [...prev[key], connector],
    }))
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const submitted: CustomDeviceInput = {
      ...input,
      msrp: parseNumber(texts.msrp),
      minPreampGain: parseNumber(texts.minPreampGain),
      maxPreampGain: parseNumber(texts.maxPreampGain),
      gainBoost: parseNumber(texts.gainBoost),
    }

    if (editing) {
      const result = updateCustomDevice(editing.id, submitted)
      if (result.ok) onClose()
      else setErrors(result.errors)
      return
    }

    const result = addCustomDevice(submitted)
    if (result.ok) onClose()
    // At the free limit the store has already opened the upgrade modal; this form is moot.
    else if (result.reason === 'limit') onClose()
    else setErrors(result.errors)
  }

  const err = (field: CustomDeviceField) => errors[field]
  const invalid = (field: CustomDeviceField) => (errors[field] ? true : undefined)
  const describedBy = (field: CustomDeviceField) => (errors[field] ? `cd-${field}-error` : undefined)

  return (
    <Modal onClose={onClose} labelledBy="custom-device-title" widthClass="max-w-lg">
      <h2 id="custom-device-title" className="pr-8 font-orbitron text-base font-black text-soundorp-text">
        {editing ? 'Edit custom device' : 'Add a custom device'}
      </h2>
      <p className="mt-1 text-sm text-soundorp-muted">
        For gear that isn't in the catalog. The compatibility checks use exactly what you enter here.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-4 flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field id="cd-name" label="Name" error={err('name')}>
            <input
              id="cd-name"
              type="text"
              value={input.name}
              maxLength={MAX_NAME_LENGTH + 20}
              onChange={(e) => setInput({ ...input, name: e.target.value })}
              placeholder="e.g. NT1-A"
              autoComplete="off"
              aria-invalid={invalid('name')}
              aria-describedby={describedBy('name')}
              className={inputClass}
            />
          </Field>
          <Field id="cd-brand" label="Brand" hint="Optional." error={err('brand')}>
            <input
              id="cd-brand"
              type="text"
              value={input.brand}
              maxLength={MAX_BRAND_LENGTH + 20}
              onChange={(e) => setInput({ ...input, brand: e.target.value })}
              placeholder="e.g. Rode"
              autoComplete="off"
              aria-invalid={invalid('brand')}
              aria-describedby={describedBy('brand')}
              className={inputClass}
            />
          </Field>
          <Field id="cd-category" label="Category" error={err('category')}>
            <select
              id="cd-category"
              value={input.category}
              onChange={(e) => changeCategory(e.target.value as CustomDeviceInput['category'])}
              className={inputClass}
            >
              {DEVICE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </Field>
          <Field id="cd-msrp" label="Price (USD)" hint="Optional." error={err('msrp')}>
            <input
              id="cd-msrp"
              type="text"
              inputMode="decimal"
              value={texts.msrp}
              onChange={(e) => setTexts({ ...texts, msrp: e.target.value })}
              placeholder="e.g. 229"
              autoComplete="off"
              aria-invalid={invalid('msrp')}
              aria-describedby={describedBy('msrp')}
              className={inputClass}
            />
          </Field>
        </div>

        {(fields.inputs || fields.outputs || fields.headphones) && (
          <div className="flex flex-col gap-3">
            {fields.inputs && (
              <ConnectorPicker
                legend="Inputs it accepts"
                options={CONNECTORS}
                selected={input.inputConnectors}
                onToggle={(c) => toggleConnector('inputConnectors', c)}
              />
            )}
            {fields.outputs && (
              <ConnectorPicker
                legend="Outputs it provides"
                options={CONNECTORS}
                selected={input.outputConnectors}
                onToggle={(c) => toggleConnector('outputConnectors', c)}
              />
            )}
            {fields.headphones && (
              <ConnectorPicker
                legend="Headphone jack"
                options={HEADPHONE_CONNECTORS}
                selected={input.headphoneOutputConnectors}
                onToggle={(c) => toggleConnector('headphoneOutputConnectors', c)}
              />
            )}
            <p className="text-xs text-soundorp-muted">
              Include every analog and digital connector it has — a USB interface with ¼″ monitor
              outs should list both.
            </p>
          </div>
        )}

        {(fields.needsPhantom ||
          fields.damagedByPhantom ||
          fields.providesPhantom ||
          fields.minGain ||
          fields.maxGain ||
          fields.boost) && (
          <div className="flex flex-col gap-3">
            {fields.needsPhantom && (
              <Toggle
                label="Needs 48V phantom power"
                hint={
                  input.category === 'microphone'
                    ? 'Condenser mics need it to work at all.'
                    : 'In-line boosters take their power from the next device.'
                }
                checked={input.needsPhantomPower}
                onChange={(checked) => setInput({ ...input, needsPhantomPower: checked })}
              />
            )}
            {fields.damagedByPhantom && (
              <Toggle
                label="Can be damaged by phantom power"
                hint="Tick this for ribbon mics."
                checked={input.phantomPowerDamages}
                onChange={(checked) => setInput({ ...input, phantomPowerDamages: checked })}
              />
            )}
            {fields.providesPhantom && (
              <Toggle
                label="Provides 48V phantom power"
                hint="Needed to run condenser mics and in-line boosters."
                checked={input.providesPhantomPower}
                onChange={(checked) => setInput({ ...input, providesPhantomPower: checked })}
              />
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {fields.minGain && (
                <Field
                  id="cd-minPreampGain"
                  label="Clean gain it needs (dB)"
                  hint="Low-output mics like the SM7B need about 60. Most condensers need 30–40."
                  error={err('minPreampGain')}
                >
                  <input
                    id="cd-minPreampGain"
                    type="text"
                    inputMode="decimal"
                    value={texts.minPreampGain}
                    onChange={(e) => setTexts({ ...texts, minPreampGain: e.target.value })}
                    placeholder="e.g. 45"
                    autoComplete="off"
                    aria-invalid={invalid('minPreampGain')}
                    aria-describedby={describedBy('minPreampGain')}
                    className={inputClass}
                  />
                </Field>
              )}
              {fields.maxGain && (
                <Field
                  id="cd-maxPreampGain"
                  label="Maximum mic preamp gain (dB)"
                  hint="Leave blank if it has no mic preamps."
                  error={err('maxPreampGain')}
                >
                  <input
                    id="cd-maxPreampGain"
                    type="text"
                    inputMode="decimal"
                    value={texts.maxPreampGain}
                    onChange={(e) => setTexts({ ...texts, maxPreampGain: e.target.value })}
                    placeholder="e.g. 56"
                    autoComplete="off"
                    aria-invalid={invalid('maxPreampGain')}
                    aria-describedby={describedBy('maxPreampGain')}
                    className={inputClass}
                  />
                </Field>
              )}
              {fields.boost && (
                <Field
                  id="cd-gainBoost"
                  label="Gain it adds (dB)"
                  hint="Only for in-line boosters like a Cloudlifter."
                  error={err('gainBoost')}
                >
                  <input
                    id="cd-gainBoost"
                    type="text"
                    inputMode="decimal"
                    value={texts.gainBoost}
                    onChange={(e) => setTexts({ ...texts, gainBoost: e.target.value })}
                    placeholder="e.g. 25"
                    autoComplete="off"
                    aria-invalid={invalid('gainBoost')}
                    aria-describedby={describedBy('gainBoost')}
                    className={inputClass}
                  />
                </Field>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-soundorp-border pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-soundorp-border px-3 py-1.5 text-sm font-medium text-soundorp-muted hover:bg-[#1f1f1f] hover:text-soundorp-text"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-md bg-soundorp-red px-3 py-1.5 text-sm font-medium text-white hover:bg-soundorp-red/90"
          >
            {editing ? 'Save changes' : 'Add device'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
