import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { getDeviceById } from '../data/devices'
import type { SignalChain } from '../data/devices.schema'
import { evaluateChain } from '../engine/evaluateChain'
import { ChainPrintLayout, PRINT_LAYOUT_WIDTH_PX } from '../components/PdfExport/ChainPrintLayout'
import { MIN_DEVICES_FOR_EXPORT, computePageSlices, pdfFileName } from './pdfLayout'

// A4 in mm, and the same page expressed in layout px (the print layout is 794px = 210mm wide).
const PAGE_WIDTH_MM = 210
const PAGE_HEIGHT_MM = 297
const MM_PER_PX = PAGE_WIDTH_MM / PRINT_LAYOUT_WIDTH_PX
const PAGE_HEIGHT_PX = PAGE_HEIGHT_MM / MM_PER_PX
const PAGE_MARGIN_PX = 40
const CAPTURE_SCALE = 2
const PAGE_IMAGE_QUALITY = 0.95

/**
 * Renders the static print layout off-screen, captures it with html2canvas, and
 * downloads it as a (multi-page) A4 PDF. The live interactive UI is never captured.
 */
export async function exportChainPdf(chain: SignalChain): Promise<void> {
  const devices = chain.deviceIds.map((id) => getDeviceById(id)).filter((d) => d !== undefined)
  if (devices.length < MIN_DEVICES_FOR_EXPORT) {
    throw new Error('Add at least two devices to export a compatibility report.')
  }
  const connections = evaluateChain(devices)

  const container = document.createElement('div')
  container.setAttribute('aria-hidden', 'true')
  Object.assign(container.style, {
    position: 'fixed',
    top: '0',
    left: '-10000px',
    pointerEvents: 'none',
  })
  document.body.appendChild(container)
  const root = createRoot(container)

  try {
    flushSync(() =>
      root.render(
        <ChainPrintLayout
          chainName={chain.name}
          devices={devices}
          connections={connections}
          generatedAt={new Date()}
        />,
      ),
    )
    // Let web fonts (Orbitron) settle so the capture doesn't use fallback metrics.
    await document.fonts?.ready

    const layout = container.firstElementChild as HTMLElement
    const layoutRect = layout.getBoundingClientRect()
    // Where each page may break, in layout px measured from the top of the layout.
    const breakPoints = Array.from(layout.querySelectorAll('[data-pdf-break]')).map(
      (el) => el.getBoundingClientRect().top - layoutRect.top,
    )

    const canvas = await html2canvas(layout, {
      scale: CAPTURE_SCALE,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
    })

    const pxScale = canvas.height / layoutRect.height
    const contentHeightPx = PAGE_HEIGHT_PX - 2 * PAGE_MARGIN_PX
    const slices = computePageSlices(breakPoints, layoutRect.height, contentHeightPx)

    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
    slices.forEach((slice, i) => {
      const srcY = Math.round(slice.start * pxScale)
      const srcH = Math.min(Math.round((slice.end - slice.start) * pxScale), canvas.height - srcY)
      if (srcH <= 0) return

      const pageCanvas = document.createElement('canvas')
      pageCanvas.width = canvas.width
      pageCanvas.height = srcH
      const ctx = pageCanvas.getContext('2d')
      if (!ctx) throw new Error('Could not prepare the PDF page.')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
      ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH)

      if (i > 0) pdf.addPage()
      // JPEG, not PNG: jsPDF embeds JPEGs as-is, whereas PNGs are either stored as raw
      // pixels (~7MB/page) or re-encoded in JS (~30s/page). The page is filled white above.
      pdf.addImage(
        pageCanvas.toDataURL('image/jpeg', PAGE_IMAGE_QUALITY),
        'JPEG',
        0,
        PAGE_MARGIN_PX * MM_PER_PX,
        PAGE_WIDTH_MM,
        (srcH / pxScale) * MM_PER_PX,
      )
    })

    pdf.save(pdfFileName(chain.name))
  } finally {
    root.unmount()
    container.remove()
  }
}
