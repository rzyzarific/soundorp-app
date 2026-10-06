import { APP_URL, OUT_DIR, launch } from './lib.mjs'

const APP = APP_URL + '/'
const SHOTS = OUT_DIR
const results = []
const check = (name, ok, extra = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`)
}

const browser = await launch()
const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.route('**/_vercel/**', (route) => route.abort())

await page.goto(APP)
const add = page.getByRole('button', { name: /^Add/ })
const save = page.getByRole('button', { name: /^Save$/ })

await add.nth(0).click()
await save.click()
check('first save succeeds', await page.getByRole('button', { name: 'Saved ✓' }).isVisible())

await page.getByRole('button', { name: 'New chain' }).click()
await add.nth(1).click()
await page.getByRole('button', { name: /^Save$/ }).click()
const upgrade = page.getByRole('button', { name: 'Upgrade to Pro' })
check('second save shows limit popover with Upgrade button', await upgrade.isVisible())
check('popover still has Dismiss', await page.getByRole('button', { name: 'Dismiss' }).isVisible())
await page.screenshot({ path: SHOTS + 'm0b-limit-popover.png' })

// Dismiss still works on its own
await page.getByRole('button', { name: 'Dismiss' }).click()
check('Dismiss closes popover without opening modal', (await upgrade.count()) === 0 && (await page.getByRole('dialog').count()) === 0)

// Trigger again, then Upgrade
await page.getByRole('button', { name: /^Save$/ }).click()
await page.getByRole('button', { name: 'Upgrade to Pro' }).click()
const dialog = page.getByRole('dialog')
check('Upgrade opens the modal', await dialog.isVisible())
check('modal has unlimited-chains copy', (await dialog.innerText()).includes('Save unlimited chains with Pro'))
check('popover closed when modal opens', (await page.getByText('Free accounts can save 1 chain').count()) === 0)
await page.screenshot({ path: SHOTS + 'm0b-limit-modal.png' })
check('modal links to checkout', (await dialog.getByRole('link', { name: 'Get Pro' }).getAttribute('href')).includes('lemonsqueezy.com/checkout'))

await page.keyboard.press('Escape')
check('Escape closes modal', (await page.getByRole('dialog').count()) === 0)
check('first saved chain untouched', (await page.evaluate(() => JSON.parse(localStorage.getItem('soundorp:signal-chain-builder:saved-chains')).length)) === 1)
check('no page errors', errors.length === 0, errors.join('; '))

await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
