import { APP_URL, OUT_DIR, launch } from './lib.mjs'
import fs from 'node:fs'

const APP = APP_URL + '/'
const OUT = OUT_DIR
const results = []
const check = (name, ok, extra = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`)
}

const browser = await launch()

async function session({ pro = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 1500 }, acceptDownloads: true })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => { if (m.type() === 'error' && !/_vercel|favicon|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()) })
  await page.route('**/_vercel/**', (route) => route.abort())
  if (pro)
    await page.addInitScript(() => {
      if (!localStorage.getItem('soundorp:signal-chain-builder:license'))
        localStorage.setItem('soundorp:signal-chain-builder:license', JSON.stringify({ licenseKey: 'k', instanceId: 'i' }))
    })
  await page.goto(APP)
  async function add(query) {
    await page.getByPlaceholder('Search gear…').fill(query)
    await page.getByRole('button', { name: /^Add .* to chain$/ }).first().click()
    await page.getByPlaceholder('Search gear…').fill('')
  }
  async function exportPdf(file) {
    const t0 = Date.now()
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 60000 }),
      page.getByRole('button', { name: /Export PDF/ }).click(),
    ])
    const path = OUT + file
    await download.saveAs(path)
    return { path, name: download.suggestedFilename(), ms: Date.now() - t0 }
  }
  return { ctx, page, errors, add, exportPdf }
}

// Each page is one JPEG embedded as-is by jsPDF, so the page images can be lifted straight out of the file.
function pdfPages(path) {
  const buf = fs.readFileSync(path)
  const text = buf.toString('latin1')
  const pageObjects = (text.match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length
  const images = []
  let i = 0
  while ((i = buf.indexOf(Buffer.from([0xff, 0xd8, 0xff]), i)) !== -1) {
    const end = buf.indexOf('endstream', i)
    const stop = buf.lastIndexOf(Buffer.from([0xff, 0xd9]), end)
    const out = path.replace(/\.pdf$/, `-p${images.length + 1}.jpg`)
    fs.writeFileSync(out, buf.subarray(i, stop + 2))
    images.push(out)
    i = end
  }
  return { pageObjects, images, bytes: buf.length, header: text.slice(0, 8) }
}

// ============ short chain: 3 devices, budget set ============
{
  const { ctx, page, errors, add, exportPdf } = await session()
  await add('SM7B'); await add('Scarlett 2i2 (4th'); await add('HS5')
  await page.getByLabel('Budget').fill('600')
  const pdf = await exportPdf('m5-short.pdf')
  const info = pdfPages(pdf.path)
  check('short: downloads a PDF with the usual name', pdf.name === 'signal-chain-untitled-chain.pdf', pdf.name)
  check('short: it is a real PDF', info.header.startsWith('%PDF-') && info.bytes > 20_000, `${info.bytes} bytes, ${pdf.ms} ms`)
  check('short: at least one page, one image per page', info.pageObjects >= 1 && info.images.length === info.pageObjects, `${info.pageObjects} pages / ${info.images.length} images`)
  check('short: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ============ long chain: forces several pages, mixes everything the PDF can show ============
{
  const { ctx, page, errors, add, exportPdf } = await session()

  // a custom device with a price, and one without
  await page.getByRole('button', { name: /\+ Add custom device/ }).click()
  const dlg = page.getByRole('dialog')
  await dlg.getByLabel('Name', { exact: true }).fill('Priced Custom Mic')
  await dlg.getByLabel('Price (USD)').fill('180')
  await dlg.getByRole('button', { name: 'Add device' }).click()
  await page.getByRole('button', { name: /\+ Add custom device/ }).click()
  await dlg.getByLabel('Name', { exact: true }).fill('Unpriced Custom Mic')
  await dlg.getByRole('button', { name: 'Add device' }).click()

  for (const q of ['SM7B', 'AudioBox USB 96']) await add(q)
  await page.getByRole('button', { name: /^Add Triton Audio FetHead \(\+/ }).click() // an in-chain fix
  for (const q of ['Scarlett 2i2 (4th', 'HS5', 'SM58', 'SM58', 'Scarlett 2i2 (4th', 'PodTrak P4', 'HS5', 'SM7B', 'U-Phoria UM2', 'HS5']) await add(q)
  await page.getByRole('button', { name: 'Add Custom Priced Custom Mic to chain' }).click()
  await page.getByRole('button', { name: 'Add Custom Unpriced Custom Mic to chain' }).click()
  await page.getByLabel('Budget').fill('300')

  const names = await page.locator('button[aria-label^="Remove "]').count()
  const pdf = await exportPdf('m5-long.pdf')
  const info = pdfPages(pdf.path)
  check('long: the chain really is long', names >= 15, `${names} devices`)
  check('long: export finishes in a reasonable time', pdf.ms < 45000, `${pdf.ms} ms`)
  check('long: several pages, one image per page', info.pageObjects >= 3 && info.images.length === info.pageObjects, `${info.pageObjects} pages / ${info.images.length} images`)
  check('long: no page errors', errors.length === 0, errors.join('; '))
  console.log('PAGES:', info.images.join(' | '))
  await ctx.close()
}

// ============ the PDF follows the screen: no budget, no budget wording; free users cannot export ============
{
  const { ctx, add, exportPdf, errors } = await session()
  await add('SM7B'); await add('Scarlett 2i2 (4th')
  const pdf = await exportPdf('m5-nobudget.pdf')
  check('no budget: still exports', pdfPages(pdf.path).pageObjects >= 1)
  check('no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()

  const free = await session({ pro: false })
  await free.add('SM7B'); await free.add('Scarlett 2i2 (4th')
  const btn = free.page.getByRole('button', { name: /Export PDF/ })
  await btn.click()
  check('free: Export PDF still opens the upgrade modal, not a download', (await free.page.getByRole('dialog').innerText()).includes('PDF export is a Pro feature'))
  await free.ctx.close()
}

await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
