import { useState, type FocusEvent } from 'react'
import { formatDuration, parseDuration } from '@shared/duration'
import { BILLABLE, PRIORITIES, TASK_STATUSES, TASK_TYPES, TIME_LOG_TYPES, statusLabel } from '@shared/options'
import type { EntryRun, TaskEntry, UncertainResolution } from '@shared/types'
import { Label, Select } from './ui'
import { RunStatusChip } from './RunStatusChip'

interface Props {
  index: number
  entry: TaskEntry
  projects: string[]
  errors: string[]
  warnings: string[]
  showAllErrors: boolean
  autoFocus: boolean
  result?: EntryRun
  locked: boolean
  canRemove: boolean
  onChange: (patch: Partial<TaskEntry>) => void
  onRemove: () => void
  onDuplicate: () => void
  onResolve: (resolution: UncertainResolution) => void
  resolveDisabled: boolean
}

const FIELD_PREFIX: Record<string, string> = {
  title: 'Title',
  project: 'Project',
  type: 'Task Type',
  spent: 'Spent',
  status: 'Status',
  priority: 'Priority',
  tbill: 'Task Billable',
  ltype: 'Time Log Type',
  lbill: 'Time Log Billable',
  est: 'Estimate',
}
const MORE_PREFIXES = ['Status', 'Priority', 'Task Billable', 'Time Log Type', 'Time Log Billable', 'Estimate']

export function TaskCard(props: Props) {
  const { index, entry, projects, errors, warnings, result, locked, onChange } = props
  const [touched, setTouched] = useState<string[]>([])
  const [expanded, setExpanded] = useState(false)
  const id = (name: string) => `${entry.id}-${name}`
  const spent = parseDuration(entry.spent)
  const estimate = parseDuration(entry.estimate)
  const mismatch = spent.ok && estimate.ok && spent.hundredths !== estimate.hundredths

  const visibleErrors = locked
    ? []
    : errors.filter((e) => props.showAllErrors || touched.some((p) => e.startsWith(p)))
  const hasError = (prefix: string) => visibleErrors.some((e) => e.startsWith(prefix))
  const moreNeedsAttention =
    mismatch || [...visibleErrors, ...warnings].some((m) => MORE_PREFIXES.some((p) => m.startsWith(p)))
  const showMore = expanded || moreNeedsAttention

  const markTouched = (e: FocusEvent<HTMLElement>) => {
    const prefix = FIELD_PREFIX[e.target.id.slice(entry.id.length + 1)]
    if (prefix && !touched.includes(prefix)) setTouched([...touched, prefix])
  }

  const summary = [
    statusLabel(entry.status),
    entry.priority,
    entry.timeLogType || 'No log type',
    `Task billable ${entry.taskBillable}`,
    `Log billable ${entry.timeLogBillable}`,
  ].join(' · ')

  return (
    <article
      onBlur={markTouched}
      className={`card p-4 transition-shadow focus-within:shadow-md ${result?.status === 'uncertain' ? 'border-warn/60' : ''} ${locked ? 'opacity-80' : ''}`}
    >
      <header className="mb-3 flex items-center gap-3">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
          {index + 1}
        </span>
        <RunStatusChip result={result} />
        {locked && <span className="text-xs text-muted">Already in Growtrail, read-only</span>}
        <div className="ml-auto flex gap-1.5">
          <button type="button" className="btn btn-ghost px-2 py-1 text-xs" onClick={props.onDuplicate}>
            Duplicate
          </button>
          <button
            type="button"
            className="btn btn-danger px-2 py-1 text-xs"
            onClick={props.onRemove}
            disabled={locked || !props.canRemove}
            title={locked ? 'Already sent to Growtrail' : 'Remove this task'}
          >
            Remove
          </button>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-5">
          <Label htmlFor={id('title')}>Task title</Label>
          <input
            id={id('title')}
            className={`field ${hasError('Title') ? 'field-invalid' : ''}`}
            value={entry.title}
            disabled={locked}
            autoFocus={props.autoFocus}
            placeholder="What did you work on?"
            onChange={(e) => onChange({ title: e.target.value })}
          />
        </div>
        <div className="col-span-3">
          <Label htmlFor={id('project')}>Project</Label>
          <Select
            id={id('project')}
            value={entry.project}
            options={projects}
            placeholder={projects.length ? 'Select project' : 'Fetch projects in Settings'}
            disabled={locked}
            invalid={hasError('Project')}
            onChange={(project) => onChange({ project })}
          />
        </div>
        <div className="col-span-2">
          <Label htmlFor={id('type')}>Task type</Label>
          <Select
            id={id('type')}
            value={entry.taskType}
            options={TASK_TYPES}
            placeholder="Select"
            disabled={locked}
            invalid={hasError('Task Type')}
            onChange={(taskType) => onChange({ taskType })}
          />
        </div>
        <div className="col-span-2">
          <Label htmlFor={id('spent')}>Spent time (h)</Label>
          <input
            id={id('spent')}
            className={`field font-mono ${hasError('Spent') ? 'field-invalid' : ''}`}
            value={entry.spent}
            disabled={locked}
            inputMode="decimal"
            placeholder="e.g. 1.5"
            onChange={(e) => onChange({ spent: e.target.value })}
          />
          <p className="mt-1 h-4 text-xs text-muted">{spent.ok ? formatDuration(spent.hundredths) : ''}</p>
        </div>

        <div className="col-span-6">
          <Label htmlFor={id('desc')}>Task description</Label>
          <textarea
            id={id('desc')}
            rows={2}
            className="field resize-y"
            value={entry.description}
            disabled={locked}
            placeholder="Optional details"
            onChange={(e) => onChange({ description: e.target.value })}
          />
        </div>
        <div className="col-span-6">
          <div className="flex items-baseline justify-between">
            <Label htmlFor={id('logdesc')}>Time log description</Label>
            {entry.timeLogDescriptionEdited ? (
              <button
                type="button"
                className="text-[11px] font-medium text-brand hover:underline disabled:opacity-50"
                disabled={locked}
                onClick={() => onChange({ timeLogDescription: entry.description, timeLogDescriptionEdited: false })}
              >
                Copy from task description
              </button>
            ) : (
              <span className="text-[11px] text-muted">Same as task description</span>
            )}
          </div>
          <textarea
            id={id('logdesc')}
            rows={2}
            className="field resize-y"
            value={entry.timeLogDescription}
            disabled={locked}
            onChange={(e) => onChange({ timeLogDescription: e.target.value })}
          />
        </div>
      </div>

      <div className="mt-3 border-t border-line pt-2">
        <button
          type="button"
          className="flex w-full items-center gap-2 text-left text-xs text-muted hover:text-ink"
          aria-expanded={showMore}
          disabled={moreNeedsAttention}
          onClick={() => setExpanded(!expanded)}
        >
          <span className={`inline-block transition-transform ${showMore ? 'rotate-90' : ''}`}>▸</span>
          <span className="font-semibold uppercase tracking-wide">More options</span>
          {!showMore && <span className="truncate">{summary}</span>}
        </button>

        {showMore && (
          <div className="mt-2 grid grid-cols-12 gap-3">
            <div className="col-span-2">
              <Label htmlFor={id('status')}>Status</Label>
              <Select
                id={id('status')}
                value={entry.status}
                options={TASK_STATUSES}
                format={statusLabel}
                disabled={locked}
                invalid={hasError('Status')}
                onChange={(status) => onChange({ status })}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor={id('priority')}>Priority</Label>
              <Select
                id={id('priority')}
                value={entry.priority}
                options={PRIORITIES}
                disabled={locked}
                invalid={hasError('Priority')}
                onChange={(priority) => onChange({ priority })}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor={id('tbill')}>Task billable</Label>
              <Select
                id={id('tbill')}
                value={entry.taskBillable}
                options={BILLABLE}
                disabled={locked}
                invalid={hasError('Task Billable')}
                onChange={(taskBillable) => onChange({ taskBillable })}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor={id('ltype')}>Time log type</Label>
              <Select
                id={id('ltype')}
                value={entry.timeLogType}
                options={TIME_LOG_TYPES}
                placeholder="Select"
                disabled={locked}
                invalid={hasError('Time Log Type')}
                onChange={(timeLogType) => onChange({ timeLogType })}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor={id('lbill')}>Log billable</Label>
              <Select
                id={id('lbill')}
                value={entry.timeLogBillable}
                options={BILLABLE}
                disabled={locked}
                invalid={hasError('Time Log Billable')}
                onChange={(timeLogBillable) => onChange({ timeLogBillable })}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor={id('est')}>Estimate (h)</Label>
              <div className="flex gap-1">
                <input
                  id={id('est')}
                  className={`field font-mono ${mismatch || hasError('Estimate') ? 'field-invalid' : ''}`}
                  value={entry.estimate}
                  disabled={locked}
                  inputMode="decimal"
                  onChange={(e) => onChange({ estimate: e.target.value })}
                />
                {mismatch && !locked && (
                  <button
                    type="button"
                    className="btn btn-ghost px-2 text-xs"
                    title="Set Estimate equal to Spent Time"
                    onClick={() => onChange({ estimate: entry.spent })}
                  >
                    Sync
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {visibleErrors.length > 0 && (
        <ul className="mt-3 list-disc space-y-0.5 pl-5 text-xs text-bad">
          {visibleErrors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      {warnings.length > 0 && !locked && (
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-warn">
          {warnings.map((w) => (
            <li key={w}>{w}. Pick a current option or fetch the lists again in Settings</li>
          ))}
        </ul>
      )}

      {result?.message && (
        <p className={`mt-3 text-xs ${result.status === 'completed' ? 'text-muted' : result.status === 'uncertain' ? 'text-warn' : 'text-bad'}`}>
          {result.message}
        </p>
      )}

      {result?.status === 'uncertain' && (
        <div className="mt-3 rounded-md border border-warn/30 bg-warn-soft p-3 text-xs text-ink">
          <p className="mb-2">
            The app could not confirm what happened in Growtrail and will not resubmit on its own. Check My Task / My Time
            Sheet{result.growtrailTaskId ? ` for task #${result.growtrailTaskId}` : ''}, then choose:
          </p>
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost py-1 text-xs" disabled={props.resolveDisabled} onClick={() => props.onResolve('mark-completed')}>
              It was saved (mark done)
            </button>
            <button type="button" className="btn btn-ghost py-1 text-xs" disabled={props.resolveDisabled} onClick={() => props.onResolve('retry')}>
              {result.growtrailTaskId ? 'The time log was not saved (retry log)' : 'Nothing was created (retry)'}
            </button>
          </div>
        </div>
      )}
    </article>
  )
}
