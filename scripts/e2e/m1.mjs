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
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 1100 } })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.route('**/_vercel/**', (route) => route.abort())
  if (pro)
    await page.addInitScript(() =>
      localStorage.setItem('soundorp:signal-chain-builder:license', JSON.stringify({ licenseKey: 'k', instanceId: 'i' })),
    )
  await page.goto(APP)
  const section = page.locator('section', { has: page.getByRole('heading', { name: 'Cables & Adapters' }) })
  async function addDevice(query) {
    await page.getByPlaceholder('Search gear…').fill(query)
    await page.getByRole('button', { name: /^Add/ }).first().click()
  }
  return { ctx, page, errors, section, addDevice }
}

// ---------- FREE USER ----------
{
  const { ctx, page, errors, section, addDevice } = await session({ pro: false })
  check('free: panel is present (not locked, no PRO badge)', (await section.count()) === 1 && !(await section.innerText()).toUpperCase().includes('PRO'))
  check('free: empty chain prompt', (await section.innerText()).includes("Add at least two devices to see the cables"))

  await addDevice('SM7B')
  check('free: one device still shows prompt', (await section.innerText()).includes('Add at least two devices'))

  await addDevice('Scarlett 2i2')
  let text = await section.innerText()
  check('free: mic → interface shows 1× XLR cable', /1×\s*\n?\s*XLR cable/.test(text), JSON.stringify(text))
  check('free: names the connection', text.includes('SM7B → Scarlett 2i2'))

  await addDevice('Ableton Live 12')
  text = await section.innerText()
  check('free: interface → DAW adds a USB-C cable', /USB-C cable/.test(text) && /XLR cable/.test(text), JSON.stringify(text))
  check('free: no adapter line for a clean chain', !/adapter/.test(text))
  await page.screenshot({ path: SHOTS + 'm1-clean-chain.png', fullPage: true })

  // live update on removal
  await page.getByRole('button', { name: 'Remove Live 12', exact: true }).click()
  text = await section.innerText()
  check('free: removing the DAW removes the USB-C line', !/USB-C cable/.test(text) && /XLR cable/.test(text), JSON.stringify(text))

  // interface straight into monitors: used to be a false adapter + warning, now a plain TRS cable
  await addDevice('Yamaha HS5')
  text = await section.innerText()
  check('free: interface → monitor is a TRS cable, no adapter (after the interface-outputs fix)', /TRS cable/.test(text) && !/adapter/.test(text), JSON.stringify(text))
  check('free: report has no connector warning for it', (await page.getByText('No matching connector').count()) === 0)

  // a genuine mismatch (RCA-only interface into TRS/XLR monitors): adapter, and the report warns too
  await page.getByRole('button', { name: 'New chain' }).click()
  await addDevice('U-Phoria UM2')
  await addDevice('Yamaha HS5')
  text = await section.innerText()
  const adapterShown = /adapter/.test(text)
  const reportWarns = (await page.getByText('No matching connector').count()) > 0
  check('free: RCA-only interface → monitor shows an adapter line', adapterShown && /RCA → TRS\/XLR adapter/.test(text), JSON.stringify(text))
  check('free: report warns in the same place (consistency)', reportWarns === adapterShown)
  await page.screenshot({ path: SHOTS + 'm1-adapter.png', fullPage: true })

  // chain with a DAW first -> skipped note
  await page.getByRole('button', { name: 'New chain' }).click()
  await addDevice('Ableton Live 12')
  await addDevice('Yamaha HS5')
  text = await section.innerText()
  check('free: unresolvable pair is listed as not included', /Not included \(no connector data\): Live 12 → HS5/.test(text), JSON.stringify(text))
  check('free: shows the "no cables" message when nothing resolves', /No cables could be worked out/.test(text))

  check('free: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ---------- PRO USER sees the same ----------
{
  const { ctx, errors, section, addDevice } = await session({ pro: true })
  await addDevice('SM7B')
  await addDevice('Scarlett 2i2')
  const text = await section.innerText()
  check('pro: panel works too', /XLR cable/.test(text))
  check('pro: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
