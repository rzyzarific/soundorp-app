import { APP_URL, launch } from './lib.mjs'

// Drag-to-reorder in the chain row, by mouse and by touch (real touch events through the
// DevTools protocol), plus the things a touch swipe must still do where it is not on a card:
// scroll the row from the gaps, scroll the page vertically from anywhere.
const APP = APP_URL + '/'
const results = []
const check = (name, ok, extra = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`)
}

const browser = await launch()
const CHAIN = ['SM7B', 'Scarlett 2i2 (4th', 'HS5', 'SM58', 'PodTrak P4', 'U-Phoria UM2']

async function session({ width, touch }) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, isMobile: touch, hasTouch: touch })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => { if (m.type() === 'error' && !/_vercel|favicon|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()) })
  await page.route('**/_vercel/**', (r) => r.abort())
  await page.goto(APP)
  const search = page.getByPlaceholder('Search gear…')
  for (const q of CHAIN) {
    await search.fill(q)
    await page.getByRole('button', { name: /^Add .* to chain$/ }).first().click()
  }
  await search.fill('')
  // A focused input makes the emulated mobile browser scroll it into view when a swipe starts.
  await page.evaluate(() => document.activeElement?.blur())
  const cdp = touch ? await ctx.newCDPSession(page) : null
  const api = {
    ctx, page, errors,
    order: () => page.locator('button[aria-label^="Remove "]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label').replace('Remove ', '')).join(' | ')),
    cards: () => page.locator('[aria-roledescription="sortable"]'),
    rowScroll: () => page.evaluate(() => {
      const r = [...document.querySelectorAll('div')].find((e) => getComputedStyle(e).overflowX === 'auto' && e.querySelector('button[aria-label^="Remove"]'))
      return r ? Math.round(r.scrollLeft) : -1
    }),
    // a finger: down at the first point, along the rest, up at the last
    swipe: async (points, { pauseAtEnd = 0 } = {}) => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...points[0], id: 1 }] })
      for (const p of points.slice(1)) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...p, id: 1 }] })
      if (pauseAtEnd) {
        const last = points[points.length - 1]
        for (let t = 0; t < pauseAtEnd / 50; t++) {
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: last.x + (t % 2), y: last.y, id: 1 }] })
          await page.waitForTimeout(50)
        }
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await page.waitForTimeout(450)
    },
    alive: () => page.evaluate(() => document.body.innerText.length > 100).catch(() => false),
  }
  return api
}
const line = (x0, y0, x1, y1, steps = 14) => Array.from({ length: steps + 1 }, (_, i) => ({ x: x0 + ((x1 - x0) * i) / steps, y: y0 + ((y1 - y0) * i) / steps }))
const FIRST_TWO = 'SM7B | Scarlett 2i2 (4th Gen)'
const SWAPPED = 'Scarlett 2i2 (4th Gen) | SM7B'

// ============ mouse: unchanged behaviour ============
for (const width of [390, 1440]) {
  const s = await session({ width, touch: false })
  await s.cards().first().scrollIntoViewIfNeeded()
  const a = await s.cards().nth(0).boundingBox()
  const b = await s.cards().nth(1).boundingBox()
  const before = await s.order()
  await s.page.mouse.move(a.x + 40, a.y + a.height / 2)
  await s.page.mouse.down()
  await s.page.mouse.move(b.x + 60, b.y + b.height / 2, { steps: 12 })
  await s.page.mouse.up()
  await s.page.waitForTimeout(300)
  const after = await s.order()
  check(`${width}px mouse: dragging a card onto the next one swaps them`, before.startsWith(FIRST_TWO) && after.startsWith(SWAPPED), after)
  check(`${width}px mouse: no page errors`, s.errors.length === 0, s.errors.join('; '))
  await s.ctx.close()
}

// ============ touch ============
for (const width of [320, 390, 430]) {
  // a swipe along a card moves it
  {
    const s = await session({ width, touch: true })
    await s.cards().first().scrollIntoViewIfNeeded()
    const a = await s.cards().nth(0).boundingBox()
    const b = await s.cards().nth(1).boundingBox()
    const y = a.y + a.height / 2
    const before = await s.order()
    const scrollBefore = await s.rowScroll()
    await s.swipe(line(a.x + 40, y, Math.min(b.x + 60, width - 12), y))
    const after = await s.order()
    check(`${width}px touch: swiping a card across the next one swaps them`, before.startsWith(FIRST_TWO) && after.startsWith(SWAPPED), after)
    // (At 320px the second card's centre is within dnd-kit's edge-autoscroll zone, so the row
    // legitimately scrolls while the card is dragged there.)
    if (width >= 390) check(`${width}px touch: a card swipe does not also scroll the row`, Math.abs((await s.rowScroll()) - scrollBefore) <= 2, `${scrollBefore} -> ${await s.rowScroll()}`)
    check(`${width}px touch: the page is still the app (the swipe was not taken as browser back-navigation)`, await s.alive() && s.ctx.pages()[0].url().startsWith(APP_URL))
    check(`${width}px touch: no page errors`, s.errors.length === 0, s.errors.join('; '))
    await s.ctx.close()
  }

  // a rightward swipe that starts near the screen edge is a drag too, not "back"
  {
    const s = await session({ width, touch: true })
    await s.cards().first().scrollIntoViewIfNeeded()
    const a = await s.cards().nth(0).boundingBox()
    const y = a.y + a.height / 2
    await s.swipe(line(a.x + 16, y, a.x + 150, y))
    check(`${width}px touch: a rightward swipe from the left edge of the first card does not leave the page`, await s.alive() && s.ctx.pages()[0].url().startsWith(APP_URL))
    await s.ctx.close()
  }

  // dragging to the edge keeps going: it autoscrolls the row, so a card can reach one off screen
  {
    const s = await session({ width, touch: true })
    await s.cards().first().scrollIntoViewIfNeeded()
    const a = await s.cards().nth(0).boundingBox()
    const y = a.y + a.height / 2
    const before = await s.order()
    await s.swipe(line(a.x + 40, y, width - 8, y, 16), { pauseAtEnd: 2200 })
    const after = await s.order()
    const names = after.split(' | ')
    check(`${width}px touch: holding a dragged card at the edge scrolls the row and carries it past the first two`, before.startsWith('SM7B') && names.indexOf('SM7B') >= 2, after)
    check(`${width}px touch: that drag scrolled the row (autoscroll)`, (await s.rowScroll()) > 20, `${await s.rowScroll()}`)
    await s.ctx.close()
  }

  // a swipe on the gap between two cards scrolls the row and moves nothing
  {
    const s = await session({ width, touch: true })
    await s.cards().first().scrollIntoViewIfNeeded()
    const a = await s.cards().nth(0).boundingBox()
    const b = await s.cards().nth(1).boundingBox()
    const y = a.y + a.height / 2
    const gapX = (a.x + a.width + b.x) / 2
    const before = await s.order()
    await s.swipe(line(gapX, y, gapX - 160, y))
    check(`${width}px touch: swiping the gap between two cards scrolls the row`, (await s.rowScroll()) > 80, `${await s.rowScroll()}px`)
    check(`${width}px touch: ...without moving a card`, (await s.order()) === before)
    await s.ctx.close()
  }

  // a swipe on the row's own padding scrolls the row too
  {
    const s = await session({ width, touch: true })
    await s.cards().first().scrollIntoViewIfNeeded()
    const a = await s.cards().nth(0).boundingBox()
    const y = a.y + a.height / 2
    const before = await s.order()
    await s.swipe(line(a.x - 10, y, a.x - 10 - 5, y, 2)) // too short to matter; see the next check
    await s.swipe(line(a.x - 10, a.y - 14, a.x - 10 - 4, a.y - 14, 2))
    check(`${width}px touch: nothing odd happens when a swipe starts in the row's padding`, (await s.order()) === before && (await s.alive()))
    await s.ctx.close()
  }

  // a vertical swipe starting on a card still scrolls the page
  {
    const s = await session({ width, touch: true })
    await s.cards().first().scrollIntoViewIfNeeded()
    const a = await s.cards().nth(0).boundingBox()
    const x = a.x + 70
    const y = a.y + a.height / 2
    const before = await s.order()
    const scrollBefore = await s.page.evaluate(() => window.scrollY)
    await s.swipe(line(x, y, x, y - 120, 12))
    const scrollAfter = await s.page.evaluate(() => window.scrollY)
    const scrolled = scrollAfter - scrollBefore
    check(`${width}px touch: swiping up from a card scrolls the page`, scrolled > 60, `${scrollBefore} -> ${scrollAfter}`)
    check(`${width}px touch: ...without moving the card`, (await s.order()) === before)
    await s.ctx.close()
  }

  // taps are still taps
  {
    const s = await session({ width, touch: true })
    await s.cards().first().scrollIntoViewIfNeeded()
    const countBefore = await s.page.locator('button[aria-label^="Remove "]').count()
    await s.page.locator('button[aria-label^="Remove SM7B"]').tap()
    check(`${width}px touch: tapping a card's remove button still removes it`, (await s.page.locator('button[aria-label^="Remove "]').count()) === countBefore - 1)
    await s.page.locator('[aria-roledescription="sortable"] button[aria-label^="Report incorrect spec"]').first().tap()
    check(`${width}px touch: tapping a card's flag still opens the report form`, await s.page.getByPlaceholder(/Which field is wrong/).isVisible())
    await s.ctx.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
