import type { Device } from '../../data/devices.schema'
import type { ConnectionCheckResult } from '../../engine/types'
import { CheckRow } from './CheckRow'

interface CompatibilityReportProps {
  devices: Device[]
  connections: ConnectionCheckResult[]
}

export function CompatibilityReport({ devices, connections }: CompatibilityReportProps) {
  return (
    <div className="flex flex-col gap-4">
      {connections.map((connection) => {
        const upstream = devices.find((d) => d.id === connection.upstreamId)
        const downstream = devices.find((d) => d.id === connection.downstreamId)

        return (
          <div key={connection.connectionIndex} className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-soundorp-text">
              {upstream?.name} → {downstream?.name}
            </h3>
            <div className="flex flex-col gap-1.5">
              {connection.results.length === 0 ? (
                <p className="text-sm text-soundorp-muted">No applicable checks for this connection.</p>
              ) : (
                connection.results.map((result, i) => <CheckRow key={i} result={result} />)
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
