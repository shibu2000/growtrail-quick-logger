import { app } from 'electron'
import { join } from 'node:path'

const root = () => app.getPath('userData')

export const paths = {
  settings: () => join(root(), 'settings.json'),
  draft: (workDate: string) => join(root(), 'drafts', `${workDate}.json`),
  journal: (workDate: string) => join(root(), 'runs', `${workDate}.json`),
  browserProfile: () => join(root(), 'browser-profile'),
  diagnostics: () => join(root(), 'diagnostics'),
}
