import { APP_URL, OUT_DIR, launch } from './lib.mjs'

const APP = APP_URL + '/'
const SHOTS = OUT_DIR
const results = []
const check = (name, ok, extra = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`)
}

const browser = await launch()

async function session({ pro }) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 1300 } })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.route('**/_vercel/**', (route) => route.abort())
  if (pro)
    await page.addInitScript(() =>
      localStorage.setItem('soundorp:signal-chain-builder:license', JSON.stringify({ licenseKey: 'k', instanceId: 'i' })),
    )
  await page.goto(APP)
  const report = page.locator('section', { has: page.getByRole('heading', { name: 'Compatibility Report' }) })
  const cables = page.locator('section', { has: page.getByRole('heading', { name: 'Cables & Adapters' }) })
  const chainNames = async () =>
    (await page.locator('button[aria-label^="Remove "]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label').replace('Remove ', ''))))
  async function addDevice(query) {
    await page.getByPlaceholder('Search gear…').fill(query)
    await page.getByRole('button', { name: /^Add/ }).first().click()
  }
  const fixButtons = () => page.getByRole('button', { name: /^Add .*\(\+\d+ dB/ })
  return { ctx, page, errors, report, cables, chainNames, addDevice, fixButtons }
}

// ---------- FREE: SM7B into a budget interface ----------
{
  const { ctx, page, errors, report, cables, chainNames, addDevice, fixButtons } = await session({ pro: false })
  await addDevice('SM7B')
  await addDevice('AudioBox USB 96')

  let text = await report.innerText()
  check('free: shortfall warning shown', text.includes('Insufficient gain headroom') && text.includes('25dB shortfall'))
  const labels = await fixButtons().allInnerTexts()
  check('free: three fix buttons offered', labels.length === 3, JSON.stringify(labels))
  check('free: cheapest (FetHead) first', labels[0].includes('FetHead') && labels[0].includes('$90'), labels[0])
  check('free: then DM1, then Cloudlifter', labels[1].includes('DM1') && labels[2].includes('Cloudlifter'))
  check('free: fix buttons are not Pro-locked (no PRO badge)', !labels.join(' ').toUpperCase().includes('PRO'))
  await page.screenshot({ path: SHOTS + 'm2-before.png', fullPage: true })

  await fixButtons().first().click()
  check('free: FetHead inserted between mic and interface', JSON.stringify(await chainNames()) === JSON.stringify(['SM7B', 'FetHead', 'AudioBox USB 96']), JSON.stringify(await chainNames()))
  text = await report.innerText()
  check('free: shortfall warning cleared', !text.includes('Insufficient gain headroom') || text.includes('Sufficient gain headroom') && !/25dB shortfall/.test(text))
  check('free: no warning or critical icons left', (await report.locator('text=⚠').count()) === 0 && (await report.locator('text=✕').count()) === 0)
  check('free: boosted-gain explanation shown', text.includes('FetHead adds 27dB') && text.includes('supply about 33dB'), text.match(/SM7B needs[^\n]*/)?.[0])
  check('free: phantom reminder for the booster', text.includes('can supply the 48V phantom power FetHead needs'))
  check('free: no more fix buttons', (await fixButtons().count()) === 0)
  check('free: cable list picked up the new device', /2×\s*\n?\s*XLR cable/.test(await cables.innerText()), JSON.stringify(await cables.innerText()))
  await page.screenshot({ path: SHOTS + 'm2-after.png', fullPage: true })
  check('free: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ---------- Insert lands in the middle of a longer chain, and an alternative booster works ----------
{
  const { ctx, errors, report, chainNames, addDevice, fixButtons } = await session({ pro: true })
  await addDevice('SM7B')
  await addDevice('AudioBox USB 96')
  await addDevice('Live 12')
  await fixButtons().nth(2).click() // Cloudlifter
  const names = await chainNames()
  check('pro: booster goes between mic and interface, DAW stays last', JSON.stringify(names) === JSON.stringify(['SM7B', 'Cloudlifter CL-1', 'AudioBox USB 96', 'Live 12']), JSON.stringify(names))
  const text = await report.innerText()
  check('pro: Cloudlifter credited in the gain check', text.includes('Cloudlifter CL-1 adds 25dB'))
  check('pro: nothing left to fix', (await fixButtons().count()) === 0 && (await report.locator('text=⚠').count()) === 0)
  check('pro: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ---------- Ribbon mic: the booster also resolves the phantom-damage critical ----------
{
  const { ctx, page, errors, report, chainNames, addDevice, fixButtons } = await session({ pro: false })
  await addDevice('R-121')
  await addDevice('AudioBox USB 96')
  let text = await report.innerText()
  check('ribbon: phantom damage critical shown straight into a phantom interface', text.includes('Phantom power can damage this microphone'))
  check('ribbon: booster offered', (await fixButtons().count()) > 0)
  await fixButtons().first().click()
  text = await report.innerText()
  check('ribbon: damage warning gone after inserting the booster', !text.includes('Phantom power can damage this microphone'), JSON.stringify(await chainNames()))
  check('ribbon: no warning/critical left', (await report.locator('text=⚠').count()) === 0 && (await report.locator('text=✕').count()) === 0)
  await page.screenshot({ path: SHOTS + 'm2-ribbon.png', fullPage: true })
  check('ribbon: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ---------- No phantom power downstream: warn, but do not offer a booster that would not work ----------
{
  const { ctx, errors, report, addDevice, fixButtons } = await session({ pro: false })
  await addDevice('SM7B')
  await addDevice('PodTrak P4')
  const text = await report.innerText()
  check('no-phantom: shortfall still reported', text.includes('Insufficient gain headroom'), text.match(/SM7B needs[^\n]*/)?.[0])
  check('no-phantom: no booster buttons offered', (await fixButtons().count()) === 0)
  check('no-phantom: written advice still shown', text.includes('Fix:'))
  check('no-phantom: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
