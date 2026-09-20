import type { CSSProperties } from 'react'
import type { Device } from '../../data/devices.schema'
import type { CheckResult, ConnectionCheckResult } from '../../engine/types'
import { CATEGORY_LABELS } from '../../lib/categoryLabels'

/** Width of the layout in CSS px — A4 at 96dpi. The exporter maps this to 210mm. */
export const PRINT_LAYOUT_WIDTH_PX = 794

// Static, print-oriented (light) rendering of a chain and its compatibility report,
// captured to an image by html2canvas. Deliberately uses plain inline hex colors —
// html2canvas can't parse the modern color functions (oklch/color-mix) Tailwind emits —
// and no interactive elements. `data-pdf-break` marks where a page may safely break.

const INK = '#111827'
const MUTED = '#6b7280'
const RULE = '#e5e7eb'
const BRAND_RED = '#ee1d1d'

const SEVERITY: Record<
  CheckResult['severity'],
  { icon: string; label: string; bg: string; border: string; accent: string }
> = {
  pass: { icon: '✓', label: 'passed', bg: '#f0fdf4', border: '#86efac', accent: '#15803d' },
  warning: { icon: '⚠', label: 'warning', bg: '#fffbeb', border: '#fcd34d', accent: '#b45309' },
  critical: { icon: '✕', label: 'critical', bg: '#fef2f2', border: '#fca5a5', accent: '#b91c1c' },
}

const styles = {
  root: {
    width: PRINT_LAYOUT_WIDTH_PX,
    boxSizing: 'border-box',
    // Bottom padding keeps the last line clear of the capture's bottom edge.
    padding: '0 40px 24px',
    background: '#ffffff',
    color: INK,
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    fontSize: 13,
    lineHeight: 1.45,
  },
  brandRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingBottom: 10,
    borderBottom: `2px solid ${BRAND_RED}`,
  },
  brand: {
    fontFamily: 'Orbitron, "Helvetica Neue", Arial, sans-serif',
    fontWeight: 900,
    fontSize: 16,
    textTransform: 'lowercase',
    color: BRAND_RED,
  },
  tool: { fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.6 },
  title: { margin: '18px 0 2px', fontSize: 24, fontWeight: 700, color: INK },
  meta: { margin: 0, fontSize: 11, color: MUTED },
  sectionTitle: {
    margin: '26px 0 10px',
    paddingBottom: 4,
    borderBottom: `1px solid ${RULE}`,
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: MUTED,
  },
  deviceRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 12,
    padding: '7px 0',
    borderBottom: `1px solid ${RULE}`,
  },
  deviceIndex: { width: 22, flexShrink: 0, fontWeight: 700, color: MUTED },
  deviceName: { fontWeight: 700 },
  deviceBrand: { color: MUTED },
  deviceCategory: {
    marginLeft: 'auto',
    flexShrink: 0,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: MUTED,
  },
  summary: { margin: '0 0 12px', fontSize: 12, color: MUTED },
  connection: { marginBottom: 14 },
  connectionTitle: { margin: '0 0 6px', fontSize: 14, fontWeight: 700, color: INK },
  empty: { margin: 0, fontSize: 12, color: MUTED },
  footer: { margin: '26px 0 0', fontSize: 10, color: MUTED },
} satisfies Record<string, CSSProperties>

function checkStyle(severity: CheckResult['severity']): CSSProperties {
  const s = SEVERITY[severity]
  return {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
    padding: '8px 10px',
    background: s.bg,
    border: `1px solid ${s.border}`,
    borderRadius: 6,
  }
}

function countBySeverity(connections: ConnectionCheckResult[]) {
  const counts = { critical: 0, warning: 0, pass: 0 }
  for (const c of connections) for (const r of c.results) counts[r.severity]++
  return counts
}

interface ChainPrintLayoutProps {
  chainName: string
  devices: Device[]
  connections: ConnectionCheckResult[]
  generatedAt: Date
}

export function ChainPrintLayout({ chainName, devices, connections, generatedAt }: ChainPrintLayoutProps) {
  const counts = countBySeverity(connections)
  const summary = [
    `${counts.critical} critical`,
    `${counts.warning} ${counts.warning === 1 ? 'warning' : 'warnings'}`,
    `${counts.pass} passed`,
  ].join('  ·  ')

  return (
    <div data-pdf-root style={styles.root}>
      <div style={styles.brandRow}>
        <span style={styles.brand}>soundorp</span>
        <span style={styles.tool}>Signal Chain Builder</span>
      </div>

      <h1 style={styles.title}>{chainName.trim() === '' ? 'Untitled chain' : chainName}</h1>
      <p style={styles.meta}>
        {devices.length} devices · Generated {generatedAt.toLocaleDateString(undefined, { dateStyle: 'long' })}
      </p>

      <section data-pdf-break>
        <h2 style={styles.sectionTitle}>Signal chain</h2>
        {devices.map((device, i) => (
          <div key={`${device.id}-${i}`} data-pdf-break={i > 0 ? '' : undefined} style={styles.deviceRow}>
            <span style={styles.deviceIndex}>{i + 1}.</span>
            <span>
              <span style={styles.deviceName}>{device.name}</span>{' '}
              <span style={styles.deviceBrand}>by {device.brand}</span>
            </span>
            <span style={styles.deviceCategory}>
              {CATEGORY_LABELS[device.category]}
              {device.subtype ? ` · ${device.subtype}` : ''}
            </span>
          </div>
        ))}
      </section>

      <section data-pdf-break>
        <h2 style={styles.sectionTitle}>Compatibility report</h2>
        <p style={styles.summary}>{summary}</p>
        {connections.map((connection, i) => {
          const upstream = devices.find((d) => d.id === connection.upstreamId)
          const downstream = devices.find((d) => d.id === connection.downstreamId)

          return (
            <div
              key={connection.connectionIndex}
              data-pdf-break={i > 0 ? '' : undefined}
              style={styles.connection}
            >
              <h3 style={styles.connectionTitle}>
                {upstream?.name} → {downstream?.name}
              </h3>
              {connection.results.length === 0 ? (
                <p style={styles.empty}>No applicable checks for this connection.</p>
              ) : (
                connection.results.map((result, j) => {
                  const s = SEVERITY[result.severity]
                  return (
                    <div key={j} style={checkStyle(result.severity)}>
                      <span style={{ color: s.accent, fontWeight: 700 }}>{s.icon}</span>
                      <div>
                        <div style={{ color: s.accent, fontWeight: 700 }}>{result.title}</div>
                        <div>{result.detail}</div>
                        {result.fix && <div style={{ color: MUTED, fontStyle: 'italic' }}>Fix: {result.fix}</div>}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )
        })}
      </section>

      <p style={styles.footer}>Created with the soundorp Signal Chain Builder — soundorp.com</p>
    </div>
  )
}
