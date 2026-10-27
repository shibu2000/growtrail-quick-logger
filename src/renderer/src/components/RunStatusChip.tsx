import type { EntryRun } from '@shared/types'

const LABELS: Record<EntryRun['status'], string> = {
  pending: 'Not started',
  'creating-task': 'Creating task…',
  'task-created': 'Task created',
  'opening-time-log': 'Opening time log…',
  'submitting-time-log': 'Logging time…',
  completed: 'Done',
  failed: 'Failed',
  uncertain: 'Check Growtrail',
}

export function RunStatusChip({ result }: { result?: EntryRun }) {
  const status = result?.status ?? 'pending'
  const busy = status === 'creating-task' || status === 'opening-time-log' || status === 'submitting-time-log'
  const tone =
    status === 'completed'
      ? 'bg-ok-soft text-ok'
      : status === 'failed'
        ? 'bg-bad-soft text-bad'
        : status === 'uncertain'
          ? 'bg-warn-soft text-warn'
          : status === 'task-created' || busy
            ? 'bg-brand-soft text-brand'
            : 'bg-canvas text-muted'
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>
      {busy && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
      {LABELS[status]}
      {result?.growtrailTaskId && <span className="font-mono opacity-80">#{result.growtrailTaskId}</span>}
    </span>
  )
}
