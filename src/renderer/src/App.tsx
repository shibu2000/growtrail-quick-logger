import { useEffect, useState } from 'react'
import { formatIsoDate, todayIso, yesterdayIso } from '@shared/dates'
import type { BrowserStatus, Settings } from '@shared/types'
import { ConnectionBadge } from './components/SidePanels'
import { Banner } from './components/ui'
import { errorMessage } from './errors'
import { HomePage } from './pages/HomePage'
import { SettingsPage } from './pages/SettingsPage'

const api = window.api

type Theme = 'system' | 'light' | 'dark'
const THEMES: Theme[] = ['system', 'light', 'dark']
const THEME_LABEL: Record<Theme, string> = { system: 'Theme: System', light: 'Theme: Light', dark: 'Theme: Dark' }

function storedTheme(): Theme {
  try {
    const t = localStorage.getItem('theme')
    return t === 'light' || t === 'dark' ? t : 'system'
  } catch {
    return 'system'
  }
}

export default function App() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [browser, setBrowser] = useState<BrowserStatus>({ state: 'disconnected', message: 'Not connected' })
  const [page, setPage] = useState<'home' | 'settings'>('home')
  const [workDate, setWorkDate] = useState(todayIso())
  const [loadError, setLoadError] = useState<string | null>(null)
  const [theme, setTheme] = useState<Theme>(storedTheme)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') delete root.dataset.theme
    else root.dataset.theme = theme
    try {
      localStorage.setItem('theme', theme)
    } catch {
      return
    }
  }, [theme])

  useEffect(() => {
    api.getSettings().then(setSettings).catch((err) => setLoadError(errorMessage(err)))
    void api.getBrowserStatus().then(setBrowser)
    return api.onBrowserStatus(setBrowser)
  }, [])

  if (loadError) return <div className="p-8"><Banner tone="bad">Could not load settings: {loadError}</Banner></div>
  if (!settings) return <div className="p-8 text-muted">Loading…</div>

  const today = todayIso()
  const yesterday = yesterdayIso()
  const busyConnecting = browser.state === 'connecting'

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-5 border-b border-line bg-panel px-5 py-3">
        <div className="flex items-baseline gap-2">
          <span className="text-base font-bold text-brand">Growtrail</span>
          <span className="text-base font-semibold">Quick Logger</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Work date</span>
          <div className="inline-flex rounded-md border border-line p-0.5">
            {[
              { value: today, label: `Today · ${formatIsoDate(today)}` },
              { value: yesterday, label: `Yesterday · ${formatIsoDate(yesterday)}` },
            ].map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => setWorkDate(d.value)}
                className={`rounded px-2.5 py-1 text-xs font-medium ${workDate === d.value ? 'bg-brand text-white' : 'text-ink hover:bg-canvas'}`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <ConnectionBadge status={browser} />
          <button
            type="button"
            className="btn btn-ghost"
            title="Switch between system, light and dark theme"
            onClick={() => setTheme(THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length])}
          >
            {THEME_LABEL[theme]}
          </button>
          <button type="button" className="btn btn-ghost" disabled={busyConnecting} onClick={() => void api.connectBrowser()}>
            {browser.state === 'connected' ? 'Re-check' : 'Connect browser'}
          </button>
          <button
            type="button"
            className={`btn ${page === 'settings' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setPage(page === 'settings' ? 'home' : 'settings')}
          >
            Settings
          </button>
        </div>
      </header>

      {browser.state !== 'connected' && browser.state !== 'disconnected' && browser.state !== 'connecting' && (
        <div className="px-5 pt-3">
          <Banner tone={browser.state === 'error' ? 'bad' : 'warn'}>{browser.message}</Banner>
        </div>
      )}

      {page === 'settings' ? (
        <SettingsPage settings={settings} browser={browser} onSaved={setSettings} onClose={() => setPage('home')} />
      ) : (
        <HomePage settings={settings} workDate={workDate} browser={browser} onOpenSettings={() => setPage('settings')} />
      )}
    </div>
  )
}
