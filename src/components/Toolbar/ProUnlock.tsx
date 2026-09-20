import { useState, type FormEvent } from 'react'
import { useChainStore } from '../../store/useChainStore'
import { CHECKOUT_URL } from '../../lib/licensing'

export function ProUnlock() {
  const isPro = useChainStore((s) => s.isPro)
  const activateLicense = useChainStore((s) => s.activateLicense)
  const licenseError = useChainStore((s) => s.licenseError)
  const clearLicenseError = useChainStore((s) => s.clearLicenseError)
  const isActivating = useChainStore((s) => s.isActivatingLicense)

  const [open, setOpen] = useState(false)
  const [licenseKey, setLicenseKey] = useState('')

  if (isPro) {
    return (
      <span className="rounded-md border border-green-600 bg-green-900/40 px-3 py-1.5 text-sm font-medium text-green-400">
        Pro ✓
      </span>
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const ok = await activateLicense(licenseKey)
    if (ok) {
      setOpen(false)
      setLicenseKey('')
    }
  }

  function handleToggle() {
    clearLicenseError()
    setOpen((v) => !v)
  }

  return (
    <>
      <a
        href={CHECKOUT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-md border border-soundorp-red px-3 py-1.5 text-sm font-medium text-soundorp-red hover:bg-soundorp-red/10"
      >
        Get Pro
      </a>
      <div className="relative">
        <button
          type="button"
          onClick={handleToggle}
          className={
            open
              ? 'rounded-md border border-soundorp-border bg-[#2a2a2a] px-3 py-1.5 text-sm font-medium text-soundorp-text'
              : 'rounded-md border border-soundorp-border px-3 py-1.5 text-sm font-medium text-soundorp-muted hover:bg-[#1f1f1f] hover:text-soundorp-text'
          }
        >
          I have a key
        </button>
        {open && (
          <div className="absolute right-0 top-full z-20 mt-2 w-80 rounded-xl border border-soundorp-border bg-soundorp-panel p-3 shadow-lg">
            <form onSubmit={handleSubmit} className="flex flex-col gap-2">
              <p className="text-xs text-soundorp-muted">
                Paste the license key from your purchase email to unlock Pro.
              </p>
              <input
                type="text"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
                autoComplete="off"
                spellCheck={false}
                autoFocus
                className="w-full rounded-md border border-soundorp-border bg-soundorp-bg px-2 py-1 text-xs text-soundorp-text outline-none focus:border-soundorp-red"
              />
              <div className="flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={handleToggle}
                  className="rounded-md border border-soundorp-border px-2 py-1 text-xs font-medium text-soundorp-muted hover:bg-[#1f1f1f] hover:text-soundorp-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isActivating}
                  className="rounded-md bg-soundorp-red px-2 py-1 text-xs font-medium text-white hover:bg-soundorp-red/90 disabled:opacity-60"
                >
                  {isActivating ? 'Activating…' : 'Activate'}
                </button>
              </div>
            </form>
            {licenseError && (
              <div className="mt-2 rounded-lg border border-status-warning-border bg-status-warning-bg p-2">
                <p className="text-xs text-status-warning-text">{licenseError}</p>
                <button
                  type="button"
                  onClick={clearLicenseError}
                  className="mt-2 rounded-md border border-soundorp-border px-2 py-1 text-xs font-medium text-soundorp-muted hover:bg-[#1f1f1f] hover:text-soundorp-text"
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
