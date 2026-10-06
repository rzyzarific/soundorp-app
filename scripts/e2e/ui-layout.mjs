import { APP_URL, OUT_DIR, launch } from './lib.mjs'
import fs from 'node:fs'

// Layout / popover / navbar checks against `vite preview` (production build); see README.md.
// SECTIONS=overflow,toolbar,popover,navbar (default: all that exist in this build)
const APP = APP_URL
const SECTIONS = (process.env.SECTIONS || 'overflow,toolbar,popover,navbar').split(',')
const OUT = OUT_DIR
const WIDTHS = [320, 360, 390, 430, 768, 1024, 1440]
const results = []
const check = (name, ok, extra = '') => {
  results.push({ name, ok })
  if (!ok || process.env.VERBOSE) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`)
}

const browser = await launch()

const LONG = ['SM7B', 'Scarlett 2i2 (4th', 'HS5', 'SM58', 'SM58', 'Scarlett 2i2 (4th', 'PodTrak P4', 'HS5', 'SM7B', 'U-Phoria UM2', 'HS5', 'SM58', 'SM57', 'RE20', 'Scarlett 2i2 (4th', 'HS5', 'SM7B', 'U-Phoria UM2', 'HS5', 'SM58']

async function open(w, { pro = false, path = '/', touch } = {}) {
  const mobile = touch ?? w < 700
  const ctx = await browser.newContext({ viewport: { width: w, height: w >= 1000 ? 900 : 844 }, isMobile: mobile, hasTouch: mobile })
  if (pro)
    await ctx.addInitScript(() => localStorage.setItem('soundorp:signal-chain-builder:license', JSON.stringify({ licenseKey: 'k', instanceId: 'i' })))
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => { if (m.type() === 'error' && !/_vercel|favicon|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()) })
  await page.route('**/_vercel/**', (r) => r.abort())
  await page.goto(APP + path)
  return { ctx, page, errors }
}
async function addDevices(page, list) {
  const search = page.getByPlaceholder('Search gear…')
  for (const q of list) {
    await search.fill(q)
    await page.getByRole('button', { name: /^Add .* to chain$/ }).first().click()
  }
  await search.fill('')
}
const pageOverflow = (page) => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }))
const noPageScroll = async (page, label, w) => {
  const { sw, cw } = await pageOverflow(page)
  check(`${w}px ${label}: no page-level horizontal scroll`, sw <= cw, `scrollWidth ${sw} > clientWidth ${cw}`)
}

// ---------- overflow ----------
if (SECTIONS.includes('overflow')) {
  for (const w of WIDTHS) {
    // empty, 4, 12, 20 devices
    {
      const { ctx, page, errors } = await open(w)
      await page.getByPlaceholder('Search gear…').waitFor()
      await noPageScroll(page, 'empty chain', w)
      let have = 0
      for (const n of [4, 12, 20]) {
        await addDevices(page, LONG.slice(have, n)); have = n
        const count = await page.locator('button[aria-label^="Remove "]').count()
        check(`${w}px: chain really has ${n} devices`, count === n, `${count}`)
        await noPageScroll(page, `${n} devices`, w)
      }
      // the row must scroll inside itself, and moving it must not move anything else
      const rects = () => page.evaluate(() => {
        const r = (el) => (el ? Math.round(el.getBoundingClientRect().x * 10) / 10 : null)
        const row = [...document.querySelectorAll('div')].find((e) => getComputedStyle(e).overflowX === 'auto' && e.querySelector('button[aria-label^="Remove"]'))
        return {
          library: r(document.querySelector('input[placeholder="Search gear…"]').parentElement),
          toolbar: r(document.querySelector('input[value]:not([placeholder])')?.closest('div.rounded-xl')),
          report: r([...document.querySelectorAll('h2')].find((e) => /Compatibility Report/.test(e.textContent))),
          nav: r(document.querySelector('nav')),
          scrollX: window.scrollX,
          rowScrollable: row.scrollWidth > row.clientWidth + 10,
          rowW: Math.round(row.getBoundingClientRect().width), vw: innerWidth,
        }
      })
      const before = await rects()
      await page.evaluate(() => {
        const row = [...document.querySelectorAll('div')].find((e) => getComputedStyle(e).overflowX === 'auto' && e.querySelector('button[aria-label^="Remove"]'))
        row.scrollLeft = row.scrollWidth
      })
      const after = await rects()
      check(`${w}px: the 20-device row scrolls inside itself`, before.rowScrollable, JSON.stringify(before))
      check(`${w}px: the row is narrower than the viewport`, before.rowW <= before.vw, `${before.rowW} vs ${before.vw}`)
      check(`${w}px: scrolling the row moves nothing else (library, toolbar, report, navbar, page)`,
        before.library === after.library && before.toolbar === after.toolbar && before.report === after.report && before.nav === after.nav && after.scrollX === 0,
        JSON.stringify({ before, after }))
      check(`${w}px: no page errors`, errors.length === 0, errors.join('; '))
      if (w === 1440 || w === 390) await page.screenshot({ path: OUT + `after-${w}-chain-row-end.png` })
      await ctx.close()
    }

    // banners: signal-flow hint (non-conventional order), skipped-devices banner, over-budget
    {
      const { ctx, page } = await open(w, { pro: true })
      await page.getByPlaceholder('Search gear…').waitFor()
      await addDevices(page, ['HS5', 'SM7B', 'Scarlett 2i2 (4th', 'SM58', 'PodTrak P4', 'HS5'])
      await page.getByLabel('Budget').fill('50')
      check(`${w}px: signal-flow hint is showing`, await page.getByText(/Typical signal flow/).isVisible())
      check(`${w}px: over-budget message is showing`, /over/i.test(await page.locator('body').innerText()))
      await noPageScroll(page, 'banners visible', w)
      await ctx.close()
    }
  }
}

// ---------- toolbar ----------
if (SECTIONS.includes('toolbar')) {
  for (const w of [320, 360, 390, 430]) {
    for (const pro of [false, true]) {
      const { ctx, page } = await open(w, { pro })
      await page.getByPlaceholder('Search gear…').waitFor()
      const info = await page.evaluate(() => {
        const t = document.querySelector('input[value]:not([placeholder])').closest('div.rounded-xl')
        const controls = [...t.querySelectorAll('.toolbar-actions > button, .toolbar-actions > a, .toolbar-actions > span, .toolbar-actions > div > button')]
        return controls.map((c) => { const b = c.getBoundingClientRect(); return { text: c.textContent.trim(), h: Math.round(b.height), right: Math.round(b.right), left: Math.round(b.left) } })
      })
      check(`${w}px ${pro ? 'pro' : 'free'}: toolbar has its controls`, info.length >= (pro ? 7 : 8) - 1, `${info.length}`)
      check(`${w}px ${pro ? 'pro' : 'free'}: every toolbar control is at least 44px tall`, info.every((c) => c.h >= 44), JSON.stringify(info.filter((c) => c.h < 44)))
      check(`${w}px ${pro ? 'pro' : 'free'}: no toolbar control leaves the screen`, info.every((c) => c.left >= 0 && c.right <= w), JSON.stringify(info.filter((c) => c.left < 0 || c.right > w)))
      await noPageScroll(page, 'toolbar', w)
      if (!pro && (w === 390 || w === 320)) await page.screenshot({ path: OUT + `after-${w}-toolbar.png` })
      await ctx.close()
    }
  }
}

// ---------- popovers ----------
const MODES = (w) => (w <= 768 ? ['touch', 'mouse'] : ['mouse'])
const dialogInfo = (page) =>
  page.evaluate(() => {
    const dialogs = [...document.querySelectorAll('[role="dialog"]')]
    const d = dialogs[dialogs.length - 1]
    if (!d) return { count: 0 }
    const r = d.getBoundingClientRect()
    const vw = document.documentElement.clientWidth, vh = innerHeight
    const nav = document.querySelector('[data-sticky-top]')
    const navBottom = nav ? nav.getBoundingClientRect().bottom : 0
    const hit = (el) => {
      if (!el) return null
      const b = el.getBoundingClientRect()
      const cx = b.left + b.width / 2, cy = b.top + b.height / 2
      const top = document.elementFromPoint(cx, cy)
      return { visible: b.width > 0 && b.height > 0 && cx >= 0 && cy >= 0 && cx <= vw && cy <= vh, hit: !!top && (top === el || el.contains(top)) }
    }
    const byText = (t) => [...d.querySelectorAll('button')].find((b) => b.textContent.trim() === t || b.getAttribute('aria-label') === t)
    return {
      count: dialogs.length,
      rect: { left: Math.round(r.left * 10) / 10, top: Math.round(r.top * 10) / 10, right: Math.round(r.right * 10) / 10, bottom: Math.round(r.bottom * 10) / 10 },
      vw, vh, navBottom,
      cancel: hit(byText('Cancel')), send: hit(byText('Send')), dismiss: hit(byText('Dismiss')), close: hit(byText('Close')),
      pageScroll: document.documentElement.scrollWidth <= vw,
    }
  })
// A modal covers the whole screen, navbar included: it only has to be on screen.
const insideScreen = (i) => i.rect.left >= 0 && i.rect.right <= i.vw && i.rect.top >= 0 && i.rect.bottom <= i.vh
const insideViewport = (i, margin = 8) => i.rect.left >= margin - 0.5 && i.rect.right <= i.vw - margin + 0.5 && i.rect.top >= Math.max(margin, i.navBottom + margin) - 0.5 && i.rect.bottom <= i.vh - margin + 0.5

if (SECTIONS.includes('popover')) {
  const FLAG = 'button[aria-label^="Report incorrect spec"]'
  const CASES = [
    ['library-first', 4],
    ['library-last', 4],
    ['chain-far-left', 20],
    ['chain-far-right', 20],
    ['chain-card-11-of-20', 20],
    ['4-chain-first', 4],
    ['4-chain-last', 4],
  ]
  for (const w of WIDTHS) {
    for (const mode of MODES(w)) {
      const touch = mode === 'touch'
      const press = (loc) => (touch ? loc.tap() : loc.click())
      for (const n of [4, 20]) {
        const { ctx, page, errors } = await open(w, { touch })
        await page.getByPlaceholder('Search gear…').waitFor()
        await addDevices(page, LONG.slice(0, n))
        const scrollRow = (to) => page.evaluate((to) => {
          const row = [...document.querySelectorAll('div')].find((e) => getComputedStyle(e).overflowX === 'auto' && e.querySelector('button[aria-label^="Remove"]'))
          row.scrollLeft = to === 'end' ? row.scrollWidth : to
        }, to)
        const chainFlags = page.locator('div[class*="overflow-x-auto"] ' + FLAG)
        const libFlags = page.locator('div.overflow-y-auto ' + FLAG)
        for (const [name] of CASES.filter(([, s]) => s === n)) {
          const tag = `${w}px ${mode} ${name}`
          let trigger
          if (name === 'library-first') { await page.evaluate(() => { document.querySelector('div.overflow-y-auto').scrollTop = 0 }); trigger = libFlags.first() }
          else if (name === 'library-last') { await page.evaluate(() => { const l = document.querySelector('div.overflow-y-auto'); l.scrollTop = l.scrollHeight }); trigger = libFlags.last() }
          else if (name.endsWith('far-left') || name === '4-chain-first') { await scrollRow(0); trigger = chainFlags.first() }
          else if (name.endsWith('far-right') || name === '4-chain-last') { await scrollRow('end'); trigger = chainFlags.last() }
          else { trigger = chainFlags.nth(10); await trigger.scrollIntoViewIfNeeded() }
          await trigger.scrollIntoViewIfNeeded()
          await press(trigger)
          await page.getByPlaceholder(/Which field is wrong/).waitFor({ timeout: 3000 }).catch(() => {})
          const info = await dialogInfo(page)
          check(`${tag}: popover opened, exactly one dialog`, info.count === 1, `${info.count}`)
          if (info.count !== 1) { await ctx.close(); continue }
          check(`${tag}: fully inside the viewport (8px margin)`, insideViewport(info), JSON.stringify({ rect: info.rect, vw: info.vw, vh: info.vh, navBottom: info.navBottom }))
          check(`${tag}: Cancel and Send are visible and not covered`, info.cancel?.visible && info.cancel?.hit && info.send?.visible && info.send?.hit, JSON.stringify({ c: info.cancel, s: info.send }))
          check(`${tag}: no page-level horizontal scroll while open`, info.pageScroll)
          if ((w === 1440 || w === 390) && (mode !== 'touch') === (w === 1440) && name === 'chain-far-right') await page.screenshot({ path: OUT + `after-${w}-${mode}-popover-${name}.png` })
          // a real click on Send really submits (the mailto navigation is intercepted)
          await page.evaluate(() => {
            const f = [...document.querySelectorAll('[role="dialog"] form')].pop()
            window.__submits = 0
            f.addEventListener('submit', (e) => { e.preventDefault(); e.stopPropagation(); window.__submits++ })
          })
          await press(page.locator('[role="dialog"] button', { hasText: /^Send$/ }))
          check(`${tag}: clicking Send submits the form`, (await page.evaluate(() => window.__submits)) === 1)
          await press(page.locator('[role="dialog"] button', { hasText: /^Cancel$/ }))
          check(`${tag}: Cancel closes it`, (await page.locator('[role="dialog"]').count()) === 0)
        }
        check(`${w}px ${mode} (${n}-device chain): no page errors`, errors.length === 0, errors.join('; '))
        await ctx.close()
      }
    }
  }

  // behaviours, on a desktop-size screen (anchored popover) and on a phone (centered modal)
  for (const [w, touch] of [[1440, false], [1024, false], [390, true]]) {
    const anchored = w >= 640
    const press = (loc) => (touch ? loc.tap() : loc.click())
    const { ctx, page, errors } = await open(w, { touch })
    await page.getByPlaceholder('Search gear…').waitFor()
    await addDevices(page, LONG.slice(0, 20))
    const chainFlags = page.locator('div[class*="overflow-x-auto"] ' + FLAG)
    const tag = `${w}px${touch ? ' touch' : ''}`
    const dialogs = () => page.locator('[role="dialog"]').count()
    const focusedIsTrigger = (el) => el.evaluate((n) => document.activeElement === n)

    // Escape closes and focus goes back to the flag
    let flag = chainFlags.nth(3)
    await flag.scrollIntoViewIfNeeded(); await press(flag)
    await page.getByPlaceholder(/Which field is wrong/).waitFor()
    check(`${tag}: focus moves into the popover (the field)`, await page.evaluate(() => document.activeElement?.getAttribute('placeholder')?.startsWith('Which field')))
    await page.keyboard.press('Escape')
    check(`${tag}: Escape closes`, (await dialogs()) === 0)
    check(`${tag}: focus returns to the flag that opened it`, await focusedIsTrigger(await flag.elementHandle()))

    // outside press closes (backdrop on a phone)
    await press(flag)
    await page.getByPlaceholder(/Which field is wrong/).waitFor()
    if (touch) await page.touchscreen.tap(3, 3); else await page.mouse.click(3, 700)
    check(`${tag}: pressing outside closes`, (await dialogs()) === 0)

    if (anchored) {
      // Tab never leaves the popover
      await press(flag)
      await page.getByPlaceholder(/Which field is wrong/).waitFor()
      let stays = true
      for (let i = 0; i < 7; i++) {
        await page.keyboard.press('Tab')
        stays = stays && (await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')))
      }
      for (let i = 0; i < 7; i++) {
        await page.keyboard.press('Shift+Tab')
        stays = stays && (await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')))
      }
      check(`${tag}: Tab and Shift+Tab stay inside the popover`, stays)

      // dragging inside the comment box must not drag the card
      const orderBefore = await page.locator('button[aria-label^="Remove "]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')).join('|'))
      const box = await page.locator('[role="dialog"] textarea').boundingBox()
      await page.mouse.move(box.x + 20, box.y + 10)
      await page.mouse.down()
      await page.mouse.move(box.x + 150, box.y + 20, { steps: 8 })
      await page.mouse.move(box.x + 260, box.y + 60, { steps: 8 })
      await page.mouse.up()
      const orderAfter = await page.locator('button[aria-label^="Remove "]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')).join('|'))
      check(`${tag}: dragging the mouse inside the comment box does not move the chain card`, orderBefore === orderAfter && (await dialogs()) === 1)
      await page.keyboard.press('Escape')

      // scrolling the row: the popover follows the flag, and goes when the flag is scrolled away
      await page.evaluate(() => {
        const row = [...document.querySelectorAll('div')].find((e) => getComputedStyle(e).overflowX === 'auto' && e.querySelector('button[aria-label^="Remove"]'))
        row.scrollLeft = 0
      })
      flag = chainFlags.nth(1)
      await press(flag)
      await page.getByPlaceholder(/Which field is wrong/).waitFor()
      await page.evaluate(() => {
        const row = [...document.querySelectorAll('div')].find((e) => getComputedStyle(e).overflowX === 'auto' && e.querySelector('button[aria-label^="Remove"]'))
        row.scrollLeft = 60
      })
      await page.waitForTimeout(200)
      const fl = await flag.boundingBox()
      const dlg = await dialogInfo(page)
      check(`${tag}: after scrolling the row a little, the popover is still open and follows its flag`, dlg.count === 1 && Math.abs(dlg.rect.right - (fl.x + fl.width)) <= 1.5 && insideViewport(dlg), JSON.stringify({ fl, dlg: dlg.rect }))
      await page.evaluate(() => {
        const row = [...document.querySelectorAll('div')].find((e) => getComputedStyle(e).overflowX === 'auto' && e.querySelector('button[aria-label^="Remove"]'))
        row.scrollLeft = row.scrollWidth
      })
      await page.waitForTimeout(250)
      check(`${tag}: once the flag is scrolled out of its row the popover closes`, (await dialogs()) === 0)

      // a change of window width closes it; a change of height alone does not
      await page.evaluate(() => { const row = [...document.querySelectorAll('div')].find((e) => getComputedStyle(e).overflowX === 'auto' && e.querySelector('button[aria-label^="Remove"]')); row.scrollLeft = 0 })
      await press(chainFlags.nth(1))
      await page.getByPlaceholder(/Which field is wrong/).waitFor()
      await page.setViewportSize({ width: w, height: 600 })
      await page.waitForTimeout(150)
      check(`${tag}: a height-only resize (soft keyboard) keeps it open, still on screen`, (await dialogs()) === 1 && insideViewport(await dialogInfo(page)))
      await page.setViewportSize({ width: w - 40, height: 600 })
      await page.waitForTimeout(150)
      check(`${tag}: a change of window width closes it`, (await dialogs()) === 0)
    }
    check(`${tag}: no page errors`, errors.length === 0, errors.join('; '))
    await ctx.close()
  }

  // the toolbar's popovers and the modals, wherever their buttons end up
  for (const w of WIDTHS) {
    for (const mode of MODES(w)) {
      const touch = mode === 'touch'
      const press = (loc) => (touch ? loc.tap() : loc.click())
      const tag = (s) => `${w}px ${mode} ${s}`
      const verify = async (name, closers) => {
        const i = await dialogInfo(page)
        check(tag(`${name}: opens, one dialog`), i.count === 1, `${i.count}`)
        if (i.count !== 1) return
        check(tag(`${name}: fully inside the viewport`), insideViewport(i), JSON.stringify({ rect: i.rect, vw: i.vw, vh: i.vh }))
        check(tag(`${name}: no page-level horizontal scroll`), i.pageScroll)
        const closeKey = closers.find((c) => i[c.toLowerCase()]?.visible)
        check(tag(`${name}: has a visible, uncovered close control`), !!closeKey && i[closeKey.toLowerCase()].hit, JSON.stringify(i))
        await page.keyboard.press('Escape')
        check(tag(`${name}: Escape closes`), (await page.locator('[role="dialog"]').count()) === 0)
      }
      var { ctx, page } = await open(w, { touch })
      await page.getByPlaceholder('Search gear…').waitFor()
      await addDevices(page, ['SM7B', 'Scarlett 2i2 (4th'])
      await press(page.getByRole('button', { name: 'I have a key', exact: true }))
      await verify('license key form', ['Cancel'])
      await press(page.getByRole('button', { name: 'Saved chains', exact: true }))
      await verify('saved chains', ['Close'])
      // the free cap: one saved chain, then a second is refused with a popover
      await press(page.getByRole('button', { name: 'Save', exact: true }))
      await press(page.getByRole('button', { name: 'New chain', exact: true }))
      await addDevices(page, ['SM58'])
      await press(page.getByRole('button', { name: 'Save', exact: true }))
      await verify('save-limit', ['Dismiss'])
      // the share box shown when the clipboard refuses
      await page.evaluate(() => { navigator.clipboard.writeText = () => Promise.reject(new Error('denied')) })
      await press(page.getByRole('button', { name: 'Copy permanent link', exact: true }))
      await verify('share fallback', ['Close'])
      // PDF message, for a Pro user with one device
      await ctx.close()
      ;({ ctx, page } = await open(w, { touch, pro: true }))
      await page.getByPlaceholder('Search gear…').waitFor()
      await addDevices(page, ['SM7B'])
      await press(page.getByRole('button', { name: /Export PDF/ }))
      await verify('pdf message', ['Dismiss'])
      await ctx.close()
      ;({ ctx, page } = await open(w, { touch }))
      await page.getByPlaceholder('Search gear…').waitFor()
      await press(page.getByRole('button', { name: /Export PDF/ }))
      {
        const i = await dialogInfo(page)
        check(tag('upgrade modal: opens inside the viewport, no page scroll'), i.count === 1 && insideScreen(i) && i.pageScroll, JSON.stringify(i))
        await page.keyboard.press('Escape')
      }
      await press(page.getByRole('button', { name: /Add custom device/ }))
      {
        const i = await dialogInfo(page)
        check(tag('custom device modal: opens inside the viewport, no page scroll'), i.count === 1 && insideScreen(i) && i.pageScroll, JSON.stringify(i))
        // it must be a direct child of <body> (portaled), not nested in the library card
        check(tag('custom device modal: rendered in <body>, not inside the library card'), await page.evaluate(() => document.querySelector('[role="dialog"]').parentElement.parentElement === document.body))
        await page.keyboard.press('Escape')
      }
      await ctx.close()
    }
  }
}

// ---------- navbar ----------
if (SECTIONS.includes('navbar')) {
  const links = JSON.parse(fs.readFileSync(new URL('./fixtures/prod-links.json', import.meta.url), 'utf8'))
  const EXPECT = [
    ['Gear Guide', 'https://soundorp.com/equipments/'],
    ['Blog', 'https://soundorp.com/blog/'],
    ['Contact', 'https://soundorp.com/contact/'],
  ]
  const PAGES = [
    ['builder', '/'],
    ['public chain page', '/c/' + links.v2],
    ['invalid-link page', '/c/garbage'],
  ]
  for (const w of WIDTHS) {
    for (const [pageName, path] of PAGES) {
      const mode = w <= 768 ? 'touch' : 'mouse'
      const touch = mode === 'touch'
      const tag = (s) => `${w}px ${pageName}: ${s}`
      const { ctx, page, errors } = await open(w, { touch, path })
      await page.locator('nav').waitFor()
      const nav = await page.evaluate(() => {
        const header = document.querySelector('header[data-sticky-top]')
        const a = (el) => el && { text: el.textContent.replace(/\(opens in a new tab\)/, '').trim(), href: el.getAttribute('href'), target: el.getAttribute('target'), rel: el.getAttribute('rel'), visible: el.offsetParent !== null || getComputedStyle(el).position === 'fixed' }
        const anchors = [...header.querySelectorAll('a')]
        const cur = header.querySelector('[aria-current="page"]')
        const burger = header.querySelector('button[aria-expanded]')
        return {
          count: document.querySelectorAll('header[data-sticky-top]').length,
          h: Math.round(header.getBoundingClientRect().height), top: Math.round(header.getBoundingClientRect().top),
          position: getComputedStyle(header).position,
          bg: getComputedStyle(header).backgroundColor, border: getComputedStyle(header).borderBottomColor,
          anchors: anchors.map(a),
          cur: cur && { text: cur.textContent.trim(), tag: cur.tagName, inLink: !!cur.closest('a'), visible: cur.offsetParent !== null },
          burger: burger && { visible: burger.offsetParent !== null, expanded: burger.getAttribute('aria-expanded'), w: Math.round(burger.getBoundingClientRect().width), h: Math.round(burger.getBoundingClientRect().height) },
          font: getComputedStyle(anchors[0]).fontFamily, wordmarkColor: getComputedStyle(anchors[0]).color,
          pageButtons: [...document.querySelectorAll('button')].filter((b) => !b.closest('nav')).length,
        }
      })
      check(tag('exactly one navbar'), nav.count === 1)
      check(tag('navbar is 56px tall, sticky, #0a0a0a with a #262626 border'), nav.h === 57 || nav.h === 56 ? nav.position === 'sticky' && nav.bg === 'rgb(10, 10, 10)' && nav.border === 'rgb(38, 38, 38)' : false, JSON.stringify(nav))
      check(tag('Orbitron wordmark in brand red #EE1D1D'), /Orbitron/.test(nav.font) && nav.wordmarkColor === 'rgb(238, 29, 29)', `${nav.font} ${nav.wordmarkColor}`)
      const brand = nav.anchors.find((x) => x.text === 'soundorp')
      check(tag('wordmark links to https://soundorp.com in a new tab (noopener)'), brand?.href === 'https://soundorp.com' && brand.target === '_blank' && brand.rel.split(' ').includes('noopener'), JSON.stringify(brand))
      const wide = w >= 768
      for (const [label, href] of EXPECT) {
        const el = nav.anchors.find((x) => x.text === label)
        // the links exist in the DOM only when shown: inline on wide screens, in the open menu otherwise
        if (wide) check(tag(`${label} links to ${href}, new tab, noopener`), el?.href === href && el.target === '_blank' && el.rel.split(' ').includes('noopener') && el.visible, JSON.stringify(el))
      }
      check(tag('current section "Signal Chain Builder" is shown from 640px, and is not a link'), nav.cur?.text === 'Signal Chain Builder' && !nav.cur.inLink && (w >= 640 ? nav.cur.visible : true) && nav.cur.tag !== 'A', JSON.stringify(nav.cur))
      check(tag(wide ? 'no hamburger on wide screens' : 'hamburger shown, 44x44'), wide ? !nav.burger.visible : nav.burger.visible && nav.burger.w >= 44 && nav.burger.h >= 44, JSON.stringify(nav.burger))
      await noPageScroll(page, 'navbar', w)
      if (pageName !== 'builder') check(tag('the page itself has no buttons outside the navbar'), nav.pageButtons === 0, `${nav.pageButtons}`)

      // sticky: stays at the top of the screen while the page scrolls
      await page.evaluate(() => window.scrollTo(0, 5000))
      const stuck = await page.evaluate(() => Math.round(document.querySelector('header[data-sticky-top]').getBoundingClientRect().top))
      const scrolledBy = await page.evaluate(() => Math.round(window.scrollY))
      // the builder is always taller than the screen, so there the scroll must really have happened
      check(tag('stays at the top (top === 0) after scrolling down'), stuck === 0 && (pageName !== 'builder' || scrolledBy > 0), `top ${stuck}, scrolled ${scrolledBy}`)
      await page.evaluate(() => window.scrollTo(0, 0))

      // the hamburger menu
      if (!wide) {
        const burger = page.locator('header[data-sticky-top] button[aria-expanded]')
        const tapOrClick = (loc) => (touch ? loc.tap() : loc.click())
        await tapOrClick(burger)
        const menu = await page.evaluate(() => {
          const header = document.querySelector('header[data-sticky-top]')
          const b = header.querySelector('button[aria-expanded]')
          const id = b.getAttribute('aria-controls')
          const m = document.getElementById(id)
          const r = m?.getBoundingClientRect()
          return {
            expanded: b.getAttribute('aria-expanded'), exists: !!m,
            left: r && Math.round(r.left), right: r && Math.round(r.right), vw: document.documentElement.clientWidth,
            links: [...(m?.querySelectorAll('a') ?? [])].map((a) => [a.textContent.replace(/\(opens in a new tab\)/, '').trim(), a.getAttribute('href'), a.getAttribute('target'), a.getAttribute('rel')]),
            cur: m?.querySelector('[aria-current="page"]')?.textContent.trim() ?? null,
            heights: [...(m?.querySelectorAll('a') ?? [])].map((a) => Math.round(a.getBoundingClientRect().height)),
            sw: document.documentElement.scrollWidth,
          }
        })
        check(tag('hamburger opens the menu (aria-expanded=true)'), menu.expanded === 'true' && menu.exists)
        check(tag('menu is full width, no horizontal overflow'), menu.left === 0 && menu.right === menu.vw && menu.sw <= menu.vw, JSON.stringify(menu))
        check(tag('menu links have the right hrefs, new tab, noopener'), JSON.stringify(menu.links.map((l) => [l[0], l[1]])) === JSON.stringify(EXPECT) && menu.links.every((l) => l[2] === '_blank' && l[3].split(' ').includes('noopener')), JSON.stringify(menu.links))
        check(tag('menu links are 44px tall'), menu.heights.every((h) => h >= 44), menu.heights.join(','))
        if (w < 640) check(tag('current section heads the menu on phones'), menu.cur === 'Signal Chain Builder', `${menu.cur}`)
        if (pageName === 'builder' && (w === 390 || w === 320)) await page.screenshot({ path: OUT + `after-${w}-menu-open.png` })
        await page.keyboard.press('Escape')
        check(tag('Escape closes the menu and returns focus to the button'), (await page.locator('#' + (await burger.getAttribute('aria-controls') ?? 'x')).count()) === 0 && (await page.evaluate(() => document.activeElement === document.querySelector('header[data-sticky-top] button[aria-expanded]'))))
        await tapOrClick(burger)
        await page.touchscreen?.tap(5, 700).catch(() => {})
        if (!touch) await page.mouse.click(5, 700)
        check(tag('pressing outside closes the menu'), (await burger.getAttribute('aria-expanded')) === 'false')
        await tapOrClick(burger)
        const popup = page.waitForEvent('popup', { timeout: 5000 }).catch(() => null)
        await tapOrClick(page.locator('header[data-sticky-top] a:visible', { hasText: 'Blog' }))
        const opened = await popup
        check(tag('Blog opens a new tab (this one stays), and the menu closes'), !!opened && page.url().startsWith(APP) && (await burger.getAttribute('aria-expanded')) === 'false', opened ? opened.url() : 'no popup')
        await opened?.close()
        // widening the window turns it back into the inline links
        await tapOrClick(burger)
        await page.setViewportSize({ width: 900, height: 800 })
        await page.waitForTimeout(150)
        check(tag('widening past 768px closes the menu and shows the inline links'), (await page.locator('header[data-sticky-top] ul li a:visible').count()) === 3)
      }
      check(tag('no page errors'), errors.length === 0, errors.join('; '))
      if ((w === 1440 || w === 390) && pageName !== 'invalid-link page') await page.screenshot({ path: OUT + `after-${w}-navbar-${pageName.replace(/ /g, '-')}.png` })
      await ctx.close()
    }
  }

  // the navbar is not in the PDF; and the builder's other chrome is unaffected by it
  {
    const { ctx, page, errors } = await open(1200, { pro: true })
    await page.getByPlaceholder('Search gear…').waitFor()
    await addDevices(page, ['SM7B', 'Scarlett 2i2 (4th', 'HS5'])
    await page.evaluate(() => {
      window.__pdfSeen = []
      new MutationObserver((muts) => {
        for (const m of muts) for (const n of m.addedNodes) {
          if (n.nodeType === 1 && n.getAttribute('aria-hidden') === 'true') window.__pdfSeen.push({ hasNav: !!n.querySelector('nav, header[data-sticky-top]'), hasReport: /Compatib/i.test(n.textContent), wordmarkLinks: n.querySelectorAll('a[href^="https://soundorp.com"]').length })
        }
      }).observe(document.body, { childList: true })
    })
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.getByRole('button', { name: /Export PDF/ }).click()])
    const pdfPath = OUT + 'navbar-check.pdf'
    await download.saveAs(pdfPath)
    const seen = await page.evaluate(() => window.__pdfSeen)
    const buf = fs.readFileSync(pdfPath)
    check('PDF: exports a real PDF with the navbar present on screen', buf.subarray(0, 5).toString() === '%PDF-' && buf.length > 20000, `${buf.length} bytes`)
    check('PDF: the off-screen print layout contains the report and no navbar or soundorp.com nav links', seen.length >= 1 && seen.every((s) => s.hasReport && !s.hasNav && s.wordmarkLinks === 0), JSON.stringify(seen))
    // lift page 1's image out of the PDF, for looking at
    const i = buf.indexOf(Buffer.from([0xff, 0xd8, 0xff]))
    const end = buf.lastIndexOf(Buffer.from([0xff, 0xd9]), buf.indexOf('endstream', i))
    fs.writeFileSync(OUT + 'after-pdf-page1.jpg', buf.subarray(i, end + 2))
    check('PDF: no page errors', errors.length === 0, errors.join('; '))
    await ctx.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
