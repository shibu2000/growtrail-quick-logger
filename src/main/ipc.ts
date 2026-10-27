import { ipcMain, type BrowserWindow } from 'electron'
import { z } from 'zod'
import { IPC } from '@shared/ipc'
import type { Settings } from '@shared/types'
import { draftSchema } from '@shared/validation'
import { BrowserSession, detectBrowsers } from './automation/browser'
import { readGrowtrailOptions } from './automation/growtrail'
import { Runner } from './automation/runner'
import { loadDraft, saveDraft } from './store/drafts'
import { paths } from './store/paths'
import { getSettings, resetSettings, saveSettings } from './store/settings'

const workDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const resolutionSchema = z.enum(['mark-completed', 'retry'])

export function registerIpc(getWindow: () => BrowserWindow | null) {
  const send = (channel: string, payload: unknown) => {
    const win = getWindow()
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload)
  }

  const browser = new BrowserSession(paths.browserProfile)
  browser.onStatus((status) => send(IPC.evBrowserStatus, status))
  const runner = new Runner(browser, (journal) => send(IPC.evRun, journal))

  ipcMain.handle(IPC.settingsGet, () => getSettings())
  ipcMain.handle(IPC.settingsSave, (_e, input: unknown) => {
    if (runner.isRunning()) throw new Error('Settings cannot change while a run is in progress')
    return saveSettings(input)
  })
  ipcMain.handle(IPC.settingsReset, () => {
    if (runner.isRunning()) throw new Error('Settings cannot change while a run is in progress')
    return resetSettings()
  })

  ipcMain.handle(IPC.draftLoad, (_e, workDate: unknown) => loadDraft(workDateSchema.parse(workDate)))
  ipcMain.handle(IPC.draftSave, (_e, draft: unknown) => saveDraft(draft))

  ipcMain.handle(IPC.browserConnect, async () => browser.connect(await getSettings()))
  ipcMain.handle(IPC.browserStatus, () => browser.getStatus())
  ipcMain.handle(IPC.browserDetect, () => detectBrowsers())

  ipcMain.handle(IPC.growtrailFetchOptions, async () => {
    if (runner.isRunning()) throw new Error('Wait for the current run to finish')
    const settings = await getSettings()
    const page = await browser.requirePage(settings)
    const options = await readGrowtrailOptions(page, settings)
    const next: Settings = {
      ...settings,
      knownProjects: options.projects,
      knownEmployees: options.employees,
      optionsFetchedAt: new Date().toISOString(),
      assignedTo: settings.assignedTo || (options.currentUser && options.employees.includes(options.currentUser) ? options.currentUser : ''),
    }
    await saveSettings(next)
    return options
  })

  ipcMain.handle(IPC.runStart, async (_e, input: unknown) => runner.start(draftSchema.parse(input), await getSettings()))
  ipcMain.handle(IPC.runStop, () => runner.requestStop())
  ipcMain.handle(IPC.runGet, (_e, workDate: unknown) => runner.get(workDateSchema.parse(workDate)))
  ipcMain.handle(IPC.runResolve, (_e, workDate: unknown, entryId: unknown, resolution: unknown) =>
    runner.resolve(workDateSchema.parse(workDate), z.string().min(1).parse(entryId), resolutionSchema.parse(resolution)),
  )
  ipcMain.handle(IPC.runDiscard, (_e, workDate: unknown) => runner.discard(workDateSchema.parse(workDate)))

  return { isRunning: () => runner.isRunning() }
}
