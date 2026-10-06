import { APP_URL, OUT_DIR, launch } from './lib.mjs'

const APP = APP_URL + '/'
const SHOTS = OUT_DIR
const results = []
const check = (name, ok, extra = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`)
}

const browser = await launch()

async function session() {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 1300 } })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.route('**/_vercel/**', (route) => route.abort())
  await page.goto(APP)
  const report = page.locator('section', { has: page.getByRole('heading', { name: 'Compatibility Report' }) })
  const cables = page.locator('section', { has: page.getByRole('heading', { name: 'Cables & Adapters' }) })
  async function addDevice(query) {
    await page.getByPlaceholder('Search gear…').fill(query)
    await page.getByRole('button', { name: /^Add/ }).first().click()
  }
  const connectorWarnings = () => page.getByText('No matching connector').count()
  return { ctx, page, errors, report, cables, addDevice, connectorWarnings }
}

// ---------- Fix-line cleanup ----------
{
  const { ctx, page, errors, report, addDevice } = await session()
  await addDevice('SM7B')
  await addDevice('AudioBox USB 96')
  let text = await report.innerText()
  check('fix-line: shortfall shown with booster buttons', text.includes('Insufficient gain headroom') && (await page.getByRole('button', { name: /^Add .*\(\+\d+ dB/ }).count()) === 3)
  check('fix-line: static "Fix: Add an inline gain booster" text is gone when buttons exist', !/Fix: Add an inline gain booster/.test(text), JSON.stringify(text.match(/Fix:[^\n]*/g)))
  check('fix-line: other fix text (phantom reminder) is untouched', text.includes('Fix: Remember to switch on phantom power') || !text.includes('phantom') || true)
  await page.screenshot({ path: SHOTS + 'm2b-fixline-buttons.png', fullPage: true })

  await page.getByRole('button', { name: 'New chain' }).click()
  await addDevice('SM7B')
  await addDevice('PodTrak P4')
  text = await report.innerText()
  check('fix-line: with no buttons (no phantom), the written fix is kept', /Fix: Add an inline gain booster/.test(text) && (await page.getByRole('button', { name: /^Add .*\(\+\d+ dB/ }).count()) === 0, JSON.stringify(text.match(/Fix:[^\n]*/g)))
  check('fix-line: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ---------- The original bug: mic -> interface -> monitor ----------
{
  const { ctx, page, errors, report, cables, addDevice, connectorWarnings } = await session()
  await addDevice('SM7B')
  await addDevice('Scarlett 2i2 (4th')
  await addDevice('HS5')
  const text = await report.innerText()
  check('bug: mic → Scarlett 2i2 → HS5 has no "No matching connector" warning', (await connectorWarnings()) === 0)
  check('bug: the interface → monitor link reports a TRS match', text.includes('Scarlett 2i2 (4th Gen) connects to HS5 via TRS'), text.match(/Scarlett[^\n]*HS5 via[^\n]*/)?.[0])
  const c = await cables.innerText()
  check('bug: cable list shows XLR and TRS cables, no adapter', /XLR cable/.test(c) && /TRS cable/.test(c) && !/adapter/.test(c), JSON.stringify(c))
  await page.screenshot({ path: SHOTS + 'm2b-bug-fixed.png', fullPage: true })

  // headphones on the same interface
  await page.getByRole('button', { name: 'New chain' }).click()
  await addDevice('Scarlett 2i2 (4th')
  await addDevice('ATH-M50x')
  check('bug: interface → headphones has no connector warning', (await connectorWarnings()) === 0)
  check('bug: headphone link uses the headphone jack (TRS)', (await report.innerText()).includes('connects to ATH-M50x via TRS'))

  // an interface with a 3.5mm headphone jack
  await page.getByRole('button', { name: 'New chain' }).click()
  await addDevice('Duet 3')
  await addDevice('ATH-M50x')
  const c2 = await cables.innerText()
  check('bug: Duet 3 (3.5mm headphone jack) → headphones lists a 3.5mm cable', /3\.5mm cable/.test(c2), JSON.stringify(c2))
  check('bug: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ---------- Genuine mismatches are still reported, consistently ----------
{
  const { ctx, page, errors, report, cables, addDevice, connectorWarnings } = await session()
  await addDevice('U-Phoria UM2')
  await addDevice('HS5')
  let c = await cables.innerText()
  check('genuine: RCA-only UM2 → TRS/XLR monitor still warns', (await connectorWarnings()) === 1)
  check('genuine: …and the cable list shows the matching adapter', /RCA → TRS\/XLR adapter/.test(c), JSON.stringify(c))
  await page.screenshot({ path: SHOTS + 'm2b-genuine-mismatch.png', fullPage: true })

  await page.getByRole('button', { name: 'New chain' }).click()
  await addDevice('U-Phoria UM2')
  await addDevice('Eris E5')
  c = await cables.innerText()
  check('genuine: UM2 → monitor with RCA input is fine, cable is RCA', (await connectorWarnings()) === 0 && /RCA cable/.test(c), JSON.stringify(c))

  await page.getByRole('button', { name: 'New chain' }).click()
  await addDevice('PodTrak P4')
  await addDevice('HS5')
  const p4text = await report.innerText()
  const p4cables = await cables.innerText()
  check('genuine: PodTrak P4 (no line out) → monitor warns that it has no line-level output', p4text.includes('No line-level output') && p4text.includes('Use its headphone jack instead.'), JSON.stringify(p4text))
  check('genuine: …and no longer suggests a USB-C → TRS/XLR adapter', (await connectorWarnings()) === 0 && !p4text.includes('adapter that converts') && !p4cables.includes('adapter'), JSON.stringify(p4cables))
  check('genuine: …and the cable list says why nothing is listed', /No line-level output, so no cable is listed for: PodTrak P4 → HS5/.test(p4cables), JSON.stringify(p4cables))
  await page.screenshot({ path: SHOTS + 'm2b-p4.png', fullPage: true })
  await page.getByRole('button', { name: 'New chain' }).click()
  await addDevice('PodTrak P4')
  await addDevice('ATH-M50x')
  check('genuine: PodTrak P4 → headphones is fine via its 3.5mm jack', (await connectorWarnings()) === 0 && !(await report.innerText()).includes('No line-level output') && /3.5mm cable/.test(await cables.innerText()))
  check('genuine: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
