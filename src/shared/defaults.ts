import type { Settings, TaskEntry } from './types'

export const DEFAULT_SETTINGS: Settings = {
  growtrailBaseUrl: 'https://app.growtrail.com',
  taskListPath: '/task/list',

  connectionMode: 'launch',
  browserExecutable: '',
  cdpPort: 9333,

  assignedTo: '',
  followedBy: [],

  defaultProject: '',
  defaultTaskType: '',
  defaultStatus: '',
  defaultPriority: 'Normal',
  defaultTaskBillable: 'No',
  defaultTimeLogType: '',
  defaultTimeLogBillable: 'No',

  dailyTargetHundredths: 900,

  knownProjects: [],
  knownEmployees: [],
  optionsFetchedAt: null,
}

export function newEntry(settings: Settings, id: string): TaskEntry {
  return {
    id,
    title: '',
    description: '',
    timeLogDescription: '',
    timeLogDescriptionEdited: false,
    project: settings.defaultProject,
    taskType: settings.defaultTaskType,
    status: settings.defaultStatus,
    priority: settings.defaultPriority,
    taskBillable: settings.defaultTaskBillable,
    spent: '',
    estimate: '',
    timeLogType: settings.defaultTimeLogType,
    timeLogBillable: settings.defaultTimeLogBillable,
  }
}

export function updateEntry(entry: TaskEntry, patch: Partial<TaskEntry>): TaskEntry {
  const next = { ...entry, ...patch }
  if (patch.spent !== undefined && patch.estimate === undefined) next.estimate = patch.spent
  if (patch.description !== undefined && !entry.timeLogDescriptionEdited && patch.timeLogDescription === undefined)
    next.timeLogDescription = patch.description
  if (patch.timeLogDescription !== undefined && patch.timeLogDescriptionEdited === undefined)
    next.timeLogDescriptionEdited = patch.timeLogDescription !== next.description
  return next
}

export function trimChoices(entry: TaskEntry): TaskEntry {
  return {
    ...entry,
    title: entry.title.trim(),
    project: entry.project.trim(),
    taskType: entry.taskType.trim(),
    status: entry.status.trim(),
    priority: entry.priority.trim(),
    taskBillable: entry.taskBillable.trim(),
    timeLogType: entry.timeLogType.trim(),
    timeLogBillable: entry.timeLogBillable.trim(),
  }
}
