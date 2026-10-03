import type { Device } from '../../data/devices.schema'
import { buildCableList } from '../../lib/cableList'

interface CableListProps {
  devices: Device[]
}

export function CableList({ devices }: CableListProps) {
  const { lines, skipped, noLineOutput } = buildCableList(devices)

  return (
    <section>
      <h2 className="mb-3 font-orbitron text-sm font-black uppercase tracking-[0.6px] text-soundorp-muted">
        Cables &amp; Adapters
      </h2>

      {devices.length < 2 ? (
        <p className="text-sm text-soundorp-muted">
          Add at least two devices to see the cables you'll need.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {lines.map((line) => (
            <div
              key={`${line.kind}:${line.label}`}
              className={
                line.kind === 'adapter'
                  ? 'flex items-start gap-3 rounded-md border border-status-warning-border bg-status-warning-bg px-3 py-2'
                  : 'flex items-start gap-3 rounded-md border border-soundorp-border-card bg-soundorp-card px-3 py-2'
              }
            >
              <span
                className={`min-w-8 text-sm font-bold ${line.kind === 'adapter' ? 'text-status-warning-text' : 'text-soundorp-text'}`}
              >
                {line.quantity}×
              </span>
              <div className="flex flex-col gap-0.5 text-sm">
                <span
                  className={`font-semibold ${line.kind === 'adapter' ? 'text-status-warning-text' : 'text-soundorp-text'}`}
                >
                  {line.label}
                </span>
                <span className="text-soundorp-muted">{line.connections.join(', ')}</span>
              </div>
            </div>
          ))}

          {lines.length === 0 && (
            <p className="text-sm text-soundorp-muted">
              No cables could be worked out for this chain.
            </p>
          )}

          {noLineOutput.length > 0 && (
            <p className="text-xs text-status-warning-text">
              No line-level output, so no cable is listed for: {noLineOutput.join(', ')}. See the
              compatibility report.
            </p>
          )}

          {skipped.length > 0 && (
            <p className="text-xs text-soundorp-muted">
              Not included (no connector data): {skipped.join(', ')}.
            </p>
          )}

          <p className="text-xs text-soundorp-muted">
            Cable lengths aren't specified, so measure your setup before buying.
          </p>
        </div>
      )}
    </section>
  )
}
