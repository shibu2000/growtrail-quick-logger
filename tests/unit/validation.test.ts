import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, newEntry, updateEntry } from '@shared/defaults'
import type { Settings, TaskEntry } from '@shared/types'
import { isDraftRunnable, settingsSchema, validateDraft, validateEntry } from '@shared/validation'

const NOW = new Date(2026, 9, 26, 12, 0)
const TODAY = '2026-10-26'

const settings: Settings = {
  ...DEFAULT_SETTINGS,
  assignedTo: 'Test Person',
  followedBy: ['Lead Person'],
  knownProjects: ['Project A', 'Project B'],
  knownEmployees: ['Test Person', 'Lead Person'],
  defaultProject: 'Project A',
  defaultTaskType: 'Others',
  defaultTimeLogType: 'Inhouse',
}

const entry = (over: Partial<TaskEntry> = {}): TaskEntry => ({
  ...newEntry(settings, Math.random().toString(36)),
  title: 'Work item',
  spent: '1',
  estimate: '1',
  ...over,
})

describe('newEntry / updateEntry', () => {
  it('initialises rows from settings defaults', () => {
    const e = newEntry(settings, 'x')
    expect(e.project).toBe('Project A')
    expect(e.taskType).toBe('Others')
    expect(e.timeLogType).toBe('Inhouse')
    expect(e.priority).toBe('Normal')
    expect(e.status).toBe('')
  })

  it('keeps Estimate in sync with Spent Time', () => {
    const e = updateEntry(entry(), { spent: '2.5' })
    expect(e.estimate).toBe('2.5')
  })

  it('mirrors the description into the time log description until edited', () => {
    let e = updateEntry(entry(), { description: 'abc' })
    expect(e.timeLogDescription).toBe('abc')
    e = updateEntry(e, { timeLogDescription: 'different' })
    expect(e.timeLogDescriptionEdited).toBe(true)
    e = updateEntry(e, { description: 'abc def' })
    expect(e.timeLogDescription).toBe('different')
  })
})

describe('validateEntry', () => {
  it('accepts a complete row', () => {
    expect(validateEntry(entry(), settings)).toEqual({ errors: [], warnings: [] })
  })

  it('requires title, project, task type, time log type', () => {
    const { errors } = validateEntry(entry({ title: ' ', project: '', taskType: '', timeLogType: '' }), settings)
    expect(errors.join('|')).toMatch(/Title/)
    expect(errors.join('|')).toMatch(/Project/)
    expect(errors.join('|')).toMatch(/Task Type/)
    expect(errors.join('|')).toMatch(/Time Log Type/)
  })

  it('allows typed values outside the known lists, with a warning only', () => {
    const v = validateEntry(entry({ project: 'Made Up', taskType: 'Brand New Type', timeLogType: 'Custom' }), settings)
    expect(v.errors).toEqual([])
    expect(v.warnings.join()).toMatch(/Project "Made Up"/)
    expect(v.warnings.join()).toMatch(/Task Type "Brand New Type"/)
    expect(v.warnings.join()).toMatch(/Time Log Type "Custom"/)
  })

  it('never allows the Delete status, in any letter case', () => {
    expect(validateEntry(entry({ status: 'Delete' }), settings).errors.join()).toMatch(/Delete/)
    expect(validateEntry(entry({ status: ' delete ' }), settings).errors.join()).toMatch(/Delete/)
  })

  it('requires Billable to be Yes or No', () => {
    expect(validateEntry(entry({ taskBillable: 'Maybe' }), settings).errors.join()).toMatch(/Task Billable must be Yes or No/)
    expect(validateEntry(entry({ timeLogBillable: 'Yes' }), settings).errors).toEqual([])
  })

  it('flags Estimate != Spent Time', () => {
    expect(validateEntry(entry({ spent: '2', estimate: '1.5' }), settings).errors.join()).toMatch(/must equal/)
  })

  it('treats equal values in different notation as equal', () => {
    expect(validateEntry(entry({ spent: '1:30', estimate: '1.5' }), settings).errors).toEqual([])
  })
})

describe('validateDraft', () => {
  it('warns (but does not block) below the daily target', () => {
    const v = validateDraft([entry({ spent: '4', estimate: '4' })], settings, TODAY, NOW)
    expect(v.totalHundredths).toBe(400)
    expect(v.warnings.join()).toMatch(/below the 9h daily target/)
    expect(isDraftRunnable(v)).toBe(true)
  })

  it('does not warn at or above target and reports the real total', () => {
    const v = validateDraft(
      [entry({ title: 'First', spent: '5', estimate: '5' }), entry({ title: 'Second', spent: '5', estimate: '5' })],
      settings,
      TODAY,
      NOW,
    )
    expect(v.totalHundredths).toBe(1000)
    expect(v.warnings).toEqual([])
  })

  it('only allows today or yesterday', () => {
    expect(isDraftRunnable(validateDraft([entry()], settings, '2026-10-25', NOW))).toBe(true)
    expect(validateDraft([entry()], settings, '2026-10-24', NOW).globalErrors.join()).toMatch(/today or yesterday/)
  })

  it('warns about duplicate titles without blocking', () => {
    const v = validateDraft([entry({ title: 'Same' }), entry({ title: 'same ' })], settings, TODAY, NOW)
    expect(v.warnings.join()).toMatch(/same title/)
    expect(isDraftRunnable(v)).toBe(true)
  })

  it('requires Assigned To; unknown typed employees only warn', () => {
    const v = validateDraft([entry()], { ...settings, assignedTo: '', followedBy: ['Ghost'] }, TODAY, NOW)
    expect(v.globalErrors.join()).toMatch(/Assigned To/)
    expect(v.warnings.join()).toMatch(/Ghost/)
  })

  it('collects per-entry warnings separately from errors', () => {
    const e = entry({ project: 'Typed Project' })
    const v = validateDraft([e], settings, TODAY, NOW)
    expect(v.entryWarnings[e.id]?.join()).toMatch(/Typed Project/)
    expect(v.errors[e.id]).toBeUndefined()
  })

  it('blocks an empty draft', () => {
    expect(isDraftRunnable(validateDraft([], settings, TODAY, NOW))).toBe(false)
  })
})

describe('settingsSchema', () => {
  it('accepts defaults', () => {
    expect(settingsSchema.safeParse(DEFAULT_SETTINGS).success).toBe(true)
  })
  it('rejects Delete as default status', () => {
    expect(settingsSchema.safeParse({ ...DEFAULT_SETTINGS, defaultStatus: 'Delete' }).success).toBe(false)
    expect(settingsSchema.safeParse({ ...DEFAULT_SETTINGS, defaultStatus: 'delete' }).success).toBe(false)
  })
})
