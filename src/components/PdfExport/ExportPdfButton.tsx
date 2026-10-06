import { useRef, useState } from 'react'
import { useChainStore } from '../../store/useChainStore'
import { MIN_DEVICES_FOR_EXPORT } from '../../lib/pdfLayout'
import { Popover } from '../Popover/Popover'

export function ExportPdfButton() {
  const currentChain = useChainStore((s) => s.currentChain)
  const customLibrary = useChainStore((s) => s.customDevices)
  const budget = useChainStore((s) => s.budget)
  const [exporting, setExporting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  async function handleExport() {
    // The heavy export module (html2canvas + jsPDF) is only fetched below, on demand.
    if (currentChain.deviceIds.length < MIN_DEVICES_FOR_EXPORT) {
      setMessage('Add at least two devices to export a compatibility report.')
      return
    }

    setMessage(null)
    setExporting(true)
    try {
      const { exportChainPdf } = await import('../../lib/exportChainPdf')
      await exportChainPdf(currentChain, { customLibrary, budget })
    } catch (err) {
      console.error('[export-pdf]', err)
      setMessage("Couldn't create the PDF. Please try again.")
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleExport}
        disabled={exporting}
        className="rounded-md border border-soundorp-border px-3 py-1.5 text-sm font-medium text-soundorp-muted hover:bg-[#1f1f1f] hover:text-soundorp-text disabled:opacity-60"
      >
        {exporting ? 'Exporting…' : 'Export PDF'}
      </button>
      <Popover
        open={message !== null}
        onClose={() => setMessage(null)}
        anchorRef={buttonRef}
        label="Export PDF"
        widthClass="w-72"
        surfaceClass="border-status-warning-border bg-status-warning-bg"
      >
        <p className="text-xs text-status-warning-text">{message}</p>
        <button
          type="button"
          onClick={() => setMessage(null)}
          className="mt-2 rounded-md border border-soundorp-border px-2 py-1 text-xs font-medium text-soundorp-muted hover:bg-[#1f1f1f] hover:text-soundorp-text"
        >
          Dismiss
        </button>
      </Popover>
    </div>
  )
}
