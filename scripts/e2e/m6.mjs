import { APP_URL, OUT_DIR, launch } from './lib.mjs'
import * as lzModule from 'lz-string'

const lz = lzModule.default ?? lzModule
const APP = APP_URL
const SHOTS = OUT_DIR
const results = []
const check = (name, ok, extra = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + String(extra).slice(0, 300) : ''}`)
}

const browser = await launch()

async function session({ url = APP + '/', viewport = { width: 1200, height: 1400 }, pro = false, noClipboard = false } = {}) {
  const ctx = await browser.newContext({ viewport })
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: APP }).catch(() => {})
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => { if (m.type() === 'error' && !/_vercel|favicon|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()) })
  page.on('dialog', async (d) => { errors.push('DIALOG: ' + d.message()); await d.dismiss() })
  await page.route('**/_vercel/**', (route) => route.abort())
  if (noClipboard)
    await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('blocked')) } }))
  if (pro)
    await page.addInitScript(() => {
      if (!localStorage.getItem('soundorp:signal-chain-builder:license'))
        localStorage.setItem('soundorp:signal-chain-builder:license', JSON.stringify({ licenseKey: 'k', instanceId: 'i' }))
    })
  await page.goto(url)
  async function add(query, label) {
    await page.getByPlaceholder('Search gear…').fill(query)
    await page.getByRole('button', { name: label ?? /^Add .* to chain$/ }).first().click()
    await page.getByPlaceholder('Search gear…').fill('')
  }
  const chainNames = () =>
    page.locator('button[aria-label^="Remove "]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label').replace('Remove ', '')))
  return { ctx, page, errors, add, chainNames }
}

// ============ AUTHOR: build a chain, get the permanent link ============
let publicUrl = ''
let shareUrl = ''
{
  const { ctx, page, errors, add } = await session()

  // a custom device so the link has to carry specs the visitor has never seen
  await page.getByRole('button', { name: /\+ Add custom device/ }).click()
  const dlg = page.getByRole('dialog')
  await dlg.getByLabel('Name', { exact: true }).fill('Guest Condenser')
  await dlg.getByLabel('Brand').fill('Acme')
  await dlg.getByLabel(/Needs 48V phantom power/).check()
  await dlg.getByLabel('Clean gain it needs (dB)').fill('35')
  await dlg.getByRole('button', { name: 'Add device' }).click()

  await add('SM7B'); await add('AudioBox USB 96')
  await page.getByRole('button', { name: 'Add Acme Guest Condenser to chain' }).click()
  await add('Scarlett 2i2 (4th'); await add('HS5')
  await page.locator('input[type="text"]').first().fill('Our podcast rig')

  check('author: Share and Copy permanent link sit side by side', (await page.getByRole('button', { name: 'Share', exact: true }).isVisible()) && (await page.getByRole('button', { name: 'Copy permanent link' }).isVisible()))

  await page.getByRole('button', { name: 'Copy permanent link' }).click()
  check('author: the button confirms the copy', await page.getByRole('button', { name: 'Link copied!' }).waitFor({ timeout: 3000 }).then(() => true, () => false))
  publicUrl = await page.evaluate(() => navigator.clipboard.readText())
  check('author: the permanent link is /c/<chain> on this site', new RegExp('^' + APP.replace(/[.]/g, '\\.') + '/c/[A-Za-z0-9+\\-$]+$').test(publicUrl), publicUrl.slice(0, 90))
  check('author: it is a sensible length', publicUrl.length < 1500, `${publicUrl.length} chars`)

  await page.getByRole('button', { name: 'Share', exact: true }).click().catch(() => {})
  await page.waitForTimeout(100)
  shareUrl = await page.evaluate(() => navigator.clipboard.readText())
  check('author: the existing Share button still copies a ?chain= link', shareUrl.includes('/?chain=') && !shareUrl.includes('/c/'), shareUrl.slice(0, 70))
  check('author: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ---- fallback when the browser refuses the clipboard ----
{
  const { ctx, page, errors, add } = await session({ noClipboard: true })
  await add('SM7B'); await add('Scarlett 2i2 (4th')
  await page.getByRole('button', { name: 'Copy permanent link' }).click()
  const input = page.getByLabel('Link to copy')
  check('fallback: refused clipboard shows the link to copy by hand', (await input.isVisible()) && (await input.inputValue()).includes('/c/'))
  await page.getByRole('button', { name: 'Close' }).click()
  check('fallback: Close dismisses it', (await input.count()) === 0)
  check('fallback: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ============ VISITOR: opens the permanent link in a fresh browser profile ============
{
  const { ctx, page, errors } = await session({ url: publicUrl })
  await page.getByRole('heading', { level: 1 }).waitFor()
  const body = await page.locator('body').innerText()

  check('visitor: shows the chain name as the page heading', (await page.getByRole('heading', { level: 1 }).innerText()) === 'Our podcast rig')
  check('visitor: shows every device, including the author’s custom one', ['SM7B', 'AudioBox USB 96', 'Guest Condenser', 'Scarlett 2i2 (4th Gen)', 'HS5'].every((n) => body.includes(n)))
  check('visitor: the custom device is tagged Custom', /· custom/i.test(body))
  check('visitor: shows the compatibility report with the author’s specs', /compatibility report/i.test(body) && body.includes('Guest Condenser needs about 35dB'))
  check('visitor: shows the cable list', /cables & adapters/i.test(body) && /XLR cable/.test(body))
  check('visitor: shows the written advice, not fix buttons', body.includes('Fix: Add an inline gain booster') && (await page.getByRole('button', { name: /\(\+\d+ dB/ }).count()) === 0)
  check('visitor: says it was shared by a user', body.includes('Shared by a user'))
  check('visitor: has the footer credit', body.includes('Made with the soundorp Signal Chain Builder'))

  check('visitor: read-only - not a single button on the page', (await page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => !b.closest('nav')).length)) === 0, `${await page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => !b.closest('nav')).length)} buttons`)
  check('visitor: nothing to remove, drag or flag', (await page.locator('[aria-label^="Remove"], [aria-label^="Report incorrect"], [aria-roledescription="sortable"]').count()) === 0)
  check('visitor: none of the builder UI is there', (await page.getByPlaceholder('Search gear…').count()) === 0 && (await page.getByText('Saved chains').count()) === 0 && (await page.getByText('Get Pro').count()) === 0 && (await page.getByText('Export PDF').count()) === 0)
  check('visitor: no Pro features leak onto the page', !/Shopping|Estimated total|Budget|\$\d/.test(body))
  check('visitor: the tab title names the chain', (await page.title()).startsWith('Our podcast rig'), await page.title())
  check('visitor: the page asks not to be indexed', (await page.locator('meta[name="robots"]').getAttribute('content')) === 'noindex, nofollow')
  check('visitor: viewing it writes nothing to their storage', (await page.evaluate(() => localStorage.length)) === 0)
  await page.screenshot({ path: SHOTS + 'm6-public.png', fullPage: true })

  // reload, and the trailing-slash form, keep working (single-page-app fallback)
  await page.reload()
  check('visitor: reloading the link works', (await page.getByRole('heading', { level: 1 }).innerText()) === 'Our podcast rig')
  await page.goto(publicUrl + '/')
  check('visitor: a trailing slash works too', (await page.getByRole('heading', { level: 1 }).innerText()) === 'Our podcast rig')

  // open in builder
  const links = page.getByRole('link', { name: /Open (in builder|this chain in the builder)/ })
  check('visitor: two "Open in builder" links', (await links.count()) === 2)
  await links.first().click()
  await page.getByPlaceholder('Search gear…').waitFor()
  check('visitor: Open in builder lands in the editable builder', new URL(page.url()).pathname === '/' && !page.url().includes('chain='))
  const names = await page.locator('button[aria-label^="Remove "]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label').replace('Remove ', '')))
  check('visitor: …with the same chain loaded', JSON.stringify(names) === JSON.stringify(['SM7B', 'AudioBox USB 96', 'Guest Condenser', 'Scarlett 2i2 (4th Gen)', 'HS5']), JSON.stringify(names))
  check('visitor: …named as shared', (await page.locator('input[type="text"]').first().inputValue()) === 'Our podcast rig')
  check('visitor: …and the author’s custom device is in the chain but not in their library', (await page.getByRole('heading', { name: 'My devices' }).count()) === 0)
  check('visitor: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ============ the existing ?chain= link still loads the builder ============
{
  const { ctx, page, errors, chainNames } = await session({ url: shareUrl })
  await page.getByPlaceholder('Search gear…').waitFor()
  const names = await chainNames()
  check('legacy: a ?chain= link still opens the builder with the chain', names.includes('Guest Condenser') && names.length === 5, JSON.stringify(names))
  check('legacy: and is not mistaken for a public page', (await page.getByRole('heading', { level: 1 }).innerText()).includes('Signal Chain Builder'))
  check('legacy: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ============ invalid and look-alike addresses ============
for (const [label, path, expectInvalid] of [
  ['garbage', '/c/not-a-real-chain', true],
  ['an escape that decodes to nonsense', '/c/%25%25', true],
  ['wrong version payload', '/c/' + lz.compressToEncodedURIComponent(JSON.stringify({ v: 9, n: 'x', d: [] })), true],
]) {
  const { ctx, page, errors } = await session({ url: APP + path })
  await page.getByRole('heading', { level: 1 }).waitFor()
  const h1 = await page.getByRole('heading', { level: 1 }).innerText()
  check(`invalid (${label}): friendly page, not a crash or the builder`, expectInvalid && h1 === "This link isn't valid" && (await page.getByPlaceholder('Search gear…').count()) === 0, h1)
  check(`invalid (${label}): offers a way back to the builder`, (await page.getByRole('link', { name: 'Open the builder' }).getAttribute('href')) === '/')
  check(`invalid (${label}): no page errors`, errors.length === 0, errors.join('; '))
  await ctx.close()
}
for (const path of ['/c/', '/c', '/c/abc/def']) {
  const { ctx, page } = await session({ url: APP + path })
  await page.getByPlaceholder('Search gear…').waitFor()
  check(`look-alike ${path}: opens the builder, not a public page`, true)
  await ctx.close()
}

// ============ a hostile link ============
{
  const evil = '<img src=x onerror="window.__pwned=1"><script>window.__pwned=2</script>\u202Eexe.gnp' + 'Z'.repeat(5000)
  const payload = lz.compressToEncodedURIComponent(JSON.stringify({ v: 1, n: evil, d: ['shure-sm7b', 'focusrite-scarlett-2i2-4gen'] }))
  const { ctx, page, errors } = await session({ url: `${APP}/c/${payload}` })
  await page.getByRole('heading', { level: 1 }).waitFor()
  const h1 = await page.getByRole('heading', { level: 1 }).innerText()
  check('hostile: no script or handler ran', (await page.evaluate(() => window.__pwned)) === undefined)
  check('hostile: no injected elements', (await page.locator('main img, h1 img, h1 script, body img[src="x"]').count()) === 0)
  check('hostile: the name is shown as plain text', h1.startsWith('<img src=x'), h1.slice(0, 40))
  check('hostile: …capped at 120 characters', h1.length <= 120, `${h1.length}`)
  check('hostile: …without the direction override', !h1.includes('\u202E'))
  check('hostile: no dialogs or page errors', errors.length === 0, errors.join('; '))
  await page.screenshot({ path: SHOTS + 'm6-hostile.png' })
  await ctx.close()
}

// ============ small screens ============
{
  const many = ['shure-sm7b', 'presonus-audiobox-usb-96', 'focusrite-scarlett-2i2-4gen', 'yamaha-hs5', 'shure-sm58', 'sony-mdr7506']
  const payload = lz.compressToEncodedURIComponent(JSON.stringify({ v: 1, n: 'A fairly long chain name that has to wrap properly on a phone screen', d: many }))
  const { ctx, page, errors } = await session({ url: `${APP}/c/${payload}`, viewport: { width: 390, height: 800 } })
  await page.getByRole('heading', { level: 1 }).waitFor()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check('mobile: no sideways scrolling on a 6-device chain at 390px', overflow <= 1, `overflow ${overflow}px`)
  check('mobile: the Open in builder link is visible', await page.getByRole('link', { name: 'Open in builder' }).isVisible())
  await page.screenshot({ path: SHOTS + 'm6-mobile.png', fullPage: true })
  check('mobile: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ============ both tiers see the same free page ============
{
  const { ctx, page } = await session({ url: publicUrl, pro: true })
  await page.getByRole('heading', { level: 1 }).waitFor()
  check('pro visitor: sees the same read-only page (no builder, no buttons)', (await page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => !b.closest('nav')).length)) === 0 && (await page.getByPlaceholder('Search gear…').count()) === 0)
  await ctx.close()
}

await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
