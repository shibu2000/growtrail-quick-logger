import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { chromium, type Browser, type Page } from 'playwright-core'
import type { BrowserStatus, Settings } from '@shared/types'
import { SIGNIN_PATH, sel } from './selectors'

const CANDIDATES: Record<string, string[]> = {
  linux: [
    '/opt/chromium.org/thorium/thorium',
    '/usr/bin/thorium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    '/usr/bin/microsoft-edge',
  ],
  win32: [
    `${process.env['PROGRAMFILES']}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env['PROGRAMFILES(X86)']}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env['LOCALAPPDATA']}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env['LOCALAPPDATA']}\\Thorium\\Application\\thorium.exe`,
    `${process.env['PROGRAMFILES']}\\Thorium\\Application\\thorium.exe`,
    `${process.env['PROGRAMFILES(X86)']}\\Microsoft\\Edge\\Application\\msedge.exe`,
    `${process.env['PROGRAMFILES']}\\Microsoft\\Edge\\Application\\msedge.exe`,
  ],
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ],
}

export function detectBrowsers(): string[] {
  return (CANDIDATES[process.platform] ?? []).filter((p) => existsSync(p))
}

type Listener = (status: BrowserStatus) => void

export class BrowserSession {
  private browser: Browser | null = null
  private status: BrowserStatus = { state: 'disconnected', message: 'Not connected' }
  private listeners = new Set<Listener>()

  constructor(private readonly profileDir: () => string) {}

  onStatus(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getStatus(): BrowserStatus {
    return this.status
  }

  private setStatus(status: BrowserStatus) {
    this.status = status
    for (const l of this.listeners) l(status)
  }

  isConnected(): boolean {
    return !!this.browser?.isConnected()
  }

  async connect(settings: Settings): Promise<BrowserStatus> {
    this.setStatus({ state: 'connecting', message: 'Connecting to the browser…' })
    try {
      const endpoint = `http://127.0.0.1:${settings.cdpPort}`
      let executable: string | undefined

      if (!(await isCdpUp(endpoint))) {
        if (settings.connectionMode === 'attach') {
          this.setStatus({
            state: 'error',
            message: `No browser is listening on port ${settings.cdpPort}. Start it with --remote-debugging-port=${settings.cdpPort} and a separate --user-data-dir, or switch Settings → Connection to "Launch".`,
          })
          return this.status
        }
        executable = settings.browserExecutable || detectBrowsers()[0]
        if (!executable || !existsSync(executable)) {
          this.setStatus({
            state: 'error',
            message: 'No Chrome, Chromium or Thorium found. Set the browser path in Settings.',
          })
          return this.status
        }
        await launchBrowser(executable, settings.cdpPort, this.profileDir(), growtrailUrl(settings))
        if (!(await waitForCdp(endpoint, 20_000))) {
          this.setStatus({
            state: 'error',
            message: `Started ${executable} but its debugging port ${settings.cdpPort} never opened. Another program may be using the port, or that profile may already be open without debugging.`,
          })
          return this.status
        }
      }

      if (!this.browser?.isConnected()) {
        this.browser = await chromium.connectOverCDP(endpoint, { timeout: 15_000 })
        this.browser.on('disconnected', () => {
          this.browser = null
          this.setStatus({ state: 'disconnected', message: 'The browser was closed or disconnected' })
        })
      }

      return await this.refreshLoginState(settings, executable)
    } catch (err) {
      this.setStatus({ state: 'error', message: `Connection failed: ${(err as Error).message.split('\n')[0]}` })
      return this.status
    }
  }

  async refreshLoginState(settings: Settings, executable = this.status.executable): Promise<BrowserStatus> {
    if (!this.browser?.isConnected()) {
      this.setStatus({ state: 'disconnected', message: 'Not connected' })
      return this.status
    }
    const page = await this.growtrailPage(settings, true)
    if (!page) {
      this.setStatus({ state: 'growtrail-not-found', message: 'Could not open Growtrail in the browser', executable })
      return this.status
    }
    if (new URL(page.url()).pathname.startsWith(SIGNIN_PATH)) {
      this.setStatus({
        state: 'login-required',
        message: 'Sign in to Growtrail in the browser window, then press Connect again.',
        executable,
      })
      return this.status
    }
    const loggedIn = await page.locator(sel.loggedInMarker).first().isVisible().catch(() => false)
    if (!loggedIn) {
      this.setStatus({
        state: 'growtrail-not-found',
        message: `Growtrail did not finish loading (${page.url()}). Check the page in the browser.`,
        executable,
      })
      return this.status
    }
    const userName = (await page.locator(sel.currentUserName).first().textContent().catch(() => null))?.trim()
    this.setStatus({ state: 'connected', message: 'Connected to Growtrail', userName: userName || undefined, executable })
    return this.status
  }

  async growtrailPage(settings: Settings, openIfMissing = false): Promise<Page | null> {
    if (!this.browser?.isConnected()) return null
    const origin = new URL(settings.growtrailBaseUrl).origin
    const context = this.browser.contexts()[0]
    if (!context) return null
    const pages = context.pages().filter((p) => p.url().startsWith(origin))
    const page = pages.find((p) => p.url().includes(settings.taskListPath)) ?? pages[0]
    if (page) return page
    if (!openIfMissing) return null
    const created = await context.newPage()
    await created.goto(growtrailUrl(settings), { waitUntil: 'domcontentloaded', timeout: 30_000 })
    return created
  }

  async requirePage(settings: Settings): Promise<Page> {
    const status = await this.refreshLoginState(settings)
    if (status.state !== 'connected') throw new Error(status.message)
    const page = await this.growtrailPage(settings)
    if (!page) throw new Error('Growtrail tab not found')
    return page
  }
}

export function growtrailUrl(settings: Settings): string {
  return new URL(settings.taskListPath, settings.growtrailBaseUrl).toString()
}

async function isCdpUp(endpoint: string): Promise<boolean> {
  try {
    const res = await fetch(`${endpoint}/json/version`, { signal: AbortSignal.timeout(1500) })
    return res.ok
  } catch {
    return false
  }
}

async function waitForCdp(endpoint: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await isCdpUp(endpoint)) return true
    await new Promise((r) => setTimeout(r, 400))
  }
  return false
}

async function launchBrowser(executable: string, port: number, profileDir: string, url: string) {
  await mkdir(profileDir, { recursive: true })
  const child = spawn(
    executable,
    [
      `--remote-debugging-port=${port}`,
      '--remote-debugging-address=127.0.0.1',
      `--user-data-dir=${profileDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      url,
    ],
    { detached: true, stdio: 'ignore' },
  )
  child.unref()
}
