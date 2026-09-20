export const MIN_DEVICES_FOR_EXPORT = 2

export interface PageSlice {
  start: number
  end: number
}

/** "Signal Chain #1!" -> "signal-chain-1"; falls back to "untitled" if nothing usable is left. */
export function slugifyChainName(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug === '' ? 'untitled' : slug
}

export function pdfFileName(chainName: string): string {
  return `signal-chain-${slugifyChainName(chainName)}.pdf`
}

/**
 * Splits a tall layout into page-sized slices, preferring to cut at the given
 * break points (tops of blocks) so a device row or check isn't sliced through
 * the middle. If no break point falls inside a page, or one block is taller
 * than a page, it hard-cuts at the page boundary.
 *
 * All values share one unit (px). `breakPoints` need not be sorted.
 */
export function computePageSlices(
  breakPoints: number[],
  totalHeight: number,
  pageHeight: number,
): PageSlice[] {
  if (totalHeight <= 0 || pageHeight <= 0) return []
  const sorted = [...breakPoints].sort((a, b) => a - b)
  const slices: PageSlice[] = []
  let start = 0

  while (start < totalHeight) {
    const limit = start + pageHeight
    if (limit >= totalHeight) {
      slices.push({ start, end: totalHeight })
      break
    }
    let end = limit
    for (const b of sorted) {
      if (b > start && b <= limit) end = b
    }
    slices.push({ start, end })
    start = end
  }

  return slices
}
