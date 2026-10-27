import { useEffect, useMemo, useRef, useState } from 'react'
import { formatIsoDate } from '@shared/dates'
import { newEntry, updateEntry } from '@shared/defaults'
import { formatDuration, parseDuration, sumDurations } from '@shared/duration'
import { isEntryLocked, nextStep } from '@shared/run-plan'
import type { BrowserStatus, RunJournal, Settings, TaskEntry, UncertainResolution } from '@shared/types'
import { isDraftRunnable, validateDraft } from '@shared/validation'
import { DailyTotal, ExecutionLog, ProgressPanel } from '../components/SidePanels'
import { TaskCard } from '../components/TaskCard'
import { Banner, Modal } from '../components/ui'
import { errorMessage } from '../errors'

const api = window.api

interface Props {
  settings: Settings
  workDate: string
  browser: BrowserStatus
  onOpenSettings: () => void
}

export function HomePage({ settings, workDate, browser, onOpenSettings }: Props) {
  const [entries, setEntries] = useState<TaskEntry[] | null>(null)
  const [journal, setJournal] = useState<RunJournal | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showAllErrors, setShowAllErrors] = useState(false)
  const [lastAddedId, setLastAddedId] = useState<string | null>(null)
  const loadedFor = useRef<string | null>(null)
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  useEffect(() => {
    let cancelled = false
    loadedFor.current = null
    setEntries(null)
    setError(null)
    setShowAllErrors(false)
    void Promise.all([api.loadDraft(workDate), api.getRun(workDate)])
      .then(([draft, run]) => {
        if (cancelled) return
        setEntries(draft && draft.entries.length > 0 ? draft.entries : [newEntry(settingsRef.current, crypto.randomUUID())])
        setJournal(run)
        loadedFor.current = workDate
      })
      .catch((err) => !cancelled && setError(errorMessage(err)))
    return () => {
      cancelled = true
    }
  }, [workDate])

  useEffect(() => api.onRun((j) => j.workDate === workDate && setJournal(j)), [workDate])

  useEffect(() => {
    if (!entries || loadedFor.current !== workDate) return
    const t = setTimeout(() => {
      api.saveDraft({ workDate, entries, updatedAt: new Date().toISOString() }).catch((err) => setError(errorMessage(err)))
    }, 400)
    return () => clearTimeout(t)
  }, [entries, workDate])

  const validation = useMemo(() => validateDraft(entries ?? [], settings, workDate), [entries, settings, workDate])
  const running = journal?.state === 'running' || journal?.state === 'stopping'
  const shortcuts = useRef({ add: () => {}, run: () => {} })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key !== 'Enter') return
      e.preventDefault()
      if (e.shiftKey) shortcuts.current.run()
      else shortcuts.current.add()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!entries) return <div className="p-8 text-muted">Loading…</div>

  const toProcess = entries.filter((e) => nextStep(journal?.results[e.id]) !== 'skip')
  const hoursToProcess = sumDurations(
    toProcess.map((e) => {
      const p = parseDuration(e.spent)
      return p.ok ? p.hundredths : 0
    }),
  )
  const uncertainCount = entries.filter((e) => journal?.results[e.id]?.status === 'uncertain').length
  const completedCount = entries.filter((e) => journal?.results[e.id]?.status === 'completed').length
  const runnable = isDraftRunnable(validation)
  const connected = browser.state === 'connected'
  const runBlocker = !connected
    ? 'Connect the browser first'
    : toProcess.length === 0
      ? 'Nothing left to run for this date'
      : null
  const problemCount = validation.globalErrors.length + Object.keys(validation.errors).length

  const patch = (id: string, p: Partial<TaskEntry>) =>
    setEntries((list) => list!.map((e) => (e.id === id ? updateEntry(e, p) : e)))
  const add = () => {
    const entry = newEntry(settings, crypto.randomUUID())
    setLastAddedId(entry.id)
    setEntries((list) => [...list!, entry])
  }
  const requestRun = () => {
    if (runBlocker || busy || running) return
    if (!runnable) {
      setShowAllErrors(true)
      document.querySelector('.field-invalid, [data-problems]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setConfirming(true)
  }
  shortcuts.current = { add: () => !running && add(), run: requestRun }
  const remove = (id: string) => setEntries((list) => list!.filter((e) => e.id !== id))
  const duplicate = (entry: TaskEntry) =>
    setEntries((list) => {
      const i = list!.findIndex((e) => e.id === entry.id)
      const copy = { ...entry, id: crypto.randomUUID() }
      return [...list!.slice(0, i + 1), copy, ...list!.slice(i + 1)]
    })
  const removeCompleted = () =>
    setEntries((list) => {
      const rest = list!.filter((e) => journal?.results[e.id]?.status !== 'completed')
      return rest.length > 0 ? rest : [newEntry(settings, crypto.randomUUID())]
    })

  const start = async () => {
    setConfirming(false)
    setError(null)
    setBusy(true)
    try {
      setJournal(await api.startRun({ workDate, entries, updatedAt: new Date().toISOString() }))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const resolve = async (entryId: string, resolution: UncertainResolution) => {
    try {
      setJournal(await api.resolveUncertain(workDate, entryId, resolution))
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
          {error && <Banner tone="bad">{error}</Banner>}
          {validation.globalErrors.length > 0 && (
            <Banner tone="bad">
              <ul className="list-disc pl-4">
                {validation.globalErrors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
              {validation.globalErrors.some((e) => e.includes('Settings')) && (
                <button type="button" className="mt-1 font-medium underline" onClick={onOpenSettings}>
                  Open Settings
                </button>
              )}
            </Banner>
          )}
          {settings.knownProjects.length === 0 && (
            <Banner tone="info">
              Project and employee lists have not been loaded from Growtrail yet. Connect the browser, then use{' '}
              <button type="button" className="font-medium underline" onClick={onOpenSettings}>
                Settings → Fetch from Growtrail
              </button>
              .
            </Banner>
          )}
          {uncertainCount > 0 && (
            <Banner tone="warn">
              {uncertainCount} task(s) need checking in Growtrail before they can be continued. See the highlighted card(s).
            </Banner>
          )}

          {entries.map((entry, i) => {
            const result = journal?.results[entry.id]
            return (
              <TaskCard
                key={entry.id}
                index={i}
                entry={entry}
                projects={settings.knownProjects}
                errors={validation.errors[entry.id] ?? []}
                warnings={validation.entryWarnings[entry.id] ?? []}
                showAllErrors={showAllErrors}
                autoFocus={entry.id === lastAddedId}
                result={result}
                locked={running || isEntryLocked(result)}
                canRemove={entries.length > 1}
                onChange={(p) => patch(entry.id, p)}
                onRemove={() => remove(entry.id)}
                onDuplicate={() => duplicate(entry)}
                onResolve={(r) => void resolve(entry.id, r)}
                resolveDisabled={running}
              />
            )
          })}

          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost" onClick={add} disabled={running} title="Ctrl+Enter">
              + Add task row <kbd className="ml-1 rounded border border-line px-1 text-[10px] text-muted">Ctrl ↵</kbd>
            </button>
            {completedCount > 0 && !running && (
              <button type="button" className="btn btn-ghost" onClick={removeCompleted}>
                Clear {completedCount} completed
              </button>
            )}
          </div>
        </div>

        <footer className="flex items-center gap-4 border-t border-line bg-panel px-5 py-3">
          <DailyTotal total={validation.totalHundredths} target={settings.dailyTargetHundredths} />
          <div className="flex items-center gap-2">
            {!running && (runBlocker || (showAllErrors && problemCount > 0)) && (
              <span className="text-xs text-muted" data-problems>
                {runBlocker ?? `${problemCount} problem${problemCount === 1 ? '' : 's'} to fix`}
              </span>
            )}
            {running ? (
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => void api.stopRun()}
                disabled={journal?.state === 'stopping'}
              >
                {journal?.state === 'stopping' ? 'Stopping after current step…' : 'Stop'}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-accent px-5"
                disabled={!!runBlocker || busy}
                title="Ctrl+Shift+Enter"
                onClick={requestRun}
              >
                {entries.some((e) => (journal?.results[e.id]?.status ?? 'pending') !== 'pending') ? 'Resume run' : 'Run automation'}
              </button>
            )}
          </div>
        </footer>
      </div>

      <aside className="flex w-[340px] shrink-0 flex-col gap-3 border-l border-line p-4">
        <ProgressPanel journal={journal} entries={entries} total={validation.totalHundredths} />
        <ExecutionLog journal={journal} />
      </aside>

      {confirming && (
        <Modal
          title="Start the run?"
          actions={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirming(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-accent" onClick={() => void start()}>
                Create and log {toProcess.length} task(s)
              </button>
            </>
          }
        >
          <p>
            This will submit to Growtrail as <b>{browser.userName ?? settings.assignedTo}</b>, for{' '}
            <b>{formatIsoDate(workDate)}</b>:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              {toProcess.filter((e) => nextStep(journal?.results[e.id]) === 'create-and-log').length} new task(s) created, then
              time logged against each
            </li>
            {toProcess.some((e) => nextStep(journal?.results[e.id]) === 'log-only') && (
              <li>
                {toProcess.filter((e) => nextStep(journal?.results[e.id]) === 'log-only').length} existing task(s) from an earlier
                run get their time log only
              </li>
            )}
            <li>
              {formatDuration(hoursToProcess)} logged in this run (day total {formatDuration(validation.totalHundredths)})
            </li>
            <li>
              Assigned to {settings.assignedTo}
              {settings.followedBy.length > 0 ? `, followed by ${settings.followedBy.join(', ')}` : ''}
            </li>
          </ul>
          {validation.warnings.map((w) => (
            <Banner key={w} tone="warn">
              {w}
            </Banner>
          ))}
          {uncertainCount > 0 && <Banner tone="warn">{uncertainCount} task(s) marked "Check Growtrail" are skipped.</Banner>}
          <p className="text-xs text-muted">
            Tasks run one at a time. Stop finishes the current step and never cancels a submit already sent.
          </p>
        </Modal>
      )}
    </div>
  )
}
