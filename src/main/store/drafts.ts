import type { Draft, RunJournal } from '@shared/types'
import { draftSchema } from '@shared/validation'
import { readJson, removeFile, writeJsonAtomic } from './json-store'
import { paths } from './paths'

const isoDate = /^\d{4}-\d{2}-\d{2}$/

function assertDate(workDate: string) {
  if (!isoDate.test(workDate)) throw new Error(`Invalid work date: ${workDate}`)
}

export async function loadDraft(workDate: string): Promise<Draft | null> {
  assertDate(workDate)
  const raw = await readJson<unknown>(paths.draft(workDate))
  if (raw === null) return null
  const parsed = draftSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

export async function saveDraft(input: unknown): Promise<void> {
  const draft = draftSchema.parse(input)
  await writeJsonAtomic(paths.draft(draft.workDate), draft)
}

export async function loadJournal(workDate: string): Promise<RunJournal | null> {
  assertDate(workDate)
  return readJson<RunJournal>(paths.journal(workDate))
}

export async function saveJournal(journal: RunJournal): Promise<void> {
  assertDate(journal.workDate)
  await writeJsonAtomic(paths.journal(journal.workDate), journal)
}

export async function deleteJournal(workDate: string): Promise<void> {
  assertDate(workDate)
  await removeFile(paths.journal(workDate))
}
