import { useState } from 'react'
import { filterDevices, searchDevices } from '../../data/devices'
import type { Device } from '../../data/devices.schema'
import { FREE_TIER_CUSTOM_DEVICE_LIMIT, useChainStore } from '../../store/useChainStore'
import { CustomDeviceModal } from '../CustomDevices/CustomDeviceModal'
import { ProBadge } from '../Pro/ProBadge'
import { DeviceSearchItem } from './DeviceSearchItem'

type ModalState = null | { mode: 'add' } | { mode: 'edit'; device: Device }

export function DeviceLibrary() {
  const [query, setQuery] = useState('')
  const [modal, setModal] = useState<ModalState>(null)
  const addDevice = useChainStore((s) => s.addDevice)
  const customDevices = useChainStore((s) => s.customDevices)
  const deleteCustomDevice = useChainStore((s) => s.deleteCustomDevice)
  const openUpgradeModal = useChainStore((s) => s.openUpgradeModal)
  const isPro = useChainStore((s) => s.isPro)

  const results = searchDevices(query)
  const myResults = filterDevices(customDevices, query)
  const atFreeLimit = !isPro && customDevices.length >= FREE_TIER_CUSTOM_DEVICE_LIMIT

  function handleAddCustom() {
    // Don't make someone fill in a form only to be told they can't save it.
    if (atFreeLimit) openUpgradeModal('custom_devices')
    else setModal({ mode: 'add' })
  }

  return (
    <div className="flex w-full flex-col gap-3 rounded-xl border border-soundorp-border bg-soundorp-panel p-4 min-[900px]:w-72 min-[900px]:shrink-0">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search gear…"
        className="rounded-md border border-soundorp-border bg-soundorp-bg px-3 py-1.5 text-sm text-soundorp-text outline-none placeholder:text-soundorp-muted focus:border-soundorp-red"
      />

      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={handleAddCustom}
          aria-haspopup="dialog"
          className="flex items-center justify-center gap-1.5 rounded-md border border-dashed border-soundorp-border px-3 py-1.5 text-sm font-medium text-soundorp-muted hover:bg-[#1f1f1f] hover:text-soundorp-text"
        >
          + Add custom device
          {atFreeLimit && <ProBadge />}
        </button>
        {!isPro && customDevices.length > 0 && (
          <p className="text-center text-xs text-soundorp-muted">
            Free plan: {customDevices.length} of {FREE_TIER_CUSTOM_DEVICE_LIMIT} custom device used
          </p>
        )}
      </div>

      <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto min-[900px]:max-h-[60vh]">
        {myResults.length > 0 && (
          <>
            <h3 className="font-orbitron text-xs font-black uppercase tracking-[0.6px] text-soundorp-muted">
              My devices
            </h3>
            {myResults.map((device) => (
              <DeviceSearchItem
                key={device.id}
                device={device}
                onAdd={addDevice}
                onEdit={(d) => setModal({ mode: 'edit', device: d })}
                onDelete={deleteCustomDevice}
              />
            ))}
            {results.length > 0 && (
              <h3 className="mt-1 font-orbitron text-xs font-black uppercase tracking-[0.6px] text-soundorp-muted">
                Catalog
              </h3>
            )}
          </>
        )}
        {results.length === 0 && myResults.length === 0 && (
          <p className="text-sm text-soundorp-muted">No devices found.</p>
        )}
        {results.map((device) => (
          <DeviceSearchItem key={device.id} device={device} onAdd={addDevice} />
        ))}
      </div>

      {modal && (
        <CustomDeviceModal
          editing={modal.mode === 'edit' ? modal.device : undefined}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
