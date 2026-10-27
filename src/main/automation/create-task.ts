import type { Page } from 'playwright-core'
import { todayIso } from '@shared/dates'
import { parseDuration, toGrowtrailHours } from '@shared/duration'
import { DESTRUCTIVE_STATUS } from '@shared/options'
import type { Settings, TaskEntry } from '@shared/types'
import { failed, uncertain } from './errors'
import {
  assertTaskListReady,
  dismissSwal,
  gotoTaskList,
  inputValue,
  listedTasks,
  select2Pick,
  selectedLabels,
} from './growtrail'
import { endpoints, sel } from './selectors'

const UI_TIMEOUT = 10_000
const SUBMIT_TIMEOUT = 30_000
const f = sel.createTask.field

export interface CreateTaskHooks {
  checkStop(): void
  beforeSubmit(): Promise<void>
  log(message: string): void
}

export async function createTask(
  page: Page,
  entry: TaskEntry,
  settings: Settings,
  hooks: CreateTaskHooks,
): Promise<string> {
  if (entry.status.trim().toLowerCase() === DESTRUCTIVE_STATUS.toLowerCase()) throw failed('Status "Delete" is never submitted')
  const spent = parseDuration(entry.estimate)
  if (!spent.ok) throw failed(`Invalid estimate: ${spent.error}`)
  const estimate = toGrowtrailHours(spent.hundredths)
  const today = todayIso()

  await gotoTaskList(page, settings)
  await dismissSwal(page)
  const before = await listedTasks(page)
  const maxIdBefore = before.reduce((m, t) => Math.max(m, t.id), 0)

  await page.locator(sel.taskList.createTaskButton).click({ timeout: UI_TIMEOUT })
  await page.locator(sel.createTask.modalShown).waitFor({ state: 'visible', timeout: UI_TIMEOUT })
  hooks.log('Create Task form opened')

  await page.locator(f('subject')).fill(entry.title.trim())
  await page.locator(f('description')).fill(entry.description)
  await page.locator(f('type')).selectOption({ label: entry.taskType })
  await page.locator(f('taskStatus')).selectOption(entry.status === '' ? { value: '' } : { label: entry.status })
  await page.locator(f('priority')).selectOption({ label: entry.priority })
  await page.locator(f('estimatedTime')).fill(estimate)
  await page.locator(f('isbillable')).selectOption({ label: entry.taskBillable })
  await page.locator(f('startDate')).fill(today)

  await select2Pick(page, sel.createTask.select2Toggle('projectId'), sel.select2.openSearch, entry.project, 'Project')
  await select2Pick(page, sel.createTask.select2Toggle('assignId'), sel.select2.openSearch, settings.assignedTo, 'Assigned To')
  for (const name of settings.followedBy)
    await select2Pick(page, sel.createTask.followedBySearch, sel.createTask.followedBySearch, name, 'Followed By')

  const mismatches: string[] = []
  const expectEq = (field: string, actual: string, expected: string) => {
    if (actual !== expected) mismatches.push(`${field} is "${actual}", expected "${expected}"`)
  }
  expectEq('Title', await inputValue(page, f('subject')), entry.title.trim())
  expectEq('Description', await inputValue(page, f('description')), entry.description)
  expectEq('Project', (await selectedLabels(page, f('projectId')))[0] ?? '', entry.project)
  expectEq('Task Type', (await selectedLabels(page, f('type')))[0] ?? '', entry.taskType)
  expectEq('Status', await inputValue(page, f('taskStatus')), entry.status)
  expectEq('Priority', (await selectedLabels(page, f('priority')))[0] ?? '', entry.priority)
  expectEq('Assigned To', (await selectedLabels(page, f('assignId')))[0] ?? '', settings.assignedTo)
  expectEq(
    'Followed By',
    [...(await selectedLabels(page, f('followedBy')))].sort().join(', '),
    [...settings.followedBy].sort().join(', '),
  )
  expectEq('Create Date', await inputValue(page, f('startDate')), today)
  expectEq('Estimate', await inputValue(page, f('estimatedTime')), estimate)
  expectEq('Billable', (await selectedLabels(page, f('isbillable')))[0] ?? '', entry.taskBillable)
  expectEq('task_id (must be empty for a new task)', await inputValue(page, f('task_id')), '')
  const valid = await page.locator(sel.createTask.form).evaluate((form) => (form as HTMLFormElement).checkValidity())
  if (!valid) mismatches.push('Growtrail form validation failed')
  if (mismatches.length > 0) {
    await closeModal(page)
    throw failed(`Create Task form check failed: ${mismatches.join('; ')}`)
  }

  try {
    hooks.checkStop()
  } catch (err) {
    await closeModal(page)
    throw err
  }
  await hooks.beforeSubmit()

  let status: number
  let location: string | null
  try {
    const response = page.waitForResponse(
      (r) => r.request().method() === 'POST' && new URL(r.url()).pathname === endpoints.createTask,
      { timeout: SUBMIT_TIMEOUT },
    )
    await page.locator(sel.createTask.submit).click({ timeout: UI_TIMEOUT })
    const res = await response
    status = res.status()
    location = res.headers()['location'] ?? null
  } catch (err) {
    throw uncertain(`No response after clicking Add Task (${(err as Error).message.split('\n')[0]})`)
  }
  if (status !== 302 || !location?.includes(settings.taskListPath))
    throw uncertain(`Unexpected response to Add Task: HTTP ${status}${location ? ` → ${location}` : ''}`)

  try {
    await page.waitForURL((url) => url.pathname === settings.taskListPath, { timeout: SUBMIT_TIMEOUT })
    await assertTaskListReady(page)
  } catch (err) {
    throw uncertain(`Task list did not reload after Add Task (${(err as Error).message.split('\n')[0]})`)
  }
  await dismissSwal(page).catch(() => undefined)

  const after = await listedTasks(page)
  const created = after.filter((t) => t.id > maxIdBefore && t.subject === entry.title.trim())
  if (created.length !== 1)
    throw uncertain(
      created.length === 0
        ? 'Add Task returned success but the new task is not in the list'
        : `Found ${created.length} new tasks titled "${entry.title.trim()}". Check Growtrail for duplicates`,
    )
  return String(created[0].id)
}

async function closeModal(page: Page) {
  await page.locator(sel.createTask.close).click({ timeout: UI_TIMEOUT }).catch(() => undefined)
  await page.locator(sel.createTask.modalShown).waitFor({ state: 'hidden', timeout: UI_TIMEOUT }).catch(() => undefined)
}
