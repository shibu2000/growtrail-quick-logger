import type { Page } from 'playwright-core'
import { trimChoices } from '@shared/defaults'
import { entryForStep, nextStep, recoverJournal, resolveUncertain } from '@shared/run-plan'
import type {
  Draft,
  EntryRun,
  EntryRunStatus,
  LogEvent,
  RunJournal,
  Settings,
  UncertainResolution,
} from '@shared/types'
import { isDraftRunnable, validateDraft } from '@shared/validation'
import { deleteJournal, loadJournal, saveJournal } from '../store/drafts'
import type { BrowserSession } from './browser'
import { createTask } from './create-task'
import { asAutomationError, stopped } from './errors'
import { logTime } from './time-log'

const MAX_LOG = 500
const IN_FLIGHT: EntryRunStatus[] = ['creating-task', 'submitting-time-log']

export class Runner {
  private journal: RunJournal | null = null
  private stopRequested = false
  private active: Promise<void> | null = null

  constructor(
    private readonly browser: BrowserSession,
    private readonly emit: (journal: RunJournal) => void,
  ) {}

  isRunning(): boolean {
    return this.active !== null
  }

  async get(workDate: string): Promise<RunJournal | null> {
    if (this.journal?.workDate === workDate) return this.journal
    const stored = await loadJournal(workDate)
    if (!stored) return null
    const recovered = recoverJournal(stored, new Date().toISOString())
    if (JSON.stringify(recovered.results) !== JSON.stringify(stored.results) || recovered.state !== stored.state)
      await saveJournal(recovered)
    return recovered
  }

  async start(draft: Draft, settings: Settings): Promise<RunJournal> {
    if (this.active) throw new Error('A run is already in progress')
    const validation = validateDraft(draft.entries, settings, draft.workDate)
    if (!isDraftRunnable(validation))
      throw new Error(['Fix these before running:', ...validation.globalErrors, ...Object.values(validation.errors).flat()].join('\n'))

    const existing = await this.get(draft.workDate)
    const now = new Date().toISOString()
    this.journal = existing
      ? { ...existing, state: 'running', updatedAt: now }
      : { workDate: draft.workDate, state: 'running', submitted: {}, results: {}, log: [], updatedAt: now }
    this.stopRequested = false

    const page = await this.browser.requirePage(settings).catch(async (err: Error) => {
      this.journal = { ...this.journal!, state: 'stopped' }
      this.addLog('error', `Cannot start: ${err.message}`)
      await this.persist()
      throw err
    })

    const todo = draft.entries.filter((e) => nextStep(this.journal!.results[e.id]) !== 'skip')
    this.addLog('info', `Run started for ${draft.workDate}: ${todo.length} of ${draft.entries.length} task(s) to process`)
    await this.persist()

    this.active = this.loop(page, draft, settings).finally(() => {
      this.active = null
    })
    return this.journal
  }

  requestStop(): void {
    if (!this.active || !this.journal) return
    this.stopRequested = true
    this.journal = { ...this.journal, state: 'stopping' }
    this.addLog('warn', 'Stop requested. Finishing the current step, no new submits will start')
    void this.persist()
  }

  async resolve(workDate: string, entryId: string, resolution: UncertainResolution): Promise<RunJournal> {
    if (this.active) throw new Error('Wait for the current run to finish')
    const journal = await this.get(workDate)
    if (!journal) throw new Error('No run found for that date')
    this.journal = resolveUncertain(journal, entryId, resolution, new Date().toISOString())
    this.addLog(
      'info',
      resolution === 'mark-completed'
        ? 'An uncertain task was marked as saved'
        : 'An uncertain task was marked for retry',
    )
    await this.persist()
    return this.journal
  }

  async discard(workDate: string): Promise<void> {
    if (this.active) throw new Error('Wait for the current run to finish')
    const journal = await this.get(workDate)
    if (journal && Object.values(journal.results).some((r) => r.status !== 'pending' && r.status !== 'failed'))
      throw new Error('This run already created tasks in Growtrail; its history cannot be discarded')
    await deleteJournal(workDate)
    if (this.journal?.workDate === workDate) this.journal = null
  }

  private async loop(page: Page, draft: Draft, settings: Settings): Promise<void> {
    let halted = false
    for (const draftEntry of draft.entries) {
      if (this.stopRequested) break
      const step = nextStep(this.journal!.results[draftEntry.id])
      if (step === 'skip') continue
      const entry = trimChoices(entryForStep(step, draftEntry, this.journal!.submitted[draftEntry.id]))
      const label = `"${entry.title}"`
      this.journal = { ...this.journal!, currentEntryId: entry.id }

      let taskId = this.journal!.results[entry.id]?.growtrailTaskId
      try {
        if (step === 'create-and-log') {
          await this.setResult(entry.id, 'pending', { operation: 'Creating task' })
          taskId = await createTask(page, entry, settings, {
            checkStop: () => this.throwIfStopping(),
            beforeSubmit: async () => {
              this.journal!.submitted[entry.id] = entry
              await this.setResult(entry.id, 'creating-task', { operation: 'Submitting Add Task' })
            },
            log: (m) => this.addLog('info', m),
          })
          await this.setResult(entry.id, 'task-created', { taskId, message: undefined })
          this.addLog('success', `Created task #${taskId} for ${label}`)
        }

        if (!taskId) throw new Error('No Growtrail task ID recorded for this entry')
        await this.setResult(entry.id, 'opening-time-log', { taskId, operation: 'Opening time log' })
        const outcome = await logTime(page, taskId, entry, draft.workDate, settings, {
          checkStop: () => this.throwIfStopping(),
          beforeSubmit: () => this.setResult(entry.id, 'submitting-time-log', { taskId, operation: 'Submitting time log' }),
          log: (m) => this.addLog('info', m),
        })
        await this.setResult(entry.id, 'completed', { taskId, message: outcome.note })
        this.addLog('success', `Logged ${entry.spent} h on task #${taskId} for ${label}`)
      } catch (err) {
        const current = this.journal!.results[entry.id]?.status
        const e = asAutomationError(err, current && IN_FLIGHT.includes(current) ? 'uncertain' : 'failed')
        const kind = current && IN_FLIGHT.includes(current) && e.kind !== 'uncertain' ? 'uncertain' : e.kind

        if (kind === 'stopped') {
          await this.setResult(entry.id, taskId ? 'task-created' : 'pending', { taskId, message: undefined })
          this.addLog('warn', `Stopped before submitting ${label}`)
          break
        }
        if (kind === 'uncertain') {
          await this.setResult(entry.id, 'uncertain', { taskId, message: e.message })
          this.addLog('error', `${label} needs checking in Growtrail: ${e.message}`)
          halted = true
          break
        }
        await this.setResult(entry.id, 'failed', { taskId, message: e.message })
        this.addLog('error', `${label} failed (nothing submitted for this step): ${e.message}`)
        if (!this.browser.isConnected() || /sign in|sign-in/i.test(e.message)) {
          halted = true
          break
        }
      }
    }

    const finishedAll = !halted && !this.stopRequested
    this.journal = {
      ...this.journal!,
      state: finishedAll ? 'finished' : 'stopped',
      currentEntryId: undefined,
      currentOperation: undefined,
    }
    this.addLog(finishedAll ? 'info' : 'warn', finishedAll ? 'Run finished' : 'Run stopped')
    await this.persist()
  }

  private throwIfStopping() {
    if (this.stopRequested) throw stopped()
  }

  private async setResult(
    entryId: string,
    status: EntryRunStatus,
    opts: { taskId?: string; message?: string; operation?: string },
  ): Promise<void> {
    const prev = this.journal!.results[entryId]
    const next: EntryRun = {
      entryId,
      status,
      growtrailTaskId: opts.taskId ?? prev?.growtrailTaskId,
      message: 'message' in opts ? opts.message : prev?.message,
      updatedAt: new Date().toISOString(),
    }
    this.journal = {
      ...this.journal!,
      results: { ...this.journal!.results, [entryId]: next },
      currentOperation: opts.operation,
    }
    await this.persist()
  }

  private addLog(level: LogEvent['level'], message: string) {
    if (!this.journal) return
    const log = [...this.journal.log, { at: new Date().toISOString(), level, message }].slice(-MAX_LOG)
    this.journal = { ...this.journal, log }
    this.emit(this.journal)
  }

  private async persist(): Promise<void> {
    if (!this.journal) return
    this.journal = { ...this.journal, updatedAt: new Date().toISOString() }
    await saveJournal(this.journal)
    this.emit(this.journal)
  }
}
