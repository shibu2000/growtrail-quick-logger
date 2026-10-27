import type { Page } from 'playwright-core'
import type { GrowtrailOptions, Settings } from '@shared/types'
import { growtrailUrl } from './browser'
import { failed, needsUser } from './errors'
import { DEVTOOLS_WARNING_TEXT, SIGNIN_PATH, sel } from './selectors'

const NAV_TIMEOUT = 30_000
const UI_TIMEOUT = 10_000

export async function gotoTaskList(page: Page, settings: Settings): Promise<void> {
  await page.goto(growtrailUrl(settings), { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT })
  await assertTaskListReady(page)
}

export async function assertTaskListReady(page: Page): Promise<void> {
  if (new URL(page.url()).pathname.startsWith(SIGNIN_PATH))
    throw failed('Growtrail asked for sign-in. Sign in in the browser window and run again')
  await page.locator(sel.taskList.heading).first().waitFor({ state: 'visible', timeout: NAV_TIMEOUT })
  await page.locator(sel.taskList.createTaskButton).waitFor({ state: 'visible', timeout: UI_TIMEOUT })
  await assertNoBlockingPopup(page)
}

export async function assertNoBlockingPopup(page: Page): Promise<void> {
  const title = await swalTitle(page)
  if (title?.includes(DEVTOOLS_WARNING_TEXT))
    throw needsUser(
      'Growtrail is showing "Developer tools are open". Close DevTools or any wide side panel in the automation browser window',
    )
}

export async function swalTitle(page: Page): Promise<string | null> {
  const popup = page.locator(sel.swal.popup)
  if (!(await popup.isVisible().catch(() => false))) return null
  return ((await page.locator(sel.swal.title).textContent()) ?? '').trim()
}

export async function dismissSwal(page: Page): Promise<string | null> {
  const title = await swalTitle(page)
  if (title === null) return null
  if (title.includes(DEVTOOLS_WARNING_TEXT)) await assertNoBlockingPopup(page)
  await page.locator(sel.swal.confirm).click({ timeout: UI_TIMEOUT })
  await page.locator(sel.swal.popup).waitFor({ state: 'hidden', timeout: UI_TIMEOUT })
  return title
}

export async function listedTasks(page: Page): Promise<{ id: number; subject: string }[]> {
  return page.locator(sel.taskList.timelogItems).evaluateAll((items) =>
    items.map((li) => ({
      id: Number((li as HTMLElement).dataset.id),
      subject: (li as HTMLElement).dataset.subject ?? '',
    })),
  )
}

export async function select2Pick(
  page: Page,
  opener: string,
  search: string,
  label: string,
  fieldName: string,
): Promise<void> {
  await page.locator(opener).click({ timeout: UI_TIMEOUT })
  const box = page.locator(search)
  await box.waitFor({ state: 'visible', timeout: UI_TIMEOUT })
  await box.fill('')
  await box.pressSequentially(label, { delay: 15 })
  const options = page.locator(sel.select2.openOptions)
  await options.first().waitFor({ state: 'visible', timeout: UI_TIMEOUT })
  const texts = (await options.allTextContents()).map((t) => t.trim())
  const matches = texts.filter((t) => t === label)
  if (matches.length !== 1) {
    await page.locator(opener).click({ timeout: UI_TIMEOUT }).catch(() => undefined)
    throw needsUser(
      matches.length === 0
        ? `${fieldName}: no exact match for "${label}" in Growtrail (shown: ${texts.slice(0, 5).join(', ') || 'none'})`
        : `${fieldName}: "${label}" matches ${matches.length} entries in Growtrail. Cannot tell them apart`,
    )
  }
  const index = texts.indexOf(label)
  await options.nth(index).click({ timeout: UI_TIMEOUT })
}

export async function selectedLabels(page: Page, selector: string): Promise<string[]> {
  return page
    .locator(selector)
    .evaluate((el) => [...(el as HTMLSelectElement).selectedOptions].map((o) => o.text.trim()))
}

export async function inputValue(page: Page, selector: string): Promise<string> {
  return page.locator(selector).inputValue()
}

export async function readGrowtrailOptions(page: Page, settings: Settings): Promise<GrowtrailOptions> {
  if (!page.url().includes(settings.taskListPath)) await gotoTaskList(page, settings)
  else await assertTaskListReady(page)
  const read = (name: string) =>
    page
      .locator(`${sel.createTask.form} select[name="${name}"] option`)
      .evaluateAll((opts) =>
        opts.filter((o) => (o as HTMLOptionElement).value !== '').map((o) => (o.textContent ?? '').trim()),
      )
  const projects = await read('projectId')
  const employees = await read('assignId')
  const currentUser = (await page.locator(sel.currentUserName).first().textContent().catch(() => null))?.trim() ?? null
  if (projects.length === 0 || employees.length === 0)
    throw failed('Could not read the project/employee lists from Growtrail')
  return { projects, employees, currentUser }
}
