import { useEffect } from 'react'
import type { Device } from '../../data/devices.schema'
import { evaluateChain } from '../../engine/evaluateChain'
import type { ConnectionCheckResult } from '../../engine/types'
import { resolveChainDevices } from '../../lib/customDevices'
import { buildBuilderUrl } from '../../lib/publicLink'
import { decodeShareParam } from '../../lib/share'
import { CableList } from '../CableList/CableList'
import { Connector } from '../ChainCanvas/Connector'
import { DeviceNode } from '../ChainCanvas/DeviceNode'
import { CompatibilityReport } from '../CompatibilityReport/CompatibilityReport'

interface PublicChainPageProps {
  // The payload from /c/<payload>; null when the address couldn't be decoded at all.
  encoded: string | null
}

const SITE_URL = 'https://soundorp.com'
const HEADING_CLASS =
  'mb-3 font-orbitron text-sm font-black uppercase tracking-[0.6px] text-soundorp-muted'
const PRIMARY_LINK_CLASS =
  'rounded-md bg-soundorp-red px-3 py-1.5 text-sm font-medium text-white hover:bg-soundorp-red/90'

// Pages built from anyone's link shouldn't be indexed: they're thin, user-supplied content on
// our domain. Also gives the tab a useful title, and puts both back on the way out.
function usePageHead(title: string) {
  useEffect(() => {
    const previousTitle = document.title
    document.title = title

    const robots = document.createElement('meta')
    robots.name = 'robots'
    robots.content = 'noindex, nofollow'
    document.head.appendChild(robots)

    return () => {
      document.title = previousTitle
      robots.remove()
    }
  }, [title])
}

function PageShell({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="px-6 py-10 text-soundorp-text">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        {/* The soundorp wordmark and the way back to soundorp.com live in the navbar (AppShell). */}
        {action && <header className="flex justify-end">{action}</header>}
        {children}
        <footer className="border-t border-soundorp-border pt-4 text-xs text-soundorp-muted">
          Made with the{' '}
          <a
            href={SITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-soundorp-text underline-offset-2 hover:underline"
          >
            soundorp Signal Chain Builder
          </a>
        </footer>
      </div>
    </div>
  )
}

function InvalidLink() {
  return (
    <PageShell>
      <section className="flex flex-col items-start gap-3 rounded-xl border border-soundorp-border bg-soundorp-panel p-6">
        <h1 className="font-orbitron text-xl font-black text-soundorp-text">This link isn't valid</h1>
        <p className="text-sm text-soundorp-muted">
          It may have been cut off when it was copied. Ask for a fresh link, or start a new chain.
        </p>
        <a href="/" className={PRIMARY_LINK_CLASS}>
          Open the builder
        </a>
      </section>
    </PageShell>
  )
}

// Read-only: the same cards and connection dots as the builder, with nothing to drag or click.
function StaticChain({
  devices,
  connections,
}: {
  devices: Device[]
  connections: ConnectionCheckResult[]
}) {
  return (
    <ol
      aria-label="Signal chain"
      className="flex flex-col items-center rounded-xl border border-soundorp-border bg-soundorp-panel p-6 sm:flex-row sm:flex-wrap sm:gap-y-4"
    >
      {devices.map((device, i) => (
        <li key={`${device.id}-${i}`} className="flex flex-col items-center sm:flex-row">
          <DeviceNode device={device} readOnly />
          {i < devices.length - 1 && connections[i] && (
            <Connector connection={connections[i]} stackedOnMobile />
          )}
        </li>
      ))}
    </ol>
  )
}

export function PublicChainPage({ encoded }: PublicChainPageProps) {
  const decoded = encoded === null ? null : decodeShareParam(encoded)
  const name = decoded && decoded.name !== '' ? decoded.name : 'Shared chain'
  usePageHead(decoded ? `${name} — Soundorp Signal Chain Builder` : 'Link not found — Soundorp Signal Chain Builder')

  if (encoded === null || !decoded) return <InvalidLink />

  const { devices } = resolveChainDevices(decoded.deviceIds, [], decoded.customDevices)
  const connections = evaluateChain(devices)
  const builderHref = buildBuilderUrl(encoded)

  return (
    <PageShell
      action={
        <a href={builderHref} className={PRIMARY_LINK_CLASS}>
          Open in builder
        </a>
      }
    >
      <section className="flex flex-col gap-1">
        <h1 className="break-words font-orbitron text-xl font-black text-soundorp-text">{name}</h1>
        <p className="text-sm text-soundorp-muted">
          {devices.length} device{devices.length === 1 ? '' : 's'} · Shared chain
        </p>
        <p className="text-xs text-soundorp-muted">
          Shared by a user. The name and any custom devices were entered by whoever made this link.
        </p>
      </section>

      {decoded.droppedCount > 0 && (
        <div className="rounded-md border border-status-warning-border bg-status-warning-bg px-3 py-2 text-sm text-status-warning-text">
          {decoded.droppedCount} device{decoded.droppedCount === 1 ? '' : 's'} in this link{' '}
          {decoded.droppedCount === 1 ? 'is' : 'are'} no longer in the catalog and{' '}
          {decoded.droppedCount === 1 ? 'was' : 'were'} skipped.
        </div>
      )}

      {devices.length === 0 ? (
        <p className="rounded-xl border border-dashed border-soundorp-border bg-soundorp-panel p-10 text-center text-sm text-soundorp-muted">
          This chain is empty.
        </p>
      ) : (
        <StaticChain devices={devices} connections={connections} />
      )}

      {devices.length >= 2 && (
        <>
          <section>
            <h2 className={HEADING_CLASS}>Compatibility Report</h2>
            <CompatibilityReport devices={devices} connections={connections} readOnly />
          </section>

          <CableList devices={devices} />
        </>
      )}

      <div>
        <a href={builderHref} className={PRIMARY_LINK_CLASS}>
          Open this chain in the builder
        </a>
      </div>
    </PageShell>
  )
}
