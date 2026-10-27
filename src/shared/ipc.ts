import type {
  BrowserStatus,
  Draft,
  GrowtrailOptions,
  RunJournal,
  Settings,
  UncertainResolution,
} from './types'

export const IPC = {
  settingsGet: 'settings:get',
  settingsSave: 'settings:save',
  settingsReset: 'settings:reset',
  draftLoad: 'draft:load',
  draftSave: 'draft:save',
  browserConnect: 'browser:connect',
  browserStatus: 'browser:status',
  browserDetect: 'browser:detect',
  growtrailFetchOptions: 'growtrail:fetch-options',
  runStart: 'run:start',
  runStop: 'run:stop',
  runGet: 'run:get',
  runResolve: 'run:resolve',
  runDiscard: 'run:discard',
  evBrowserStatus: 'event:browser-status',
  evRun: 'event:run',
} as const

export interface QuickLoggerApi {
  getSettings(): Promise<Settings>
  saveSettings(settings: Settings): Promise<Settings>
  resetSettings(): Promise<Settings>

  loadDraft(workDate: string): Promise<Draft | null>
  saveDraft(draft: Draft): Promise<void>

  connectBrowser(): Promise<BrowserStatus>
  getBrowserStatus(): Promise<BrowserStatus>
  detectBrowsers(): Promise<string[]>
  fetchGrowtrailOptions(): Promise<GrowtrailOptions>

  startRun(draft: Draft): Promise<RunJournal>
  stopRun(): Promise<void>
  getRun(workDate: string): Promise<RunJournal | null>
  resolveUncertain(workDate: string, entryId: string, resolution: UncertainResolution): Promise<RunJournal>
  discardRun(workDate: string): Promise<void>

  onBrowserStatus(listener: (status: BrowserStatus) => void): () => void
  onRun(listener: (journal: RunJournal) => void): () => void
}
