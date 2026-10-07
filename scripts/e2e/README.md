# Browser scripts

End-to-end checks that drive a real Chrome or Edge through the app with `playwright-core`
(it downloads no browser: one must already be installed, or set `E2E_BROWSER` to its path).

## Run them

```sh
npm run build
npm run preview -- --port 5199     # leave running; serves the production build
npm run e2e                        # every script, one summary line each
node scripts/e2e/ui-layout.mjs     # or a single script
```

`APP=http://host:port` points them somewhere else. They are meant to run against the
**production build** (`preview`), not the dev server.

| Script | Covers |
|---|---|
| `m0` | Pro gating: locked buttons, upgrade modal, license activation |
| `m0b` | Free save cap: the save-limit popover and its Upgrade button |
| `m1` | Cable and adapter list |
| `m2`, `m2b` | One-click gain fixes, and the interface-output rules |
| `m3` | Custom devices: limit, share links, chain snapshots |
| `m4` | Shopping list, budget, cheaper alternatives |
| `m5` | PDF export (short and multi-page), free-tier lock |
| `m6` | Public `/c/<chain>` page, hostile and invalid links |
| `ui-layout` | No page-level horizontal scroll at 320-1440px, toolbar sizing, report popovers (mouse and touch), toolbar popovers and modals, navbar |
| `touch-drag` | Drag-to-reorder by mouse and by real touch events (swap, edge autoscroll, no browser back-swipe), and that the gaps between cards still scroll the row and a vertical swipe still scrolls the page |
| `unconfirmed` | A spec the catalog marks `in_question` reaches the person as an "unconfirmed" warning, not a clean pass or a critical (the Alto ZMX122FX), and a device not in question is unchanged |

Screenshots, PDFs and other output go to `scripts/e2e/out/` (git-ignored).

## Check the deployed site

```sh
npm run e2e:live                                   # https://app.soundorp.com
ORIGIN=https://example.vercel.app npm run e2e:live
```

`prodcheck.mjs` is read-only. It blocks the Vercel analytics requests so test visits stay out
of the site's numbers, builds a chain, exports a PDF, checks free-tier gating, and opens a
`/c/` page (using the encoded chains in `fixtures/prod-links.json`) including its
`X-Robots-Tag` header. The response header for a real `/c/` URL can also be checked with
`curl -I https://app.soundorp.com/c/<chain>`.
