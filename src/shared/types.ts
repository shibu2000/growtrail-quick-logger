import type { Billable } from './options'

export interface TaskEntry {
  id: string
  title: string
  description: string
  timeLogDescription: string
  timeLogDescriptionEdited: boolean

  project: string
  taskType: string
  status: string
  priority: string
  taskBillable: string

  spent: string
  estimate: string

  timeLogType: string
  timeLogBillable: string
}

export interface Draft {
  workDate: string
  entries: TaskEntry[]
  updatedAt: string
}

export type ConnectionMode = 'launch' | 'attach'

export interface Settings {
  growtrailBaseUrl: string
  taskListPath: string

  connectionMode: ConnectionMode
  browserExecutable: string
  cdpPort: number

  assignedTo: string
  followedBy: string[]

  defaultProject: string
  defaultTaskType: string
  defaultStatus: string
  defaultPriority: string
  defaultTaskBillable: Billable
  defaultTimeLogType: string
  defaultTimeLogBillable: Billable

  dailyTargetHundredths: number

  knownProjects: string[]
  knownEmployees: string[]
  optionsFetchedAt: string | null
}

export type BrowserState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'login-required'
  | 'growtrail-not-found'
  | 'error'

export interface BrowserStatus {
  state: BrowserState
  message: string
  userName?: string
  executable?: string
}

export interface GrowtrailOptions {
  projects: string[]
  employees: string[]
  currentUser: string | null
}

export type EntryRunStatus =
  | 'pending'
  | 'creating-task'
  | 'task-created'
  | 'opening-time-log'
  | 'submitting-time-log'
  | 'completed'
  | 'failed'
  | 'uncertain'

export interface EntryRun {
  entryId: string
  status: EntryRunStatus
  growtrailTaskId?: string
  message?: string
  updatedAt: string
}

export type RunState = 'idle' | 'running' | 'stopping' | 'stopped' | 'finished'

export interface LogEvent {
  at: string
  level: 'info' | 'success' | 'warn' | 'error'
  message: string
}

export interface RunJournal {
  workDate: string
  state: RunState
  currentEntryId?: string
  currentOperation?: string
  submitted: Record<string, TaskEntry>
  results: Record<string, EntryRun>
  log: LogEvent[]
  updatedAt: string
}

export type UncertainResolution = 'mark-completed' | 'retry'

export interface DraftValidation {
  errors: Record<string, string[]>
  entryWarnings: Record<string, string[]>
  globalErrors: string[]
  warnings: string[]
  totalHundredths: number
}
