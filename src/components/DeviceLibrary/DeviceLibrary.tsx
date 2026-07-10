import { useState } from 'react'
import { searchDevices } from '../../data/devices'
import { useChainStore } from '../../store/useChainStore'
import { DeviceSearchItem } from './DeviceSearchItem'

export function DeviceLibrary() {
  const [query, setQuery] = useState('')
  const addDevice = useChainStore((s) => s.addDevice)
  const results = searchDevices(query)

  return (
    <div className="flex w-full flex-col gap-3 rounded-xl border border-soundorp-border bg-soundorp-panel p-4 min-[900px]:w-72 min-[900px]:shrink-0">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search gear…"
        className="rounded-md border border-soundorp-border bg-soundorp-bg px-3 py-1.5 text-sm text-soundorp-text outline-none placeholder:text-soundorp-muted focus:border-soundorp-red"
      />
      <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto min-[900px]:max-h-[60vh]">
        {results.length === 0 && <p className="text-sm text-soundorp-muted">No devices found.</p>}
        {results.map((device) => (
          <DeviceSearchItem key={device.id} device={device} onAdd={addDevice} />
        ))}
      </div>
    </div>
  )
}
