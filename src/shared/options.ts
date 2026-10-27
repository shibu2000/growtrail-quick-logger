export const TASK_TYPES = [
  'Bug',
  'New Development',
  'Changes',
  'Design',
  'QC',
  'Client Communication',
  'Support',
  'R&D',
  'Project Management',
  'Social Media',
  'Content Writing',
  'Others',
] as const

export const TIME_LOG_TYPES = [
  'Billable',
  'Inhouse',
  'AMC',
  'Support(No AMC)',
  'RnD and Blog',
  'Training and Others',
  'Management',
] as const

export const TASK_STATUSES = ['', 'Open', 'On Hold', 'In Progress', 'Closed', 'Done', 'Re Open'] as const

export const DESTRUCTIVE_STATUS = 'Delete'

export const PRIORITIES = ['Normal', 'High', 'Low', 'Urgent'] as const

export const BILLABLE = ['No', 'Yes'] as const

export type TaskType = (typeof TASK_TYPES)[number]
export type TimeLogType = (typeof TIME_LOG_TYPES)[number]
export type TaskStatus = (typeof TASK_STATUSES)[number]
export type Priority = (typeof PRIORITIES)[number]
export type Billable = (typeof BILLABLE)[number]

export function statusLabel(status: string): string {
  return status === '' ? 'Blank → Open' : status
}
