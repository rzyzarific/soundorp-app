import { useState } from 'react'
import type { Device } from '../../data/devices.schema'
import { findCheaperAlternatives } from '../../engine/swaps'
import {
  PRICE_DISCLAIMER,
  budgetStatus,
  budgetStatusText,
  buildShoppingList,
  formatPrice,
  parseBudget,
} from '../../lib/shoppingList'
import { useChainStore } from '../../store/useChainStore'
import { ProBadge } from '../Pro/ProBadge'

interface ShoppingListProps {
  devices: Device[]
}

const HEADING_CLASS =
  'mb-3 flex items-center gap-2 font-orbitron text-sm font-black uppercase tracking-[0.6px] text-soundorp-muted'

export function ShoppingList({ devices }: ShoppingListProps) {
  const isPro = useChainStore((s) => s.isPro)
  return isPro ? <ProShoppingList devices={devices} /> : <LockedShoppingList />
}

function LockedShoppingList() {
  const openUpgradeModal = useChainStore((s) => s.openUpgradeModal)

  return (
    <section>
      <h2 className={HEADING_CLASS}>
        Shopping List
        <ProBadge />
      </h2>
      <div className="flex flex-col items-start gap-3 rounded-md border border-soundorp-border-card bg-soundorp-card px-3 py-3">
        <p className="text-sm text-soundorp-muted">
          Add up what your chain costs, set a budget, and see cheaper alternatives for each device
          that keep every compatibility check intact.
        </p>
        <button
          type="button"
          onClick={() => openUpgradeModal('shopping_list')}
          aria-haspopup="dialog"
          className="rounded-md border border-soundorp-red px-3 py-1.5 text-sm font-medium text-soundorp-red hover:bg-soundorp-red/10"
        >
          Unlock the shopping list
        </button>
      </div>
    </section>
  )
}

function ProShoppingList({ devices }: ShoppingListProps) {
  const budget = useChainStore((s) => s.budget)
  const setBudget = useChainStore((s) => s.setBudget)
  const replaceDevice = useChainStore((s) => s.replaceDevice)

  const [budgetText, setBudgetText] = useState(() => (budget === null ? '' : String(budget)))
  const [budgetError, setBudgetError] = useState<string | null>(null)

  const { lines, total, unpricedCount } = buildShoppingList(devices)
  const status = budgetStatus(total, budget)

  function handleBudgetChange(text: string) {
    setBudgetText(text)
    const parsed = parseBudget(text)
    if (parsed.ok) {
      setBudget(parsed.value)
      setBudgetError(null)
    } else {
      // Keep the last good budget in force while the field holds something unusable.
      setBudgetError(parsed.error)
    }
  }

  return (
    <section>
      <h2 className={HEADING_CLASS}>Shopping List</h2>

      {devices.length === 0 ? (
        <p className="text-sm text-soundorp-muted">Add devices to see what your chain costs.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {lines.map((line) => {
            const alternatives = findCheaperAlternatives(devices, line.device.id)
            const { device } = line

            return (
              <div
                key={device.id}
                className="flex flex-col gap-1.5 rounded-md border border-soundorp-border-card bg-soundorp-card px-3 py-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col">
                    <span className="text-sm font-semibold text-soundorp-text">
                      {line.quantity > 1 ? `${line.quantity}× ` : ''}
                      {device.brand} {device.name}
                    </span>
                    {line.quantity > 1 && line.unitPrice !== undefined && (
                      <span className="text-xs text-soundorp-muted">
                        {formatPrice(line.unitPrice)} each
                      </span>
                    )}
                  </div>
                  <span className="shrink-0 text-sm text-soundorp-text">
                    {line.subtotal === undefined ? (
                      <span className="text-soundorp-muted">No price</span>
                    ) : (
                      formatPrice(line.subtotal)
                    )}
                  </span>
                </div>

                {alternatives.length > 0 && (
                  <details open={status?.state === 'over'} className="text-sm">
                    <summary className="cursor-pointer text-xs text-soundorp-muted hover:text-soundorp-text">
                      Cheaper options ({alternatives.length})
                    </summary>
                    <ul className="mt-1.5 flex flex-col gap-1">
                      {alternatives.map(({ to, saving }) => (
                        <li
                          key={to.id}
                          className="flex items-center justify-between gap-2 rounded border border-soundorp-border px-2 py-1"
                        >
                          <span className="min-w-0 text-xs text-soundorp-text">
                            {to.brand} {to.name}
                            <span className="text-soundorp-muted">
                              {' · '}
                              {formatPrice(to.msrp ?? 0)}
                              {' · saves '}
                            </span>
                            <span className="text-status-pass-text">{formatPrice(saving)}</span>
                            {line.quantity > 1 && (
                              <span className="text-soundorp-muted"> each</span>
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={() => replaceDevice(device.id, to.id)}
                            aria-label={`Swap ${device.brand} ${device.name} for ${to.brand} ${to.name}`}
                            className="shrink-0 rounded-md border border-soundorp-border px-2 py-1 text-xs font-medium text-soundorp-muted hover:bg-[#1f1f1f] hover:text-soundorp-text"
                          >
                            Swap
                          </button>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )
          })}

          <div className="flex items-center justify-between gap-3 rounded-md border border-soundorp-border px-3 py-2">
            <span className="text-sm font-semibold text-soundorp-text">Estimated total</span>
            <span className="text-sm font-semibold text-soundorp-text">{formatPrice(total)}</span>
          </div>
          {/* Prices are a dated snapshot, not live: say so right where the money is shown. */}
          <p
            role="note"
            className="border-l-2 border-status-warning-border py-0.5 pl-2 text-xs text-soundorp-text"
          >
            {PRICE_DISCLAIMER}
          </p>
          {unpricedCount > 0 && (
            <p className="text-xs text-soundorp-muted">
              {unpricedCount} device{unpricedCount === 1 ? '' : 's'} without a price{' '}
              {unpricedCount === 1 ? "isn't" : "aren't"} included in the total.
            </p>
          )}

          <p className="text-xs text-soundorp-muted">
            Cheaper options only appear when your chain's compatibility checks stay the same or
            improve.
          </p>
        </div>
      )}

      <div className="mt-3 flex flex-col gap-1.5">
        <label htmlFor="budget" className="text-xs font-semibold text-soundorp-text">
          Budget
        </label>
        <div className="flex items-center gap-2">
          <div className="relative w-40">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-sm text-soundorp-muted"
            >
              $
            </span>
            <input
              id="budget"
              type="text"
              inputMode="decimal"
              value={budgetText}
              onChange={(e) => handleBudgetChange(e.target.value)}
              placeholder="No budget set"
              autoComplete="off"
              aria-invalid={budgetError ? true : undefined}
              aria-describedby={budgetError ? 'budget-error' : undefined}
              className="w-full rounded-md border border-soundorp-border bg-soundorp-bg py-1.5 pl-5 pr-2 text-sm text-soundorp-text outline-none placeholder:text-soundorp-muted focus:border-soundorp-red aria-[invalid=true]:border-status-critical"
            />
          </div>
          {status && devices.length > 0 && !budgetError && (
            <span
              role="status"
              className={
                status.state === 'over'
                  ? 'text-sm font-semibold text-status-warning-text'
                  : 'text-sm font-semibold text-status-pass-text'
              }
            >
              {budgetStatusText(status)}
            </span>
          )}
        </div>
        {budgetError && (
          <p id="budget-error" role="alert" className="text-xs text-status-critical-text">
            {budgetError}
          </p>
        )}
      </div>
    </section>
  )
}
