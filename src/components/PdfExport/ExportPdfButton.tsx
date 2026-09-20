import { useState } from 'react'
import { useChainStore } from '../../store/useChainStore'
import { MIN_DEVICES_FOR_EXPORT } from '../../lib/pdfLayout'

export function ExportPdfButton() {
  const currentChain = useChainStore((s) => s.currentChain)
  const [exporting, setExporting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

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
      await exportChainPdf(currentChain)
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
        type="button"
        onClick={handleExport}
        disabled={exporting}
        className="rounded-md border border-soundorp-border px-3 py-1.5 text-sm font-medium text-soundorp-muted hover:bg-[#1f1f1f] hover:text-soundorp-text disabled:opacity-60"
      >
        {exporting ? 'Exporting…' : 'Export PDF'}
      </button>
      {message && (
        <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-xl border border-status-warning-border bg-status-warning-bg p-3 shadow-lg">
          <p className="text-xs text-status-warning-text">{message}</p>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="mt-2 rounded-md border border-soundorp-border px-2 py-1 text-xs font-medium text-soundorp-muted hover:bg-[#1f1f1f] hover:text-soundorp-text"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  )
}
