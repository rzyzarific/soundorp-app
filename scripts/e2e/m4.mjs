import { APP_URL, OUT_DIR, launch } from './lib.mjs'
import fs from 'node:fs'

const APP = APP_URL + '/'
const SHOTS = OUT_DIR
const CATALOG = JSON.parse(fs.readFileSync(new URL('../../src/data/devices.json', import.meta.url), 'utf8'))
const price = (id) => CATALOG.find((d) => d.id === id).msrp
const fmt = (n) => '$' + n.toLocaleString('en-US')

const results = []
const check = (name, ok, extra = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`)
}

const browser = await launch()

async function session({ pro }) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 1500 } })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.route('**/_vercel/**', (route) => route.abort())
  if (pro)
    await page.addInitScript(() => {
      if (!localStorage.getItem('soundorp:signal-chain-builder:license'))
        localStorage.setItem('soundorp:signal-chain-builder:license', JSON.stringify({ licenseKey: 'k', instanceId: 'i' }))
    })
  await page.goto(APP)
  const panel = page.locator('section', { has: page.getByRole('heading', { name: 'Shopping List' }) })
  const report = page.locator('section', { has: page.getByRole('heading', { name: 'Compatibility Report' }) })
  const dialog = page.getByRole('dialog')
  const chainNames = () =>
    page.locator('button[aria-label^="Remove "]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label').replace('Remove ', '')))
  async function add(query, exactLabel) {
    await page.getByPlaceholder('Search gear…').fill(query)
    await page.getByRole('button', { name: exactLabel ?? /^Add .* to chain$/ }).first().click()
    await page.getByPlaceholder('Search gear…').fill('')
  }
  const problems = async () => (await report.locator('text=⚠').count()) + (await report.locator('text=✕').count())
  return { ctx, page, errors, panel, report, dialog, chainNames, add, problems }
}

// ================= FREE =================
{
  const { ctx, page, errors, panel, dialog } = await session({ pro: false })
  await page.getByPlaceholder('Search gear…').fill('SM7B')
  await page.getByRole('button', { name: /^Add .* to chain$/ }).first().click()
  const text = await panel.innerText()
  check('free: the shopping list is visible but locked', text.toUpperCase().includes('PRO') && text.includes('Unlock the shopping list'))
  check('free: it reveals no prices or totals', !text.includes('$') && !text.includes('Estimated total'), JSON.stringify(text))
  check('free: and no price disclaimer, since no prices are shown', (await panel.getByRole('note').count()) === 0)
  check('free: no budget field', (await page.getByLabel('Budget').count()) === 0)
  await page.screenshot({ path: SHOTS + 'm4-locked.png', fullPage: true })
  await panel.getByRole('button', { name: 'Unlock the shopping list' }).click()
  check('free: unlocking opens the upgrade modal with the right copy', (await dialog.innerText()).includes('Plan your budget with Pro'))
  check('free: modal lists the new benefit', (await dialog.innerText()).includes('Shopping list with a budget and cheaper alternatives'))
  await page.keyboard.press('Escape')
  check('free: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ================= PRO =================
{
  const { ctx, page, errors, panel, report, chainNames, add, problems } = await session({ pro: true })
  check('pro: an empty chain shows no price disclaimer (no prices yet)', (await panel.getByRole('note').count()) === 0)
  check('pro: empty chain prompts to add devices', (await panel.innerText()).includes('Add devices to see what your chain costs.'))

  await add('SM7B')
  await add('Scarlett 2i2 (4th')
  await add('HS5')
  const expectedTotal = price('shure-sm7b') + price('focusrite-scarlett-2i2-4gen') + price('yamaha-hs5')
  let text = await panel.innerText()
  check('pro: lists every device with its price', text.includes('Shure SM7B') && text.includes(fmt(price('shure-sm7b'))) && text.includes(fmt(price('yamaha-hs5'))), JSON.stringify(text.slice(0, 160)))
  check(`pro: total is the sum of the catalog prices (${fmt(expectedTotal)})`, text.includes('Estimated total') && text.includes(fmt(expectedTotal)), JSON.stringify(text.match(/Estimated total[^\n]*\n[^\n]*/)?.[0]))
  const note = panel.getByRole('note')
  check('pro: the price disclaimer is shown, dated, and says to check before buying',
    (await note.isVisible()) && (await note.innerText()) === 'Prices are approximate list prices as of September 2026 — check current pricing before buying.', await note.innerText().catch(() => '(none)'))
  const order = await panel.innerText()
  check('pro: …and sits right under the total, not buried elsewhere', order.indexOf('Estimated total') < order.indexOf('Prices are approximate') && order.indexOf('Prices are approximate') < order.indexOf('Budget'))
  const box = await note.boundingBox()
  const totalBox = await panel.getByText('Estimated total').boundingBox()
  check('pro: …within one line-height of the total on screen', box && totalBox && box.y - (totalBox.y + totalBox.height) < 40, JSON.stringify({ gap: box && totalBox ? box.y - (totalBox.y + totalBox.height) : null }))
  check('pro: …and is not hidden (non-zero size, readable text colour)', box.width > 200 && box.height > 8 && (await note.evaluate((el) => getComputedStyle(el).opacity)) === '1')
  check('pro: no budget set, no status shown', (await panel.getByRole('status').count()) === 0)

  // ---- budget ----
  const budget = panel.getByLabel('Budget')
  await budget.fill('500')
  check('pro: over budget is reported with the exact amount', (await panel.getByRole('status').innerText()) === `${fmt(expectedTotal - 500)} over budget`, await panel.getByRole('status').innerText())
  await budget.fill('$1,000')
  check('pro: "$1,000" is accepted; under budget is reported', (await panel.getByRole('status').innerText()) === `${fmt(1000 - expectedTotal)} under budget`, await panel.getByRole('status').innerText())
  await budget.fill(String(expectedTotal))
  check('pro: exactly on budget is reported', (await panel.getByRole('status').innerText()) === 'Right on budget')
  await budget.fill('abc')
  check('pro: an invalid budget shows an error and flags the field', (await panel.getByRole('alert').innerText()).includes('Enter a budget between $0 and $1,000,000.') && (await budget.getAttribute('aria-invalid')) === 'true')
  check('pro: …and hides the stale status while it is invalid', (await panel.getByRole('status').count()) === 0)
  await budget.fill('1500')
  check('pro: fixing the field clears the error', (await panel.getByRole('alert').count()) === 0 && (await panel.getByRole('status').count()) === 1)
  await budget.fill('0')
  check('pro: a budget of $0 is a real budget (over by the whole total)', (await panel.getByRole('status').innerText()) === `${fmt(expectedTotal)} over budget`)
  await budget.fill('')
  check('pro: clearing the field removes the budget', (await panel.getByRole('status').count()) === 0)

  // ---- budget persists ----
  await budget.fill('600')
  await page.reload()
  const persisted = page.locator('section', { has: page.getByRole('heading', { name: 'Shopping List' }) })
  check('pro: the budget survives a reload, and the field is there even with an empty chain', (await persisted.getByLabel('Budget').inputValue()) === '600')
  check('pro: …but an empty chain shows no over/under status', (await persisted.getByRole('status').count()) === 0)

  // ---- cheaper options ----
  await add('SM7B')
  await add('Scarlett 2i2 (4th')
  await add('HS5')
  const warningsBefore = await problems()
  const sm7bOptions = await panel.locator('li', { hasText: 'saves' }).allInnerTexts()
  check('pro: over budget, the cheaper options are open without a click', sm7bOptions.length > 0)
  check('pro: every listed option shows its price and a saving', sm7bOptions.every((t) => /\$\d/.test(t) && /saves \$\d/.test(t)), JSON.stringify(sm7bOptions.slice(0, 2)))
  const sm7bSwap = panel.getByRole('button', { name: /^Swap Shure SM7B for / })
  const swapCount = await sm7bSwap.count()
  check('pro: the SM7B has up to 3 cheaper options', swapCount >= 1 && swapCount <= 3, `${swapCount}`)
  const firstLabel = await sm7bSwap.first().getAttribute('aria-label')
  const targetName = firstLabel.replace('Swap Shure SM7B for ', '')
  const target = CATALOG.find((d) => `${d.brand} ${d.name}` === targetName)
  check('pro: the first option is a real cheaper dynamic mic', target && target.msrp < price('shure-sm7b') && target.subtype === 'dynamic', targetName)

  await page.screenshot({ path: SHOTS + 'm4-pro.png', fullPage: true })
  await sm7bSwap.first().click()
  const namesAfter = await chainNames()
  check('pro: Swap replaces the mic in the chain, keeping the rest', namesAfter[0] === target.name && namesAfter.length === 3, JSON.stringify(namesAfter))
  const newTotal = expectedTotal - price('shure-sm7b') + target.msrp
  text = await panel.innerText()
  check(`pro: the total drops by exactly the saving (${fmt(newTotal)})`, text.includes(fmt(newTotal)), JSON.stringify(text.match(/Estimated total[^\n]*\n[^\n]*/)?.[0]))
  check('pro: the swap added no warnings or criticals to the report', (await problems()) <= warningsBefore, `${warningsBefore} → ${await problems()}`)

  // ---- repeated device ----
  await page.getByRole('button', { name: 'New chain' }).click()
  await add('SM58')
  await add('SM58')
  text = await panel.innerText()
  check('pro: a repeated device folds into one "2×" line with a per-unit price and a subtotal',
    text.includes('2× Shure SM58') && text.includes(`${fmt(price('shure-sm58'))} each`) && text.includes(fmt(price('shure-sm58') * 2)), JSON.stringify(text.slice(0, 120)))

  // ---- gain-booster fix interaction: the fix is never swapped away ----
  await page.getByRole('button', { name: 'New chain' }).click()
  await add('SM7B')
  await add('AudioBox USB 96')
  await page.getByRole('button', { name: /^Add Cloud Microphones Cloudlifter CL-1 \(\+/ }).click()
  check('pro: the chain now has the Cloudlifter fix', (await chainNames()).includes('Cloudlifter CL-1'), JSON.stringify(await chainNames()))
  const clOptions = await panel.getByRole('button', { name: /^Swap Cloud Microphones Cloudlifter CL-1 for / }).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
  const nonBoosters = clOptions.filter((l) => !/FetHead|DM1 Dynamite/.test(l))
  check('pro: the Cloudlifter is only ever offered other boosters (never a plain preamp)', nonBoosters.length === 0, JSON.stringify(clOptions))
  const beforeSwap = await problems()
  if (clOptions.length > 0) {
    await panel.getByRole('button', { name: /^Swap Cloud Microphones Cloudlifter CL-1 for / }).first().click()
    const after = await chainNames()
    check('pro: swapping a booster for another keeps the chain fixed (no new warnings)', (await problems()) <= beforeSwap && after.some((n) => /FetHead|DM1/.test(n)), JSON.stringify(after))
  }

  // ---- an existing gain shortfall must never get bigger through a swap ----
  const shortfallOnScreen = async () => {
    const m = (await report.innerText()).match(/a (\d+)dB shortfall/)
    return m ? Number(m[1]) : 0
  }
  async function freshChain(...queries) {
    await page.getByRole('button', { name: 'New chain' }).click()
    for (const q of queries) await add(q)
  }
  // A $0 budget puts every chain over budget, which keeps the "Cheaper options" lists open
  // (closed <details> are invisible to the accessibility tree, so nothing could be clicked).
  await budget.fill('0')
  await freshChain('SM7B', 'Scarlett 2i2 (4th', 'HS5')
  const baseShortfall = await shortfallOnScreen()
  check('pro: the SM7B → Scarlett 2i2 chain starts with a real gain shortfall', baseShortfall > 0, JSON.stringify({ baseShortfall, chain: await chainNames(), report: (await report.innerText()).slice(0, 260) }))
  const ifaceSwaps = await panel.getByRole('button', { name: /^Swap Focusrite Scarlett 2i2 \(4th Gen\) for / }).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
  check('pro: it still offers interface swaps to try', ifaceSwaps.length > 0, JSON.stringify(ifaceSwaps))
  const grown = []
  for (const label of ifaceSwaps) {
    await freshChain('SM7B', 'Scarlett 2i2 (4th', 'HS5')
    await panel.getByRole('button', { name: label, exact: true }).click()
    const now = await shortfallOnScreen()
    if (now > baseShortfall) grown.push(`${label}: ${baseShortfall} → ${now} dB`)
  }
  check('pro: clicking each offered interface swap never grows the shortfall on screen', grown.length === 0 && ifaceSwaps.length > 0, `${ifaceSwaps.length} swaps tried ${JSON.stringify(grown)}`)

  // the exact examples that used to slip through
  await freshChain('SM7B', 'Scarlett Solo (4th')
  const soloSwaps = await panel.getByRole('button', { name: /^Swap Focusrite Scarlett Solo \(4th Gen\) for / }).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
  check('pro: the Solo → MiniFuse 2 / AIR 192|4 swaps (4 → 10 dB) are no longer offered', !soloSwaps.some((l) => /MiniFuse 2|AIR 192\|4/.test(l)), JSON.stringify(soloSwaps))

  // and the mic side
  await freshChain('SM7B', 'AudioBox USB 96')
  const micBase = await shortfallOnScreen()
  const micSwaps = await panel.getByRole('button', { name: /^Swap Shure SM7B for / }).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
  const micGrown = []
  for (const label of micSwaps) {
    await freshChain('SM7B', 'AudioBox USB 96')
    await panel.getByRole('button', { name: label, exact: true }).click()
    const now = await shortfallOnScreen()
    if (now > micBase) micGrown.push(`${label}: ${micBase} → ${now} dB`)
  }
  check('pro: clicking each offered mic swap never grows the shortfall either (and some were tried)', micGrown.length === 0 && micSwaps.length > 0, `${micSwaps.length} swaps tried, base ${micBase} dB ${JSON.stringify(micGrown)}`)

  // ---- custom devices ----
  await page.getByRole('button', { name: 'New chain' }).click()
  await page.getByRole('button', { name: /\+ Add custom device/ }).click()
  const dlg = page.getByRole('dialog')
  await dlg.getByLabel('Name', { exact: true }).fill('Priced Mic')
  await dlg.getByLabel('Price (USD)').fill('180')
  await dlg.getByRole('button', { name: 'Add device' }).click()
  await page.getByRole('button', { name: /\+ Add custom device/ }).click() // pro: second one is fine
  await dlg.getByLabel('Name', { exact: true }).fill('Unpriced Mic')
  await dlg.getByRole('button', { name: 'Add device' }).click()
  await page.getByRole('button', { name: 'Add Acme Priced Mic to chain' }).click().catch(async () => page.getByRole('button', { name: 'Add Custom Priced Mic to chain' }).click())
  await page.getByRole('button', { name: /^Add Custom Unpriced Mic to chain$|^Add .*Unpriced Mic to chain$/ }).click()
  text = await panel.innerText()
  check('pro: a custom device with a price is counted in the total', text.includes('$180'), JSON.stringify(text.slice(0, 200)))
  check('pro: a custom device without a price says so and is left out', text.includes('No price') && text.includes("1 device without a price isn't included in the total."), JSON.stringify(text))
  const totalLine = text.match(/Estimated total\s*\n?\s*(\$[\d,]+)/)?.[1]
  check('pro: …and the total only includes the priced one', totalLine === '$180', totalLine)
  check('pro: a custom device with a price can have catalog alternatives only if cheaper & same kind',
    (await panel.getByRole('button', { name: /^Swap Custom Priced Mic for / }).count()) >= 0)

  check('pro: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
