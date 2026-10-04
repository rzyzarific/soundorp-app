import { Fragment, type CSSProperties } from 'react'
import type { Device } from '../../data/devices.schema'
import { worstSeverity, type CheckResult, type ConnectionCheckResult } from '../../engine/types'
import { DeviceIcon } from './DeviceIcon'
import { CATEGORY_LABELS } from '../../lib/categoryLabels'
import type { CableListResult } from '../../lib/cableList'
import {
  PRICE_DISCLAIMER,
  budgetStatus,
  budgetStatusText,
  formatPrice,
  type ShoppingList,
} from '../../lib/shoppingList'

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
  glance: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: 4,
    margin: '18px 0 0',
    padding: '14px 12px 10px',
    background: '#f9fafb',
    border: `1px solid ${RULE}`,
    borderRadius: 8,
  },
  glanceTile: {
    width: 84,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    textAlign: 'center',
  },
  glanceName: { fontSize: 10, fontWeight: 600, lineHeight: 1.2, color: INK, wordBreak: 'break-word' },
  glanceArrow: { alignSelf: 'flex-start', marginTop: 10, fontSize: 20, fontWeight: 700, lineHeight: 1 },
  glanceKey: { flexBasis: '100%', margin: '8px 0 0', fontSize: 10, color: MUTED },
  deviceRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '7px 0',
    borderBottom: `1px solid ${RULE}`,
  },
  deviceIndex: { width: 22, flexShrink: 0, fontWeight: 700, color: MUTED },
  deviceName: { fontWeight: 700 },
  deviceBrand: { color: MUTED },
  deviceText: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  deviceCategory: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: MUTED,
  },
  summary: { margin: '0 0 12px', fontSize: 12, color: MUTED },
  connection: { marginBottom: 14 },
  connectionTitle: { margin: '0 0 6px', fontSize: 14, fontWeight: 700, color: INK },
  empty: { margin: 0, fontSize: 12, color: MUTED },
  lineRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 12,
    padding: '7px 0',
    borderBottom: `1px solid ${RULE}`,
  },
  quantity: { width: 34, flexShrink: 0, fontWeight: 700, color: INK },
  lineDetail: { color: MUTED, fontSize: 11 },
  price: { marginLeft: 'auto', flexShrink: 0, fontWeight: 700, textAlign: 'right' },
  noPrice: { marginLeft: 'auto', flexShrink: 0, color: MUTED, textAlign: 'right' },
  totalRow: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    padding: '10px 0 4px',
    borderTop: `2px solid ${INK}`,
    fontSize: 15,
    fontWeight: 700,
  },
  disclaimer: {
    margin: '8px 0 0',
    padding: '4px 10px',
    borderLeft: '3px solid #fcd34d',
    fontSize: 11,
    color: INK,
  },
  note: { margin: '8px 0 0', fontSize: 11, color: MUTED },
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

// A custom device the owner gave no brand carries the placeholder brand "Custom"; "by Custom"
// next to "(custom)" would just say it twice.
function showBrand(device: Device): boolean {
  return !(device.isCustom && device.brand === 'Custom')
}

// The colour of the arrow into the next device: its connection's worst result. A connection
// with no applicable checks has nothing to report, so its arrow is neutral.
function arrowColor(connection: ConnectionCheckResult | undefined): string {
  if (!connection || connection.results.length === 0) return MUTED
  return SEVERITY[worstSeverity(connection.results)].accent
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
  cables: CableListResult
  shopping: ShoppingList
  // The user's budget in dollars, or null if they haven't set one.
  budget: number | null
}

export function ChainPrintLayout({
  chainName,
  devices,
  connections,
  generatedAt,
  cables,
  shopping,
  budget,
}: ChainPrintLayoutProps) {
  const counts = countBySeverity(connections)
  const summary = [
    `${counts.critical} critical`,
    `${counts.warning} ${counts.warning === 1 ? 'warning' : 'warnings'}`,
    `${counts.pass} passed`,
  ].join('  ·  ')
  const status = budgetStatus(shopping.total, budget)

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

      <section data-pdf-break style={styles.glance} aria-label="Chain at a glance">
        {devices.map((device, i) => (
          <Fragment key={`${device.id}-${i}`}>
            <div style={styles.glanceTile}>
              <DeviceIcon device={device} size={44} />
              <span style={styles.glanceName}>{device.name}</span>
            </div>
            {i < devices.length - 1 && (
              <span style={{ ...styles.glanceArrow, color: arrowColor(connections[i]) }}>→</span>
            )}
          </Fragment>
        ))}
        <p style={styles.glanceKey}>
          Arrows show the worst result for each connection: green passed, amber warning, red critical.
        </p>
      </section>

      <section data-pdf-break>
        <h2 style={styles.sectionTitle}>Signal chain</h2>
        {devices.map((device, i) => (
          <div key={`${device.id}-${i}`} data-pdf-break={i > 0 ? '' : undefined} style={styles.deviceRow}>
            <span style={styles.deviceIndex}>{i + 1}.</span>
            <DeviceIcon device={device} size={36} />
            {/* Two lines beside the icon, so the text fills its height. A single line looked
                adrift next to it, because html2canvas draws text a little below its box. */}
            <span style={styles.deviceText}>
              <span>
                <span style={styles.deviceName}>{device.name}</span>{' '}
                {showBrand(device) && <span style={styles.deviceBrand}>by {device.brand}</span>}
              </span>
              <span style={styles.deviceCategory}>
                {CATEGORY_LABELS[device.category]}
                {device.subtype ? ` · ${device.subtype}` : ''}
                {device.isCustom ? ' · Custom' : ''}
              </span>
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

      <section data-pdf-break>
        <h2 style={styles.sectionTitle}>Cables &amp; adapters</h2>
        {cables.lines.map((line, i) => (
          <div key={`${line.kind}:${line.label}`} data-pdf-break={i > 0 ? '' : undefined} style={styles.lineRow}>
            <span style={{ ...styles.quantity, color: line.kind === 'adapter' ? SEVERITY.warning.accent : INK }}>
              {line.quantity}×
            </span>
            <span>
              <span style={{ fontWeight: 700, color: line.kind === 'adapter' ? SEVERITY.warning.accent : INK }}>
                {line.label}
              </span>
              <br />
              <span style={styles.lineDetail}>{line.connections.join(', ')}</span>
            </span>
          </div>
        ))}
        {cables.lines.length === 0 && <p style={styles.empty}>No cables could be worked out for this chain.</p>}
        {cables.noLineOutput.length > 0 && (
          <p style={styles.note}>
            No line-level output, so no cable is listed for: {cables.noLineOutput.join(', ')}. See the compatibility
            report.
          </p>
        )}
        {cables.skipped.length > 0 && (
          <p style={styles.note}>Not included (no connector data): {cables.skipped.join(', ')}.</p>
        )}
        <p style={styles.note}>Cable lengths aren't specified, so measure your setup before buying.</p>
      </section>

      <section data-pdf-break>
        <h2 style={styles.sectionTitle}>Shopping list</h2>
        <p style={styles.summary}>
          Estimated total {formatPrice(shopping.total)}
          {budget !== null && status && (
            <>
              {'  ·  '}Budget {formatPrice(budget)}
              {'  ·  '}
              <span style={{ fontWeight: 700, color: status.state === 'over' ? SEVERITY.warning.accent : SEVERITY.pass.accent }}>
                {budgetStatusText(status)}
              </span>
            </>
          )}
        </p>
        {shopping.lines.map((line, i) => (
          <div key={line.device.id} data-pdf-break={i > 0 ? '' : undefined} style={styles.lineRow}>
            <span>
              <span style={styles.deviceName}>
                {line.quantity > 1 ? `${line.quantity}× ` : ''}
                {line.device.name}
              </span>{' '}
              {showBrand(line.device) && <span style={styles.deviceBrand}>by {line.device.brand}</span>}
              {line.device.isCustom && <span style={styles.deviceBrand}> (custom)</span>}
              {line.quantity > 1 && line.unitPrice !== undefined && (
                <>
                  <br />
                  <span style={styles.lineDetail}>{formatPrice(line.unitPrice)} each</span>
                </>
              )}
            </span>
            {line.subtotal === undefined ? (
              <span style={styles.noPrice}>No price</span>
            ) : (
              <span style={styles.price}>{formatPrice(line.subtotal)}</span>
            )}
          </div>
        ))}
        {/* No break marker here on purpose: a page may not cut between the last item and the
            total (or the disclaimer under it), so the total is never stranded from its items. */}
        <div style={styles.totalRow}>
          <span>Estimated total</span>
          <span>{formatPrice(shopping.total)}</span>
        </div>
        <p style={styles.disclaimer}>{PRICE_DISCLAIMER}</p>
        {shopping.unpricedCount > 0 && (
          <p style={styles.note}>
            {shopping.unpricedCount} device{shopping.unpricedCount === 1 ? '' : 's'} without a price{' '}
            {shopping.unpricedCount === 1 ? "isn't" : "aren't"} included in the total.
          </p>
        )}
      </section>

      <p style={styles.footer}>Created with the soundorp Signal Chain Builder — soundorp.com</p>
    </div>
  )
}
