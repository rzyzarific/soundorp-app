import { APP_URL, launch } from './lib.mjs'

// A spec the catalog marks in_question must reach the person as an explicit "unconfirmed"
// warning, not a clean pass or a critical. The Alto ZMX122FX (sources disagree on which inputs
// have phantom power) is the real case; a Mackie ProFX6v3 is the control that must not change.
const APP = APP_URL + '/'
const results = []
const check = (name, ok, extra = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + String(extra).slice(0, 220) : ''}`)
}

const browser = await launch()

async function reportFor(devices, width = 1200) {
  const ctx = await browser.newContext({ viewport: { width, height: 1400 } })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => { if (m.type() === 'error' && !/_vercel|favicon|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()) })
  await page.route('**/_vercel/**', (r) => r.abort())
  await page.goto(APP)
  const search = page.getByPlaceholder('Search gear…')
  for (const q of devices) {
    await search.fill(q)
    await page.getByRole('button', { name: /^Add .* to chain$/ }).first().click()
  }
  const text = await page.locator('body').innerText()
  const report = text.slice(text.indexOf('COMPATIBILITY REPORT'))
  return { ctx, page, report, errors }
}

// condenser into the Alto
{
  const { ctx, report, errors } = await reportFor(['NT1-A', 'ZMX122FX'])
  check('condenser → Alto: the report says phantom power is unconfirmed', /Phantom power unconfirmed/i.test(report), report.slice(0, 200))
  check('condenser → Alto: it does NOT say phantom power is available', !/Phantom power available/i.test(report))
  check('condenser → Alto: the reason is shown (the sources disagree)', /two with Phantom Power/i.test(report))
  check('condenser → Alto: it tells you to check the manual', /manual/i.test(report))
  check('condenser → Alto: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ribbon into the Alto: not a critical, an unconfirmed warning
{
  const { ctx, report } = await reportFor(['R-121', 'ZMX122FX'])
  check('ribbon → Alto: the damage risk is shown as unconfirmed', /Phantom power risk unconfirmed/i.test(report), report.slice(0, 200))
  check('ribbon → Alto: not shown as a confirmed "can damage this microphone"', !/Phantom power can damage this microphone/i.test(report))
  await ctx.close()
}

// controls: a device that is not in question behaves exactly as before
{
  const { ctx, report } = await reportFor(['NT1-A', 'ProFX6v3'])
  check('control: condenser → ProFX6v3 still passes with "Phantom power available"', /Phantom power available/i.test(report) && !/unconfirmed/i.test(report), report.slice(0, 200))
  await ctx.close()
}
{
  const { ctx, report } = await reportFor(['R-121', 'ProFX6v3'])
  check('control: ribbon → ProFX6v3 is still the confirmed critical', /Phantom power can damage this microphone/i.test(report) && !/unconfirmed/i.test(report), report.slice(0, 200))
  await ctx.close()
}

// the one-click booster is withheld rather than offered into an unconfirmed-phantom input
{
  const { ctx, page, report } = await reportFor(['SM7B', 'ZMX122FX'])
  check('SM7B → Alto: the gain shortfall is reported', /Insufficient gain headroom/i.test(report), report.slice(0, 200))
  check('SM7B → Alto: no one-click booster button is offered', (await page.getByRole('button', { name: /^Add .*(Cloudlifter|FetHead|Dynamite)/ }).count()) === 0)
  check('SM7B → Alto: the advice does not tell you to add an inline booster', !/inline gain booster/i.test(report), report.slice(0, 400))
  check('SM7B → Alto: the advice says a booster cannot be recommended until phantom power is confirmed', /can't be safely recommended/i.test(report) && /phantom power support is confirmed/i.test(report))
  await ctx.close()
}

await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
