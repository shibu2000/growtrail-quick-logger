import type { QuickLoggerApi } from '../shared/ipc'

declare global {
  interface Window {
    api: QuickLoggerApi
  }
}

export {}
