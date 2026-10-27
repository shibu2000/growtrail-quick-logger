import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type QuickLoggerApi } from '@shared/ipc'

function subscribe<T>(channel: string, listener: (payload: T) => void): () => void {
  const handler = (_e: IpcRendererEvent, payload: T) => listener(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api: QuickLoggerApi = {
  getSettings: () => ipcRenderer.invoke(IPC.settingsGet),
  saveSettings: (settings) => ipcRenderer.invoke(IPC.settingsSave, settings),
  resetSettings: () => ipcRenderer.invoke(IPC.settingsReset),

  loadDraft: (workDate) => ipcRenderer.invoke(IPC.draftLoad, workDate),
  saveDraft: (draft) => ipcRenderer.invoke(IPC.draftSave, draft),

  connectBrowser: () => ipcRenderer.invoke(IPC.browserConnect),
  getBrowserStatus: () => ipcRenderer.invoke(IPC.browserStatus),
  detectBrowsers: () => ipcRenderer.invoke(IPC.browserDetect),
  fetchGrowtrailOptions: () => ipcRenderer.invoke(IPC.growtrailFetchOptions),

  startRun: (draft) => ipcRenderer.invoke(IPC.runStart, draft),
  stopRun: () => ipcRenderer.invoke(IPC.runStop),
  getRun: (workDate) => ipcRenderer.invoke(IPC.runGet, workDate),
  resolveUncertain: (workDate, entryId, resolution) => ipcRenderer.invoke(IPC.runResolve, workDate, entryId, resolution),
  discardRun: (workDate) => ipcRenderer.invoke(IPC.runDiscard, workDate),

  onBrowserStatus: (listener) => subscribe(IPC.evBrowserStatus, listener),
  onRun: (listener) => subscribe(IPC.evRun, listener),
}

contextBridge.exposeInMainWorld('api', api)
