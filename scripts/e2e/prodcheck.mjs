import { OUT_DIR, launch } from './lib.mjs'
import fs from 'node:fs'

// Usage: node scripts/e2e/prodcheck.mjs   (ORIGIN=https://... to point elsewhere)
// Verifies the deployed app in a real browser. Read-only; analytics requests are blocked.
const links = JSON.parse(fs.readFileSync(new URL('./fixtures/prod-links.json', import.meta.url), 'utf8'))
const ORIGIN = (process.env.ORIGIN || 'https://app.soundorp.com').replace(/\/$/, '')
const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + String(extra).slice(0, 200) : ''}`)
}

const browser = await launch()
async function open(path, { pro = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 1400 }, acceptDownloads: true })
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ORIGIN }).catch(() => {})
  if (pro)
    await ctx.addInitScript(() =>
      localStorage.setItem('soundorp:signal-chain-builder:license', JSON.stringify({ licenseKey: 'k', instanceId: 'i' })),
    )
  const page = await ctx.newPage()
  const errors = []
  const requests = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => {
    if (m.type() === 'error' && !/_vercel|favicon|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text())
  })
  page.on('request', (r) => requests.push(r.url()))
  // Keep my test visits out of the site's analytics.
  await page.route('**/_vercel/**', (route) => route.abort())
  const res = await page.goto(ORIGIN + path)
  return { ctx, page, errors, requests, res }
}

// 1. the builder loads and works
{
  const { ctx, page, errors, res } = await open('/')
  await page.getByPlaceholder('Search gear…').waitFor({ timeout: 20000 })
  const bundle = (await page.content()).match(/\/assets\/index-[A-Za-z0-9_-]+\.js/)?.[0]
  check('builder at / loads (HTTP 200, UI rendered)', res.status() === 200 && (await page.getByRole('button', { name: 'Copy permanent link' }).isVisible()))
  check('builder: serving the bundle', !!bundle, bundle)
  check('builder: no console or page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// 2. Pro flow: build a chain and export a PDF on the live site (loads the lazy PDF chunk)
{
  const { ctx, page, errors, requests } = await open('/', { pro: true })
  await page.getByPlaceholder('Search gear…').waitFor({ timeout: 20000 })
  const add = async (q) => {
    await page.getByPlaceholder('Search gear…').fill(q)
    await page.getByRole('button', { name: /^Add .* to chain$/ }).first().click()
    await page.getByPlaceholder('Search gear…').fill('')
  }
  await add('SM7B'); await add('Scarlett 2i2 (4th'); await add('HS5')
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60000 }),
    page.getByRole('button', { name: /Export PDF/ }).click(),
  ])
  const path = OUT_DIR + 'prodcheck.pdf'
  await download.saveAs(path)
  const buf = fs.readFileSync(path)
  check('LIVE PDF export: downloads a real PDF (lazy chunk loaded and ran)', buf.subarray(0, 5).toString() === '%PDF-' && buf.length > 20000, `${download.suggestedFilename()}, ${buf.length} bytes`)
  check('LIVE PDF export: the lazy chunk was fetched from the production origin', requests.some((u) => /app\.soundorp\.com\/assets\/exportChainPdf-[A-Za-z0-9_-]+\.js/.test(u)), requests.find((u) => /exportChainPdf/.test(u)))
  check('LIVE PDF export: no errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// 3. Free-tier gating on the live site
{
  const { ctx, page, errors } = await open('/')
  await page.getByPlaceholder('Search gear…').waitFor({ timeout: 20000 })
  await page.getByPlaceholder('Search gear…').fill('SM7B')
  await page.getByRole('button', { name: /^Add .* to chain$/ }).first().click()
  await page.getByRole('button', { name: /Export PDF/ }).click()
  check('LIVE free tier: Export PDF opens the upgrade modal (gating intact)', (await page.getByRole('dialog').innerText()).includes('PDF export is a Pro feature'))
  check('LIVE free tier: no errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// 4. the public chain page, headers included
{
  const { ctx, page, errors, res } = await open('/c/' + links.v2)
  await page.getByRole('heading', { level: 1 }).waitFor({ timeout: 20000 })
  const body = await page.locator('body').innerText()
  check('LIVE /c/<v2>: HTTP 200 and the public page renders with the embedded custom device', res.status() === 200 && body.includes('Prod Test Mic'))
  check('LIVE /c/<v2>: X-Robots-Tag: noindex, nofollow on the navigation response', res.headers()['x-robots-tag'] === 'noindex, nofollow', res.headers()['x-robots-tag'])
  check('LIVE /c/<v2>: read-only (no buttons)', (await page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => !b.closest('nav')).length)) === 0)
  check('LIVE /c/<v2>: no errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

await browser.close()
console.log(`\n${results.filter(Boolean).length}/${results.length} live browser checks passed`)
process.exit(results.every(Boolean) ? 0 : 1)
