import { useState, type FormEvent } from 'react'
import { useChainStore } from '../../store/useChainStore'

interface LicenseKeyFormProps {
  onCancel?: () => void
  onActivated?: () => void
  autoFocus?: boolean
}

export function LicenseKeyForm({ onCancel, onActivated, autoFocus }: LicenseKeyFormProps) {
  const activateLicense = useChainStore((s) => s.activateLicense)
  const licenseError = useChainStore((s) => s.licenseError)
  const clearLicenseError = useChainStore((s) => s.clearLicenseError)
  const isActivating = useChainStore((s) => s.isActivatingLicense)

  const [licenseKey, setLicenseKey] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const ok = await activateLicense(licenseKey)
    if (ok) {
      setLicenseKey('')
      onActivated?.()
    }
  }

  return (
    <>
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
          autoFocus={autoFocus}
          className="w-full rounded-md border border-soundorp-border bg-soundorp-bg px-2 py-1 text-xs text-soundorp-text outline-none focus:border-soundorp-red"
        />
        <div className="flex justify-end gap-1.5">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-soundorp-border px-2 py-1 text-xs font-medium text-soundorp-muted hover:bg-[#1f1f1f] hover:text-soundorp-text"
            >
              Cancel
            </button>
          )}
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
    </>
  )
}
