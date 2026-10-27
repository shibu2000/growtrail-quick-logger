import { z } from 'zod'
import { isAllowedWorkDate } from './dates'
import { formatDuration, parseDuration } from './duration'
import {
  BILLABLE,
  DESTRUCTIVE_STATUS,
  PRIORITIES,
  TASK_STATUSES,
  TASK_TYPES,
  TIME_LOG_TYPES,
} from './options'
import type { DraftValidation, Settings, TaskEntry } from './types'

const billable = z.enum(BILLABLE)

export const taskEntrySchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  description: z.string(),
  timeLogDescription: z.string(),
  timeLogDescriptionEdited: z.boolean(),
  project: z.string(),
  taskType: z.string(),
  status: z.string(),
  priority: z.string(),
  taskBillable: z.string(),
  spent: z.string(),
  estimate: z.string(),
  timeLogType: z.string(),
  timeLogBillable: z.string(),
})

export const draftSchema = z.object({
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  entries: z.array(taskEntrySchema),
  updatedAt: z.string(),
})

export const settingsSchema = z.object({
  growtrailBaseUrl: z.url({ protocol: /^https?$/ }),
  taskListPath: z.string().startsWith('/'),
  connectionMode: z.enum(['launch', 'attach']),
  browserExecutable: z.string(),
  cdpPort: z.number().int().min(1024).max(65535),
  assignedTo: z.string().trim(),
  followedBy: z.array(z.string().trim().min(1)),
  defaultProject: z.string(),
  defaultTaskType: z.string(),
  defaultStatus: z
    .string()
    .refine((s) => s.trim().toLowerCase() !== DESTRUCTIVE_STATUS.toLowerCase(), 'Delete cannot be a default status'),
  defaultPriority: z.string(),
  defaultTaskBillable: billable,
  defaultTimeLogType: z.string(),
  defaultTimeLogBillable: billable,
  dailyTargetHundredths: z.number().int().min(25).max(2400),
  knownProjects: z.array(z.string()),
  knownEmployees: z.array(z.string()),
  optionsFetchedAt: z.string().nullable(),
})

function checkListValue(
  field: string,
  value: string,
  known: readonly string[],
  required: boolean,
  out: { errors: string[]; warnings: string[] },
) {
  const v = value.trim()
  if (v === '') {
    if (required) out.errors.push(`${field} is required`)
    return
  }
  if (known.length > 0 && !known.includes(v)) out.warnings.push(`${field} "${v}" is not in the known Growtrail list`)
}

export function validateEntry(entry: TaskEntry, settings: Settings): { errors: string[]; warnings: string[] } {
  const out = { errors: [] as string[], warnings: [] as string[] }
  const { errors } = out
  if (entry.title.trim() === '') errors.push('Title is required')
  checkListValue('Project', entry.project, settings.knownProjects, true, out)
  checkListValue('Task Type', entry.taskType, TASK_TYPES, true, out)
  if (entry.status.trim().toLowerCase() === DESTRUCTIVE_STATUS.toLowerCase()) errors.push('Status "Delete" is not allowed')
  else checkListValue('Status', entry.status, TASK_STATUSES, false, out)
  checkListValue('Priority', entry.priority, PRIORITIES, true, out)
  checkListValue('Time Log Type', entry.timeLogType, TIME_LOG_TYPES, true, out)
  for (const [field, value] of [
    ['Task Billable', entry.taskBillable],
    ['Time Log Billable', entry.timeLogBillable],
  ] as const)
    if (!(BILLABLE as readonly string[]).includes(value)) errors.push(`${field} must be Yes or No`)

  const spent = parseDuration(entry.spent)
  if (!spent.ok) errors.push(`Spent Time: ${spent.error}`)
  const estimate = parseDuration(entry.estimate)
  if (!estimate.ok) errors.push(`Estimate: ${estimate.error}`)
  if (spent.ok && estimate.ok && spent.hundredths !== estimate.hundredths)
    errors.push(
      `Estimate (${formatDuration(estimate.hundredths)}) must equal Spent Time (${formatDuration(spent.hundredths)})`,
    )
  return out
}

export function validateDraft(
  entries: TaskEntry[],
  settings: Settings,
  workDate: string,
  now = new Date(),
): DraftValidation {
  const errors: Record<string, string[]> = {}
  const entryWarnings: Record<string, string[]> = {}
  const globalErrors: string[] = []
  const warnings: string[] = []

  if (entries.length === 0) globalErrors.push('Add at least one task')
  if (!isAllowedWorkDate(workDate, now))
    globalErrors.push('Growtrail only accepts time logs for today or yesterday. Pick one of those dates')
  if (settings.assignedTo.trim() === '') globalErrors.push('Set "Assigned To" in Settings')
  if (settings.knownEmployees.length > 0) {
    if (settings.assignedTo && !settings.knownEmployees.includes(settings.assignedTo))
      warnings.push(`Assigned To "${settings.assignedTo}" is not in the known Growtrail employee list`)
    for (const name of settings.followedBy)
      if (!settings.knownEmployees.includes(name))
        warnings.push(`Followed By "${name}" is not in the known Growtrail employee list`)
  }

  let total = 0
  for (const entry of entries) {
    const result = validateEntry(entry, settings)
    if (result.errors.length > 0) errors[entry.id] = result.errors
    if (result.warnings.length > 0) entryWarnings[entry.id] = result.warnings
    const spent = parseDuration(entry.spent)
    if (spent.ok) total += spent.hundredths
  }

  const titles = entries.map((e) => e.title.trim().toLowerCase()).filter(Boolean)
  const dupes = titles.filter((t, i) => titles.indexOf(t) !== i)
  if (dupes.length > 0)
    warnings.push('Two or more tasks have the same title. Growtrail allows it, but they will be hard to tell apart')

  if (entries.length > 0 && total < settings.dailyTargetHundredths)
    warnings.push(
      `Total is ${formatDuration(total)}, below the ${formatDuration(settings.dailyTargetHundredths)} daily target. You can still run it`,
    )

  return { errors, entryWarnings, globalErrors, warnings, totalHundredths: total }
}

export function isDraftRunnable(v: DraftValidation): boolean {
  return v.globalErrors.length === 0 && Object.keys(v.errors).length === 0
}
