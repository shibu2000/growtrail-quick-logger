import type { EntryRun, EntryRunStatus, RunJournal, TaskEntry, UncertainResolution } from './types'

export type NextStep = 'create-and-log' | 'log-only' | 'skip'

const IN_FLIGHT: EntryRunStatus[] = ['creating-task', 'opening-time-log', 'submitting-time-log']

export function nextStep(result: EntryRun | undefined): NextStep {
  if (!result) return 'create-and-log'
  switch (result.status) {
    case 'pending':
      return 'create-and-log'
    case 'task-created':
      return 'log-only'
    case 'failed':
      return result.growtrailTaskId ? 'log-only' : 'create-and-log'
    case 'completed':
    case 'uncertain':
    case 'creating-task':
    case 'opening-time-log':
    case 'submitting-time-log':
      return 'skip'
  }
}

export function recoverJournal(journal: RunJournal, now: string): RunJournal {
  const results: Record<string, EntryRun> = {}
  for (const [id, r] of Object.entries(journal.results)) {
    if (r.status === 'opening-time-log') {
      results[id] = { ...r, status: 'task-created', message: 'Interrupted before the time log was submitted', updatedAt: now }
    } else if (IN_FLIGHT.includes(r.status)) {
      results[id] = {
        ...r,
        status: 'uncertain',
        message:
          r.status === 'creating-task'
            ? 'Interrupted while creating the task. Check Growtrail to see if it was created'
            : 'Interrupted while submitting the time log. Check Growtrail to see if it was saved',
        updatedAt: now,
      }
    } else {
      results[id] = r
    }
  }
  const state = journal.state === 'running' || journal.state === 'stopping' ? 'stopped' : journal.state
  return { ...journal, state, currentEntryId: undefined, currentOperation: undefined, results, updatedAt: now }
}

export function resolveUncertain(
  journal: RunJournal,
  entryId: string,
  resolution: UncertainResolution,
  now: string,
): RunJournal {
  const r = journal.results[entryId]
  if (!r || r.status !== 'uncertain') throw new Error('Only an uncertain entry can be resolved')
  const next: EntryRun =
    resolution === 'mark-completed'
      ? { ...r, status: 'completed', message: 'Marked as saved after checking Growtrail', updatedAt: now }
      : r.growtrailTaskId
        ? { ...r, status: 'task-created', message: 'Time log will be retried (user confirmed it was not saved)', updatedAt: now }
        : { ...r, status: 'pending', message: 'Will be retried (user confirmed nothing was created)', updatedAt: now }
  return { ...journal, results: { ...journal.results, [entryId]: next }, updatedAt: now }
}

export function isEntryLocked(result: EntryRun | undefined): boolean {
  return !!result && result.status !== 'pending' && !(result.status === 'failed' && !result.growtrailTaskId)
}

export function entryForStep(step: NextStep, draftEntry: TaskEntry, submitted: TaskEntry | undefined): TaskEntry {
  return step === 'log-only' && submitted ? submitted : draftEntry
}

export function summarize(journal: RunJournal | null, entryIds: string[]) {
  const counts = { total: entryIds.length, completed: 0, failed: 0, uncertain: 0, inProgress: 0, pending: 0 }
  for (const id of entryIds) {
    const s = journal?.results[id]?.status ?? 'pending'
    if (s === 'completed') counts.completed++
    else if (s === 'failed') counts.failed++
    else if (s === 'uncertain') counts.uncertain++
    else if (s === 'pending') counts.pending++
    else counts.inProgress++
  }
  return counts
}
