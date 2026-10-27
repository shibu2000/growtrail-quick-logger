import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, newEntry } from '@shared/defaults'
import { entryForStep, isEntryLocked, nextStep, recoverJournal, resolveUncertain, summarize } from '@shared/run-plan'
import type { EntryRun, EntryRunStatus, RunJournal } from '@shared/types'

const T = '2026-10-26T12:00:00.000Z'
const r = (status: EntryRunStatus, taskId?: string): EntryRun => ({
  entryId: 'e',
  status,
  growtrailTaskId: taskId,
  updatedAt: T,
})
const journal = (results: Record<string, EntryRun>, state: RunJournal['state'] = 'running'): RunJournal => ({
  workDate: '2026-10-26',
  state,
  submitted: {},
  results,
  log: [],
  updatedAt: T,
})

describe('nextStep', () => {
  it('creates and logs new or pending entries', () => {
    expect(nextStep(undefined)).toBe('create-and-log')
    expect(nextStep(r('pending'))).toBe('create-and-log')
  })
  it('only logs time when the task already exists', () => {
    expect(nextStep(r('task-created', '1'))).toBe('log-only')
    expect(nextStep(r('failed', '1'))).toBe('log-only')
  })
  it('retries a failed creation from scratch', () => {
    expect(nextStep(r('failed'))).toBe('create-and-log')
  })
  it('never touches completed, uncertain or in-flight entries', () => {
    for (const s of ['completed', 'uncertain', 'creating-task', 'opening-time-log', 'submitting-time-log'] as const)
      expect(nextStep(r(s, '1'))).toBe('skip')
  })
})

describe('recoverJournal (after crash / restart)', () => {
  it('marks interrupted submits as uncertain and never as retryable', () => {
    const out = recoverJournal(
      journal({
        a: r('creating-task'),
        b: r('submitting-time-log', '10'),
        c: r('opening-time-log', '11'),
        d: r('completed', '12'),
      }),
      T,
    )
    expect(out.state).toBe('stopped')
    expect(out.results.a.status).toBe('uncertain')
    expect(out.results.b.status).toBe('uncertain')
    expect(out.results.b.growtrailTaskId).toBe('10')
    expect(out.results.c.status).toBe('task-created')
    expect(out.results.d.status).toBe('completed')
    for (const id of ['a', 'b']) expect(nextStep(out.results[id])).toBe('skip')
  })
})

describe('resolveUncertain', () => {
  it('mark-completed settles the entry', () => {
    const out = resolveUncertain(journal({ a: r('uncertain', '5') }, 'stopped'), 'a', 'mark-completed', T)
    expect(out.results.a.status).toBe('completed')
  })
  it('retry with a task ID only retries the time log (no duplicate task)', () => {
    const out = resolveUncertain(journal({ a: r('uncertain', '5') }, 'stopped'), 'a', 'retry', T)
    expect(out.results.a.status).toBe('task-created')
    expect(nextStep(out.results.a)).toBe('log-only')
  })
  it('retry without a task ID recreates the task', () => {
    const out = resolveUncertain(journal({ a: r('uncertain') }, 'stopped'), 'a', 'retry', T)
    expect(nextStep(out.results.a)).toBe('create-and-log')
  })
  it('refuses to resolve anything that is not uncertain', () => {
    expect(() => resolveUncertain(journal({ a: r('completed', '5') }), 'a', 'retry', T)).toThrow()
  })
})

describe('locking and resume values', () => {
  it('locks rows that exist in Growtrail', () => {
    expect(isEntryLocked(undefined)).toBe(false)
    expect(isEntryLocked(r('pending'))).toBe(false)
    expect(isEntryLocked(r('failed'))).toBe(false)
    expect(isEntryLocked(r('failed', '1'))).toBe(true)
    expect(isEntryLocked(r('task-created', '1'))).toBe(true)
    expect(isEntryLocked(r('completed', '1'))).toBe(true)
  })

  it('uses the submitted snapshot when only the time log remains', () => {
    const draft = { ...newEntry(DEFAULT_SETTINGS, 'a'), spent: '3' }
    const submitted = { ...draft, spent: '2' }
    expect(entryForStep('log-only', draft, submitted).spent).toBe('2')
    expect(entryForStep('create-and-log', draft, submitted).spent).toBe('3')
  })

  it('summarizes counts', () => {
    const j = journal({ a: r('completed', '1'), b: r('failed'), c: r('uncertain'), d: r('task-created', '2') })
    expect(summarize(j, ['a', 'b', 'c', 'd', 'e'])).toEqual({
      total: 5,
      completed: 1,
      failed: 1,
      uncertain: 1,
      inProgress: 1,
      pending: 1,
    })
  })
})
