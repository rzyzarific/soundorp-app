import { useEffect, useState } from 'react'
import { getDeviceById } from './data/devices'
import { evaluateChain } from './engine/evaluateChain'
import { useChainStore } from './store/useChainStore'
import { decodeShareParam } from './lib/share'
import { ChainCanvas } from './components/ChainCanvas/ChainCanvas'
import { CompatibilityReport } from './components/CompatibilityReport/CompatibilityReport'
import { DeviceLibrary } from './components/DeviceLibrary/DeviceLibrary'
import { Toolbar } from './components/Toolbar/Toolbar'
import { AuthPanel } from './components/Auth/AuthPanel'

function App() {
  const deviceIds = useChainStore((s) => s.currentChain.deviceIds)
  const loadChainFromShareData = useChainStore((s) => s.loadChainFromShareData)
  const [droppedCount, setDroppedCount] = useState(0)

  useEffect(() => {
    const url = new URL(window.location.href)
    const encoded = url.searchParams.get('chain')
    if (!encoded) return

    const decoded = decodeShareParam(encoded)
    if (decoded) {
      loadChainFromShareData(decoded.deviceIds, decoded.name)
      setDroppedCount(decoded.droppedCount)
    }

    url.searchParams.delete('chain')
    window.history.replaceState({}, '', url.toString())
    // Runs once on mount to consume the ?chain= param from a shared link.
  }, [])

  const devices = deviceIds
    .map((id) => getDeviceById(id))
    .filter((d) => d !== undefined)

  const connections = evaluateChain(devices)

  return (
    <div className="min-h-screen bg-soundorp-bg px-6 py-10 text-soundorp-text">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="font-orbitron text-lg font-black lowercase text-soundorp-red">
              soundorp
            </span>
            <h1 className="font-orbitron text-xl font-black text-soundorp-text">
              Signal Chain Builder
            </h1>
            <p className="text-sm text-soundorp-muted">
              Build a chain and get live compatibility checks.
            </p>
          </div>
          <AuthPanel />
        </header>

        {droppedCount > 0 && (
          <div className="rounded-md border border-status-warning-border bg-status-warning-bg px-3 py-2 text-sm text-status-warning-text">
            {droppedCount} device{droppedCount === 1 ? '' : 's'} from the shared link {droppedCount === 1 ? 'is' : 'are'} no longer in the catalog and{' '}
            {droppedCount === 1 ? 'was' : 'were'} skipped.
          </div>
        )}

        <Toolbar />

        <div className="flex flex-col gap-6 min-[900px]:flex-row">
          <DeviceLibrary />

          <div className="flex flex-1 flex-col gap-8">
            <ChainCanvas devices={devices} connections={connections} />

            <section>
              <h2 className="mb-3 font-orbitron text-sm font-black uppercase tracking-[0.6px] text-soundorp-muted">
                Compatibility Report
              </h2>
              {connections.length === 0 ? (
                <p className="text-sm text-soundorp-muted">
                  Add at least two devices to see compatibility checks.
                </p>
              ) : (
                <CompatibilityReport devices={devices} connections={connections} />
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
