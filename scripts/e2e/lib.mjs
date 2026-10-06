// Shared setup for the browser scripts in this folder.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const here = path.dirname(fileURLToPath(import.meta.url))
const slashes = (p) => p.replace(/\\/g, '/')

/** Where the app under test is served. Default: `npm run preview -- --port 5199`. */
export const APP_URL = (process.env.APP || 'http://localhost:5199').replace(/\/$/, '')

/** Screenshots, PDFs and the like land here (git-ignored). Ends with a slash. */
export const OUT_DIR = slashes(path.join(here, 'out')) + '/'
fs.mkdirSync(OUT_DIR, { recursive: true })

// playwright-core drives a browser that is already installed; it downloads none. Set
// E2E_BROWSER to the executable to use a specific one.
const CANDIDATES = [
  process.env.E2E_BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/microsoft-edge',
].filter(Boolean)

export function browserPath() {
  const found = CANDIDATES.find((p) => fs.existsSync(p))
  if (!found) throw new Error('No Chrome/Edge found. Set E2E_BROWSER to the browser executable.')
  return found
}

/** A headless Chrome/Edge. */
export function launch() {
  return chromium.launch({ executablePath: browserPath() })
}
