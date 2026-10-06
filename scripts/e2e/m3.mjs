import { APP_URL, OUT_DIR, launch } from './lib.mjs'

const APP = APP_URL + '/'
const SHOTS = OUT_DIR
const results = []
const check = (name, ok, extra = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`)
}

const browser = await launch()

async function session({ pro = false, url = APP } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 1300 } })
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(APP).origin }).catch(() => {})
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.route('**/_vercel/**', (route) => route.abort())
  if (pro)
    await page.addInitScript(() => {
      if (!localStorage.getItem('soundorp:signal-chain-builder:license'))
        localStorage.setItem('soundorp:signal-chain-builder:license', JSON.stringify({ licenseKey: 'k', instanceId: 'i' }))
    })
  await page.goto(url)
  const report = page.locator('section', { has: page.getByRole('heading', { name: 'Compatibility Report' }) })
  const cables = page.locator('section', { has: page.getByRole('heading', { name: 'Cables & Adapters' }) })
  const dialog = page.getByRole('dialog')
  const chainNames = () =>
    page.locator('button[aria-label^="Remove "]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label').replace('Remove ', '')))
  async function addCatalog(query) {
    await page.getByPlaceholder('Search gear…').fill(query)
    await page.getByRole('button', { name: /^Add .* to chain$/ }).first().click()
    await page.getByPlaceholder('Search gear…').fill('')
  }
  const addCustomButton = page.getByRole('button', { name: /\+ Add custom device/ })
  async function createCustomMic({ name, brand = 'Acme', phantom = false, ribbon = false, gain = '', price = '' }) {
    await addCustomButton.click()
    await dialog.getByLabel('Name', { exact: true }).fill(name)
    await dialog.getByLabel('Brand').fill(brand)
    if (price) await dialog.getByLabel('Price (USD)').fill(price)
    if (phantom) await dialog.getByLabel(/Needs 48V phantom power/).check()
    if (ribbon) await dialog.getByLabel(/Can be damaged by phantom power/).check()
    if (gain) await dialog.getByLabel('Clean gain it needs (dB)').fill(gain)
    await dialog.getByRole('button', { name: 'Add device' }).click()
  }
  return { ctx, page, errors, report, cables, dialog, chainNames, addCatalog, addCustomButton, createCustomMic }
}

// ================= FREE USER =================
let sharedUrl = ''
{
  const { ctx, page, errors, report, cables, dialog, chainNames, addCatalog, addCustomButton, createCustomMic } = await session()

  check('free: "+ Add custom device" is present with no PRO badge and no limit note yet',
    (await addCustomButton.isVisible()) && !(await addCustomButton.innerText()).toUpperCase().includes('PRO') &&
    (await page.getByText(/custom device used/).count()) === 0)

  // --- form + validation ---
  await addCustomButton.click()
  check('free: opens the add dialog', (await dialog.innerText()).includes('Add a custom device'))
  await dialog.getByRole('button', { name: 'Add device' }).click()
  check('free: empty name is rejected with a message, dialog stays open', (await dialog.getByText('Enter a name.').isVisible()) && (await dialog.isVisible()))
  check('free: the invalid field is flagged for assistive tech', (await dialog.getByLabel('Name', { exact: true }).getAttribute('aria-invalid')) === 'true')
  await dialog.getByLabel('Name', { exact: true }).fill('Bad Numbers')
  await dialog.getByLabel('Price (USD)').fill('abc')
  await dialog.getByLabel('Clean gain it needs (dB)').fill('999')
  await dialog.getByRole('button', { name: 'Add device' }).click()
  const t = await dialog.innerText()
  check('free: non-numeric price and out-of-range gain are rejected', t.includes('Enter a price between $0 and $100,000.') && t.includes('Enter a number of dB between 0 and 100.'))
  check('free: rejected input does not use up the free slot', (await page.getByText(/custom device used/).count()) === 0)
  await page.screenshot({ path: SHOTS + 'm3-form-errors.png' })
  await page.keyboard.press('Escape')
  check('free: Escape closes the dialog', (await dialog.count()) === 0)
  await addCustomButton.click()
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  check('free: Cancel closes the dialog', (await dialog.count()) === 0)

  // category switching shows only what applies
  await addCustomButton.click()
  check('free: microphone form offers phantom + gain-needed, not "maximum preamp gain"',
    (await dialog.getByLabel('Clean gain it needs (dB)').count()) === 1 && (await dialog.getByLabel('Maximum mic preamp gain (dB)').count()) === 0)
  await dialog.getByLabel('Category').selectOption('audio_interface')
  check('free: interface form offers provides-phantom + max gain + headphone jack, not gain-needed',
    (await dialog.getByLabel('Maximum mic preamp gain (dB)').count()) === 1 && (await dialog.getByLabel('Clean gain it needs (dB)').count()) === 0 &&
    (await dialog.getByText('Headphone jack').count()) === 1)
  await dialog.getByLabel('Category').selectOption('monitor')
  check('free: monitor form has no phantom or gain fields',
    (await dialog.getByLabel(/phantom power/).count()) === 0 && (await dialog.getByLabel(/dB\)/).count()) === 0)
  await page.keyboard.press('Escape')

  // --- create the one free custom device ---
  await createCustomMic({ name: 'Studio Condenser', phantom: true, gain: '35', price: '229' })
  check('free: dialog closes after adding', (await dialog.count()) === 0)
  check('free: "My devices" lists it, tagged as a user device', (await page.getByRole('heading', { name: 'My devices' }).isVisible()) && (await page.getByText('Acme Studio Condenser').isVisible()))
  check('free: shows the free-plan usage note', await page.getByText('Free plan: 1 of 1 custom device used').isVisible())
  check('free: the add button now carries a PRO badge', (await addCustomButton.innerText()).toUpperCase().includes('PRO'))
  check('free: no spec-report flag on a custom device in the library',
    (await page.getByLabel('Report incorrect spec for Acme Studio Condenser').count()) === 0)

  // --- it works in a chain with real compatibility checks ---
  await page.getByRole('button', { name: 'Add Acme Studio Condenser to chain' }).click()
  await addCatalog('Scarlett 2i2 (4th')
  let text = await report.innerText()
  check('free: custom condenser gets a phantom-power check against a real interface', text.includes('Studio Condenser') && text.includes('Phantom power available'), JSON.stringify(text.slice(0, 200)))
  check('free: gain check uses the custom spec (35 dB needed)', text.includes('Studio Condenser needs about 35dB'))
  check('free: connectors match via XLR', text.includes('Studio Condenser connects to Scarlett 2i2 (4th Gen) via XLR'))
  check('free: cable list picks it up', /XLR cable/.test(await cables.innerText()))
  check('free: chain card is tagged Custom and has no report flag', (await page.getByText(/Custom$/).first().isVisible()) && (await page.locator('[aria-label^="Report incorrect spec for Studio"]').count()) === 0)
  await page.screenshot({ path: SHOTS + 'm3-in-chain.png', fullPage: true })

  // --- the free limit ---
  await addCustomButton.click()
  check('free: a second custom device opens the upgrade modal, not the form',
    (await dialog.innerText()).includes('Add unlimited custom devices with Pro') && !(await dialog.innerText()).includes('Add a custom device'))
  check('free: modal lists the new benefit', (await dialog.innerText()).includes('Unlimited custom devices'))
  await page.screenshot({ path: SHOTS + 'm3-limit.png' })
  await page.keyboard.press('Escape')

  // --- persistence ---
  await page.reload()
  check('free: the library survives a reload', await page.getByText('Acme Studio Condenser').isVisible())

  // --- edit ---
  await page.getByRole('button', { name: 'Add Acme Studio Condenser to chain' }).click()
  await page.getByRole('button', { name: 'Edit Acme Studio Condenser' }).click()
  check('free: edit dialog is pre-filled', (await dialog.getByLabel('Name', { exact: true }).inputValue()) === 'Studio Condenser' &&
    (await dialog.getByLabel(/Needs 48V phantom power/).isChecked()) && (await dialog.getByLabel('Clean gain it needs (dB)').inputValue()) === '35' &&
    (await dialog.getByLabel('Price (USD)').inputValue()) === '229')
  check('free: edit dialog is titled as an edit', (await dialog.innerText()).includes('Edit custom device'))
  await dialog.getByLabel('Name', { exact: true }).fill('Studio Condenser II')
  await dialog.getByLabel('Clean gain it needs (dB)').fill('62')
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  check('free: edit does not trip the free limit', (await dialog.count()) === 0)
  check('free: still exactly one custom device after editing', (await page.getByText('Free plan: 1 of 1 custom device used').isVisible()) && (await page.getByText('Acme Studio Condenser II').count()) >= 1)
  await addCatalog('AudioBox USB 96')
  text = await report.innerText()
  check('free: an edit shows up in a chain that already uses the device (gain now 62dB)', text.includes('Studio Condenser II needs about 62dB'), JSON.stringify(text.match(/Studio Condenser II needs[^\n]*/)?.[0]))

  // --- share (author side) ---
  await page.getByRole('button', { name: 'New chain' }).click()
  await page.getByRole('button', { name: 'Add Acme Studio Condenser II to chain' }).click()
  await addCatalog('Scarlett 2i2 (4th')
  await page.getByRole('button', { name: 'Share' }).click()
  const fallback = page.locator('input[readonly]')
  sharedUrl = (await fallback.count()) ? await fallback.inputValue() : await page.evaluate(() => navigator.clipboard.readText())
  check('free: share produced a v2 link containing the chain', sharedUrl.includes('?chain='), sharedUrl.slice(0, 80))
  check('free: the link is a sensible length', sharedUrl.length < 1500, `${sharedUrl.length} chars`)

  // --- save, delete from library, reload the saved chain ---
  await page.getByRole('button', { name: /^Save$/ }).click()
  await page.getByRole('button', { name: 'Delete Acme Studio Condenser II' }).click()
  check('free: delete asks for confirmation first', (await page.getByRole('button', { name: /Confirm delete/ }).isVisible()))
  await page.getByRole('button', { name: 'Keep' }).click()
  check('free: "Keep" cancels the delete', await page.getByText('Acme Studio Condenser II').first().isVisible())
  await page.getByRole('button', { name: 'Delete Acme Studio Condenser II' }).click()
  await page.getByRole('button', { name: /Confirm delete/ }).click()
  check('free: deleting removes it from the library', (await page.getByRole('heading', { name: 'My devices' }).count()) === 0)
  check('free: …and from the chain being edited', JSON.stringify(await chainNames()) === JSON.stringify(['Scarlett 2i2 (4th Gen)']), JSON.stringify(await chainNames()))
  check('free: deleting frees the slot (no PRO badge, no usage note)', !(await addCustomButton.innerText()).toUpperCase().includes('PRO') && (await page.getByText(/custom device used/).count()) === 0)
  await page.getByRole('button', { name: 'Saved chains' }).click()
  await page.getByRole('button', { name: 'Load' }).click()
  const afterLoad = await chainNames()
  check('free: the saved chain still has its deleted custom device (snapshot)', afterLoad.includes('Studio Condenser II') && afterLoad.includes('Scarlett 2i2 (4th Gen)'), JSON.stringify(afterLoad))
  check('free: …and it still gets checked against the interface', (await report.innerText()).includes('Studio Condenser II'))

  check('free: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ================= RECIPIENT (fresh browser profile) =================
{
  const { ctx, page, errors, report, cables, chainNames, addCustomButton, createCustomMic } = await session({ url: sharedUrl })
  await page.getByRole('button', { name: 'Saved chains' }).waitFor()
  const names = await chainNames()
  check('recipient: the shared chain shows the author’s custom device', names.includes('Studio Condenser II') && names.includes('Scarlett 2i2 (4th Gen)'), JSON.stringify(names))
  check('recipient: no "skipped devices" banner', (await page.getByText(/no longer in the catalog/).count()) === 0)
  check('recipient: compatibility is checked with the author’s specs', (await report.innerText()).includes('Studio Condenser II needs about 62dB'))
  check('recipient: the cable list includes it', /XLR cable/.test(await cables.innerText()))
  check('recipient: it is NOT in their library', (await page.getByRole('heading', { name: 'My devices' }).count()) === 0)
  check('recipient: it did not use up their free slot', !(await addCustomButton.innerText()).toUpperCase().includes('PRO'))
  check('recipient: the share parameter was cleaned from the address bar', !page.url().includes('chain='))

  await createCustomMic({ name: 'My Own Mic' })
  check('recipient: they can still add their own custom device', await page.getByText('Acme My Own Mic').isVisible())

  // saving the shared chain keeps the author's device
  await page.getByRole('button', { name: /^Save$/ }).click()
  await page.reload()
  await page.getByRole('button', { name: 'Saved chains' }).click()
  await page.getByRole('button', { name: 'Load' }).click()
  check('recipient: a saved shared chain still has the author’s device after reload', (await chainNames()).includes('Studio Condenser II'))
  check('recipient: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ================= LEGACY v1 LINK + TAMPERED LINK =================
{
  // A link written before custom devices existed.
  const legacy = await (async () => {
    const lz = await import('lz-string'); const compressToEncodedURIComponent = (lz.default ?? lz).compressToEncodedURIComponent
    return compressToEncodedURIComponent(JSON.stringify({ v: 1, n: 'Old link', d: ['shure-sm7b', 'presonus-audiobox-usb-96'] }))
  })().catch(() => null)
  if (legacy) {
    const { ctx, page, errors, chainNames } = await session({ url: `${APP}?chain=${legacy}` })
    await page.getByRole('button', { name: 'Saved chains' }).waitFor()
    check('legacy: a v1 link still loads', JSON.stringify(await chainNames()) === JSON.stringify(['SM7B', 'AudioBox USB 96']))
    check('legacy: no errors', errors.length === 0, errors.join('; '))
    await ctx.close()
  } else {
    console.log('SKIP  legacy v1 link (lz-string not resolvable from the script folder)')
  }
}

// ================= PRO USER =================
{
  const { ctx, page, errors, report, dialog, addCustomButton, createCustomMic } = await session({ pro: true })
  for (const n of ['Mic One', 'Mic Two', 'Mic Three', 'Mic Four']) await createCustomMic({ name: n })
  check('pro: can add several custom devices with no limit modal', (await page.getByText('Acme Mic Four').isVisible()) && (await dialog.count()) === 0)
  check('pro: no PRO badge or usage note', !(await addCustomButton.innerText()).toUpperCase().includes('PRO') && (await page.getByText(/custom device used/).count()) === 0)

  // ribbon + engine integration
  await createCustomMic({ name: 'Ribbon Mic', ribbon: true, gain: '58' })
  await page.getByRole('button', { name: 'Add Acme Ribbon Mic to chain' }).click()
  await page.getByPlaceholder('Search gear…').fill('AudioBox USB 96')
  await page.getByRole('button', { name: /^Add PreSonus AudioBox USB 96 to chain$/ }).click()
  const text = await report.innerText()
  check('pro: a custom ribbon mic triggers the phantom-damage critical like a catalog ribbon', text.includes('Phantom power can damage this microphone'))
  check('pro: …and gets booster fix buttons (engine treats it as a real mic)', (await page.getByRole('button', { name: /^Add .*\(\+\d+ dB/ }).count()) > 0)

  // PDF with a custom device
  await page.getByRole('button', { name: /^Add .*Triton Audio FetHead/ }).first().click().catch(() => {})
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30000 }),
    page.getByRole('button', { name: /Export PDF/ }).click(),
  ])
  check('pro: PDF export works with a custom device in the chain', download.suggestedFilename().endsWith('.pdf'), download.suggestedFilename())
  check('pro: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
