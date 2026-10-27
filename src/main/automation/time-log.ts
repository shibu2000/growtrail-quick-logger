import type { Page } from 'playwright-core'
import { parseDuration, toGrowtrailHours } from '@shared/duration'
import type { Settings, TaskEntry } from '@shared/types'
import { failed, needsUser, uncertain } from './errors'
import { assertTaskListReady, dismissSwal, gotoTaskList, inputValue, selectedLabels, swalTitle } from './growtrail'
import { TIMELOG_SUCCESS_TEXT, endpoints, sel } from './selectors'

const UI_TIMEOUT = 10_000
const SUBMIT_TIMEOUT = 30_000
const f = sel.timeLog.field

export interface TimeLogHooks {
  checkStop(): void
  beforeSubmit(): Promise<void>
  log(message: string): void
}

export async function logTime(
  page: Page,
  taskId: string,
  entry: TaskEntry,
  workDate: string,
  settings: Settings,
  hooks: TimeLogHooks,
): Promise<{ note?: string }> {
  const parsed = parseDuration(entry.spent)
  if (!parsed.ok) throw failed(`Invalid spent time: ${parsed.error}`)
  const hours = toGrowtrailHours(parsed.hundredths)

  await gotoTaskList(page, settings)
  await dismissSwal(page)

  const plus = page.locator(sel.taskList.timelogButton(taskId))
  const count = await plus.count()
  if (count !== 1)
    throw needsUser(
      count === 0
        ? `Task #${taskId} is not on the first page of My Task, so its "+" button cannot be found`
        : `Found ${count} "+" buttons for task #${taskId}`,
    )

  const details = page.waitForResponse(
    (r) => r.request().method() === 'POST' && new URL(r.url()).pathname === endpoints.timeLogDetails,
    { timeout: UI_TIMEOUT },
  )
  await plus.click({ timeout: UI_TIMEOUT })
  await page.locator(sel.timeLog.modalShown).waitFor({ state: 'visible', timeout: UI_TIMEOUT })
  const detailsRes = await details.catch(() => null)
  if (!detailsRes?.ok()) {
    await closeModal(page)
    throw failed('Growtrail did not load the task details for the time log form')
  }

  const hiddenTaskId = page.locator(f('taskId'))
  const deadline = Date.now() + UI_TIMEOUT
  while ((await hiddenTaskId.inputValue()) !== taskId) {
    if (Date.now() > deadline) {
      await closeModal(page)
      throw failed(`Time log form is bound to task "${await hiddenTaskId.inputValue()}", expected #${taskId}`)
    }
    await page.waitForTimeout(100)
  }
  const header = ((await page.locator(sel.timeLog.header).textContent()) ?? '').replace(/\s+/g, ' ')
  if (!header.includes(`(#${taskId})`)) {
    await closeModal(page)
    throw failed(`Time log form shows "${header.trim()}", expected task #${taskId}`)
  }
  const spentSoFar = ((await page.locator(sel.timeLog.spentSoFar).textContent()) ?? '').match(/([\d.]+)\s*Hour/)
  if (spentSoFar && Number(spentSoFar[1]) > 0) {
    await closeModal(page)
    throw needsUser(
      `Task #${taskId} already has ${spentSoFar[1]} h logged. Not adding another log; check Growtrail first`,
    )
  }
  hooks.log(`Time log form opened for task #${taskId}`)

  await page.locator(f('timeLogId')).selectOption({ label: entry.timeLogType })
  await page.locator(f('startDate')).fill(workDate)
  await page.locator(f('spandTime')).fill(hours)
  await page.locator(f('remarks')).fill(entry.timeLogDescription)
  await page.locator(f('isbillable')).selectOption({ label: entry.timeLogBillable })

  const mismatches: string[] = []
  const expectEq = (field: string, actual: string, expected: string) => {
    if (actual !== expected) mismatches.push(`${field} is "${actual}", expected "${expected}"`)
  }
  expectEq('Time Log Type', (await selectedLabels(page, f('timeLogId')))[0] ?? '', entry.timeLogType)
  expectEq('Date', await inputValue(page, f('startDate')), workDate)
  expectEq('Spent Time', await inputValue(page, f('spandTime')), hours)
  expectEq('Description', await inputValue(page, f('remarks')), entry.timeLogDescription)
  expectEq('Billable', (await selectedLabels(page, f('isbillable')))[0] ?? '', entry.timeLogBillable)
  expectEq('Task', await hiddenTaskId.inputValue(), taskId)
  const valid = await page.locator(sel.timeLog.form).evaluate((form) => (form as HTMLFormElement).checkValidity())
  if (!valid) mismatches.push('Growtrail form validation failed (the date may be outside today/yesterday)')
  if (mismatches.length > 0) {
    await closeModal(page)
    throw failed(`Time log form check failed: ${mismatches.join('; ')}`)
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
      (r) => r.request().method() === 'POST' && new URL(r.url()).pathname === endpoints.addTimeLog,
      { timeout: SUBMIT_TIMEOUT },
    )
    await page.locator(sel.timeLog.submit).click({ timeout: UI_TIMEOUT })
    const res = await response
    status = res.status()
    location = res.headers()['location'] ?? null
  } catch (err) {
    throw uncertain(`No response after clicking Submit (${(err as Error).message.split('\n')[0]})`)
  }
  if (status !== 302 || !location?.includes(settings.taskListPath))
    throw uncertain(`Unexpected response to the time log Submit: HTTP ${status}${location ? ` → ${location}` : ''}`)

  try {
    await page.waitForURL((url) => url.pathname === settings.taskListPath, { timeout: SUBMIT_TIMEOUT })
    await assertTaskListReady(page)
  } catch (err) {
    throw uncertain(`Task list did not reload after the time log Submit (${(err as Error).message.split('\n')[0]})`)
  }

  let sawPopup = false
  try {
    await page.locator(sel.swal.popup).waitFor({ state: 'visible', timeout: UI_TIMEOUT })
    sawPopup = (await swalTitle(page)) === TIMELOG_SUCCESS_TEXT
    await dismissSwal(page)
  } catch {
  }

  const stored = await verifyStoredLog(page, taskId, parsed.hundredths, entry.timeLogDescription)
  if (!stored.ok) {
    throw uncertain(
      sawPopup
        ? `Growtrail said "${TIMELOG_SUCCESS_TEXT}" but the log could not be confirmed: ${stored.reason}`
        : `No success message and the log could not be confirmed: ${stored.reason}`,
    )
  }
  return sawPopup ? {} : { note: 'Saved (confirmed from task details; no success popup was shown)' }
}

async function verifyStoredLog(
  page: Page,
  taskId: string,
  hundredths: number,
  remarks: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const data = await page
    .evaluate(
      async ({ url, taskId }) => {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ task_id: taskId }).toString(),
          credentials: 'same-origin',
        })
        if (!res.ok) return { error: `HTTP ${res.status}` }
        const d = (await res.json()) as {
          totalSpendTime: unknown
          limeLogHistory?: { remarks: string | null; spandTime: string }[]
        }
        return {
          total: Number(d.totalSpendTime),
          logs: (d.limeLogHistory ?? []).map((l) => ({
            remarks: l.remarks ?? '',
            spandTime: l.spandTime,
          })),
        }
      },
      { url: endpoints.taskDetails, taskId },
    )
    .catch((err: Error) => ({ error: err.message }))

  if ('error' in data) return { ok: false, reason: `task details unavailable (${data.error})` }
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
  const match = data.logs.filter(
    (l) => Math.round(Number(l.spandTime) * 100) === hundredths && norm(l.remarks) === norm(remarks),
  )
  if (match.length === 0) return { ok: false, reason: 'no matching log entry on the task' }
  if (match.length > 1) return { ok: false, reason: `${match.length} identical log entries found (possible duplicate)` }
  if (Math.round(data.total * 100) !== hundredths)
    return { ok: false, reason: `task total is ${data.total} h, expected ${hundredths / 100} h` }
  return { ok: true }
}

async function closeModal(page: Page) {
  await page.locator(sel.timeLog.close).click({ timeout: UI_TIMEOUT }).catch(() => undefined)
  await page.locator(sel.timeLog.modalShown).waitFor({ state: 'hidden', timeout: UI_TIMEOUT }).catch(() => undefined)
}
