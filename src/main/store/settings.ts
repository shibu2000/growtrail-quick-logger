import { DEFAULT_SETTINGS } from '@shared/defaults'
import type { Settings } from '@shared/types'
import { settingsSchema } from '@shared/validation'
import { readJson, writeJsonAtomic } from './json-store'
import { paths } from './paths'

let cache: Settings | null = null

export async function getSettings(): Promise<Settings> {
  if (cache) return cache
  const stored = await readJson<Partial<Settings>>(paths.settings())
  const merged = { ...DEFAULT_SETTINGS, ...(stored ?? {}) }
  const parsed = settingsSchema.safeParse(merged)
  cache = parsed.success ? parsed.data : DEFAULT_SETTINGS
  return cache
}

export async function saveSettings(input: unknown): Promise<Settings> {
  const settings = settingsSchema.parse(input)
  await writeJsonAtomic(paths.settings(), settings)
  cache = settings
  return settings
}

export async function resetSettings(): Promise<Settings> {
  const current = await getSettings()
  return saveSettings({
    ...DEFAULT_SETTINGS,
    knownProjects: current.knownProjects,
    knownEmployees: current.knownEmployees,
    optionsFetchedAt: current.optionsFetchedAt,
  })
}
