import { useEffect, useState } from 'react'
import { evaluateChain } from './engine/evaluateChain'
import { useChainStore } from './store/useChainStore'
import { decodeShareParam } from './lib/share'
import { resolveChainDevices } from './lib/customDevices'
import { ChainCanvas } from './components/ChainCanvas/ChainCanvas'
import { SignalFlowHint } from './components/ChainCanvas/SignalFlowHint'
import { CableList } from './components/CableList/CableList'
import { ShoppingList } from './components/ShoppingList/ShoppingList'
import { CompatibilityReport } from './components/CompatibilityReport/CompatibilityReport'
import { DeviceLibrary } from './components/DeviceLibrary/DeviceLibrary'
import { Toolbar } from './components/Toolbar/Toolbar'
import { UpgradeModal } from './components/Pro/UpgradeModal'

function App() {
  const deviceIds = useChainStore((s) => s.currentChain.deviceIds)
  const chainCustomDevices = useChainStore((s) => s.currentChain.customDevices)
  const customLibrary = useChainStore((s) => s.customDevices)
  const loadChainFromShareData = useChainStore((s) => s.loadChainFromShareData)
  const [droppedCount, setDroppedCount] = useState(0)

  useEffect(() => {
    const url = new URL(window.location.href)
    const encoded = url.searchParams.get('chain')
    if (!encoded) return

    const decoded = decodeShareParam(encoded)
    if (decoded) {
      loadChainFromShareData(decoded.deviceIds, decoded.name, decoded.customDevices)
      setDroppedCount(decoded.droppedCount)
    }

    url.searchParams.delete('chain')
    window.history.replaceState({}, '', url.toString())
    // Runs once on mount to consume the ?chain= param from a shared link.
  }, [])

  const { devices } = resolveChainDevices(deviceIds, customLibrary, chainCustomDevices)

  const connections = evaluateChain(devices)

  return (
    <div className="min-h-screen bg-soundorp-bg px-6 py-10 text-soundorp-text">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <a
              href="https://soundorp.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-fit font-orbitron text-lg font-black lowercase text-soundorp-red hover:underline"
            >
              soundorp
            </a>
            <h1 className="font-orbitron text-xl font-black text-soundorp-text">
              Signal Chain Builder
            </h1>
            <p className="text-sm text-soundorp-muted">
              Build a chain and get live compatibility checks.
            </p>
          </div>
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

          {/* min-w-0: a flex item's minimum width is its content's, so without it the wide chain
              row stretches this column (and the page) instead of scrolling inside its own box. */}
          <div className="flex w-full min-w-0 max-w-full flex-1 flex-col gap-8">
            <SignalFlowHint devices={devices} />
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

            <CableList devices={devices} />

            <ShoppingList devices={devices} />
          </div>
        </div>
      </div>
      <UpgradeModal />
    </div>
  )
}

export default App
