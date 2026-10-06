import { APP_URL, OUT_DIR, launch } from './lib.mjs'

const APP = APP_URL + '/'
const SHOTS = OUT_DIR
const results = []
const check = (name, ok, extra = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`)
}

const browser = await launch()

async function newPage(licenseResponse) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  const activateBodies = []
  await page.route('https://api.lemonsqueezy.com/**', async (route) => {
    activateBodies.push(route.request().postData())
    await route.fulfill({
      status: licenseResponse.status,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(licenseResponse.body),
    })
  })
  // Don't let analytics hit the network.
  await page.route('**/_vercel/**', (route) => route.abort())
  return { ctx, page, errors, activateBodies }
}

// ---------- FREE USER ----------
{
  const { ctx, page, errors, activateBodies } = await newPage({
    status: 404,
    body: { activated: false, error: 'license_key not found.' },
  })
  await page.goto(APP)
  const exportBtn = page.getByRole('button', { name: /Export PDF/ })
  check('free: Export PDF button is visible', await exportBtn.isVisible())
  check('free: it carries a PRO badge', (await exportBtn.innerText()).toUpperCase().includes('PRO'))
  check('free: no modal initially', (await page.getByRole('dialog').count()) === 0)

  await exportBtn.click()
  const dialog = page.getByRole('dialog')
  check('free: click opens the upgrade modal', await dialog.isVisible())
  check('free: modal names the feature', (await dialog.innerText()).includes('PDF export is a Pro feature'))
  check('free: modal lists benefits', (await dialog.innerText()).includes('Unlimited saved chains'))
  const href = await dialog.getByRole('link', { name: 'Get Pro' }).getAttribute('href')
  check('free: Get Pro links to checkout', href?.startsWith('https://soundorp.lemonsqueezy.com/checkout/'), href)
  await page.screenshot({ path: SHOTS + 'm0-free-modal.png' })

  await page.keyboard.press('Escape')
  check('free: Escape closes modal', (await page.getByRole('dialog').count()) === 0)

  await exportBtn.click()
  await page.mouse.click(10, 10) // backdrop
  check('free: backdrop click closes modal', (await page.getByRole('dialog').count()) === 0)

  await exportBtn.click()
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click()
  check('free: X button closes modal', (await page.getByRole('dialog').count()) === 0)

  // clicking inside the panel must not close it
  await exportBtn.click()
  await page.getByRole('dialog').getByText('Pro includes').click()
  check('free: click inside panel keeps modal open', await page.getByRole('dialog').isVisible())

  // bad key from modal
  await page.getByRole('dialog').getByPlaceholder('XXXXXXXX').fill('bad-key')
  await page.getByRole('dialog').getByRole('button', { name: 'Activate' }).click()
  await page.getByText("wasn't recognised").waitFor()
  check('free: bad key shows error and keeps modal open', await page.getByRole('dialog').isVisible())
  check('free: bad key leaves user free', (await page.evaluate(() => localStorage.getItem('soundorp:signal-chain-builder:license'))) === null)
  await page.screenshot({ path: SHOTS + 'm0-free-badkey.png' })
  check('free: activation request was sent', activateBodies.length === 1 && activateBodies[0].includes('license_key=bad-key'))

  // toolbar "I have a key" popover still works (refactored onto the shared form)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'I have a key' }).click()
  check('free: toolbar key popover opens', await page.getByPlaceholder('XXXXXXXX').isVisible())
  await page.getByRole('button', { name: 'Cancel' }).click()
  check('free: toolbar popover Cancel closes it', (await page.getByPlaceholder('XXXXXXXX').count()) === 0)

  check('free: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ---------- ACTIVATE FROM MODAL -> PRO ----------
{
  const { ctx, page, errors } = await newPage({
    status: 200,
    body: { activated: true, license_key: { status: 'active', expires_at: null }, instance: { id: 'inst-1' }, meta: { store_id: 478732, product_id: 1374387 } },
  })
  await page.goto(APP)
  await page.getByRole('button', { name: /Export PDF/ }).click()
  await page.getByRole('dialog').getByPlaceholder('XXXXXXXX').fill('good-key')
  await page.getByRole('dialog').getByRole('button', { name: 'Activate' }).click()
  await page.getByText('Pro ✓').waitFor()
  check('activate from modal: modal closes', (await page.getByRole('dialog').count()) === 0)
  check('activate from modal: Pro badge shown', await page.getByText('Pro ✓').isVisible())
  const exportBtn = page.getByRole('button', { name: /Export PDF/ })
  check('activate from modal: Export PDF no longer shows PRO badge', !(await exportBtn.innerText()).toUpperCase().includes('PRO'))
  check('activate from modal: Get Pro link gone', (await page.getByRole('link', { name: 'Get Pro' }).count()) === 0)
  await exportBtn.click()
  check('activate from modal: Export PDF now runs real flow (needs-2-devices message, no modal)',
    // "no modal": the message itself is a small non-modal popover (role=dialog, no aria-modal).
    (await page.getByText('Add at least two devices to export').isVisible()) && (await page.locator('[aria-modal="true"]').count()) === 0)
  await page.screenshot({ path: SHOTS + 'm0-pro.png' })

  await page.reload()
  await page.getByText('Pro ✓').waitFor()
  check('pro persists across reload', await page.getByText('Pro ✓').isVisible())
  check('no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ---------- PRO: real PDF export still works ----------
{
  const { ctx, page, errors } = await newPage({ status: 404, body: {} })
  await page.addInitScript(() =>
    localStorage.setItem('soundorp:signal-chain-builder:license', JSON.stringify({ licenseKey: 'k', instanceId: 'i' })),
  )
  await page.goto(APP)
  const addButtons = page.getByRole('button', { name: /^Add/ })
  await addButtons.nth(0).click()
  await addButtons.nth(1).click()
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30000 }),
    page.getByRole('button', { name: /Export PDF/ }).click(),
  ])
  check('pro: PDF download still works', download.suggestedFilename().endsWith('.pdf'), download.suggestedFilename())
  check('pro: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
