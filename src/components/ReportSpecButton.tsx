import { useState, type FormEvent } from 'react'
import type { Device } from '../data/devices.schema'

// TODO: point this at whichever inbox soundorp wants spec reports to land in.
const SPEC_REPORT_EMAIL = 'specs@soundorp.com'

interface ReportSpecButtonProps {
  device: Device
  className?: string
}

export function ReportSpecButton({ device, className }: ReportSpecButtonProps) {
  const [open, setOpen] = useState(false)
  const [field, setField] = useState('')
  const [comment, setComment] = useState('')
  const [sent, setSent] = useState(false)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()

    const report = { deviceId: device.id, deviceName: `${device.brand} ${device.name}`, field, comment }
    // No backend for spec reports yet — log for local visibility and hand
    // off to the user's email client so nothing is silently lost.
    console.log('[report-spec]', report)

    const subject = `Incorrect spec: ${report.deviceName} (${device.id})`
    const body = [
      `Device: ${report.deviceName} (${device.id})`,
      `Field: ${field || '(not specified)'}`,
      '',
      comment || '(no additional comment)',
    ].join('\n')
    window.location.href = `mailto:${SPEC_REPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`

    setSent(true)
    setTimeout(() => {
      setOpen(false)
      setSent(false)
      setField('')
      setComment('')
    }, 1200)
  }

  return (
    <div className={`relative ${className ?? ''}`}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        title="Report incorrect spec"
        aria-label={`Report incorrect spec for ${device.brand} ${device.name}`}
        className="flex h-5 w-5 items-center justify-center rounded text-xs text-soundorp-muted hover:text-status-warning-text"
      >
        🚩
      </button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-full z-30 mt-2 w-64 rounded-xl border border-soundorp-border bg-soundorp-panel p-3 shadow-lg"
        >
          {sent ? (
            <p className="text-xs text-status-pass-text">Thanks — report noted.</p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-2">
              <p className="text-xs font-medium text-soundorp-text">
                Report incorrect spec for {device.brand} {device.name}
              </p>
              <input
                type="text"
                value={field}
                onChange={(e) => setField(e.target.value)}
                placeholder="Which field is wrong? (e.g. maxPreampGain)"
                className="w-full rounded-md border border-soundorp-border bg-soundorp-bg px-2 py-1 text-xs text-soundorp-text outline-none focus:border-soundorp-red"
              />
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Optional comment"
                rows={2}
                className="w-full resize-none rounded-md border border-soundorp-border bg-soundorp-bg px-2 py-1 text-xs text-soundorp-text outline-none focus:border-soundorp-red"
              />
              <div className="flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-soundorp-border px-2 py-1 text-xs font-medium text-soundorp-muted hover:bg-[#1f1f1f] hover:text-soundorp-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-soundorp-red px-2 py-1 text-xs font-medium text-white hover:bg-soundorp-red/90"
                >
                  Send
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
