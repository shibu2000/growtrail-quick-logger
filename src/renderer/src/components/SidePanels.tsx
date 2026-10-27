import { useEffect, useRef } from 'react'
import { formatDuration } from '@shared/duration'
import { summarize } from '@shared/run-plan'
import type { BrowserStatus, RunJournal, TaskEntry } from '@shared/types'

export function ConnectionBadge({ status }: { status: BrowserStatus }) {
  const tone = {
    connected: 'bg-ok',
    connecting: 'bg-brand animate-pulse',
    'login-required': 'bg-warn',
    'growtrail-not-found': 'bg-warn',
    disconnected: 'bg-muted',
    error: 'bg-bad',
  }[status.state]
  const label = {
    connected: status.userName ? `Connected as ${status.userName}` : 'Connected',
    connecting: 'Connecting…',
    'login-required': 'Login required',
    'growtrail-not-found': 'Growtrail not found',
    disconnected: 'Disconnected',
    error: 'Connection error',
  }[status.state]
  return (
    <span className="inline-flex items-center gap-2 text-sm" title={status.message}>
      <span className={`h-2.5 w-2.5 rounded-full ${tone}`} />
      {label}
    </span>
  )
}

export function DailyTotal({ total, target }: { total: number; target: number }) {
  const pct = Math.min(100, Math.round((total / target) * 100))
  const below = total < target
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1 flex items-baseline gap-2">
        <span className="text-lg font-semibold tabular-nums">{formatDuration(total)}</span>
        <span className="text-sm text-muted">of {formatDuration(target)} daily target</span>
        {below ? (
          <span className="text-sm font-medium text-warn">{formatDuration(target - total)} short</span>
        ) : total > target ? (
          <span className="text-sm text-muted">{formatDuration(total - target)} over target</span>
        ) : null}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
        <div className={`h-full rounded-full ${below ? 'bg-warn' : 'bg-ok'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function ProgressPanel({
  journal,
  entries,
  total,
}: {
  journal: RunJournal | null
  entries: TaskEntry[]
  total: number
}) {
  const counts = summarize(journal, entries.map((e) => e.id))
  const current = journal?.currentEntryId ? entries.find((e) => e.id === journal.currentEntryId) : undefined
  const stat = (label: string, value: number, tone = '') => (
    <div className="rounded-md bg-canvas px-3 py-2">
      <div className={`text-lg font-semibold tabular-nums ${tone}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
    </div>
  )
  return (
    <section className="card p-4">
      <h2 className="mb-3 text-sm font-semibold">Progress</h2>
      <div className="grid grid-cols-2 gap-2">
        {stat('Total tasks', counts.total)}
        {stat('Completed', counts.completed, 'text-ok')}
        {stat('Failed', counts.failed, counts.failed ? 'text-bad' : '')}
        {stat('Need checking', counts.uncertain, counts.uncertain ? 'text-warn' : '')}
      </div>
      <dl className="mt-3 space-y-1 text-xs">
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Run state</dt>
          <dd className="font-medium">{journal?.state ?? 'not started'}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Current task</dt>
          <dd className="truncate font-medium">{current?.title || '—'}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Current step</dt>
          <dd className="font-medium">{journal?.currentOperation ?? '—'}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Daily total</dt>
          <dd className="font-medium tabular-nums">{formatDuration(total)}</dd>
        </div>
      </dl>
    </section>
  )
}

export function ExecutionLog({ journal }: { journal: RunJournal | null }) {
  const end = useRef<HTMLDivElement>(null)
  const count = journal?.log.length ?? 0
  useEffect(() => {
    void end.current?.scrollIntoView({ block: 'end' })
  }, [count])
  const tone = { info: 'text-ink', success: 'text-ok', warn: 'text-warn', error: 'text-bad' }
  return (
    <section className="card flex min-h-0 flex-1 flex-col p-4">
      <h2 className="mb-2 text-sm font-semibold">Execution log</h2>
      <div className="min-h-0 flex-1 overflow-y-auto rounded-md bg-canvas p-2 font-mono text-[12px] leading-5">
        {count === 0 && <p className="text-muted">Nothing yet. Events appear here during a run.</p>}
        {journal?.log.map((e, i) => (
          <div key={i} className={tone[e.level]}>
            <span className="text-muted">{new Date(e.at).toLocaleTimeString()} </span>
            {e.message}
          </div>
        ))}
        <div ref={end} />
      </div>
    </section>
  )
}
