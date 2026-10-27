import { useEffect, useState, type ReactNode } from 'react'
import { formatDuration, parseDuration } from '@shared/duration'
import { BILLABLE, PRIORITIES, TASK_STATUSES, TASK_TYPES, TIME_LOG_TYPES, statusLabel } from '@shared/options'
import type { BrowserStatus, Settings } from '@shared/types'
import { settingsSchema } from '@shared/validation'
import { Banner, Label, Modal, Select } from '../components/ui'
import { errorMessage } from '../errors'

const api = window.api

interface Props {
  settings: Settings
  browser: BrowserStatus
  onSaved: (settings: Settings) => void
  onClose: () => void
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      <div className="mt-4 grid grid-cols-2 gap-4">{children}</div>
    </section>
  )
}

export function SettingsPage({ settings, browser, onSaved, onClose }: Props) {
  const [form, setForm] = useState<Settings>(settings)
  const [target, setTarget] = useState((settings.dailyTargetHundredths / 100).toString())
  const [detected, setDetected] = useState<string[]>([])
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)
  const [fetching, setFetching] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  useEffect(() => {
    setForm(settings)
  }, [settings])
  useEffect(() => {
    void api.detectBrowsers().then(setDetected)
  }, [])

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setForm((f) => ({ ...f, [key]: value }))
  const dirty = JSON.stringify(form) !== JSON.stringify(settings) || target !== (settings.dailyTargetHundredths / 100).toString()
  const employees = form.knownEmployees

  const save = async () => {
    setMessage(null)
    const parsedTarget = parseDuration(target)
    if (!parsedTarget.ok) return setMessage({ tone: 'bad', text: `Daily target: ${parsedTarget.error}` })
    const candidate = { ...form, dailyTargetHundredths: parsedTarget.hundredths }
    const check = settingsSchema.safeParse(candidate)
    if (!check.success)
      return setMessage({ tone: 'bad', text: check.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') })
    try {
      const saved = await api.saveSettings(check.data)
      onSaved(saved)
      setMessage({ tone: 'ok', text: 'Settings saved' })
    } catch (err) {
      setMessage({ tone: 'bad', text: errorMessage(err) })
    }
  }

  const fetchOptions = async () => {
    setFetching(true)
    setMessage(null)
    try {
      const opts = await api.fetchGrowtrailOptions()
      const fresh = await api.getSettings()
      onSaved(fresh)
      setMessage({ tone: 'ok', text: `Loaded ${opts.projects.length} projects and ${opts.employees.length} employees from Growtrail` })
    } catch (err) {
      setMessage({ tone: 'bad', text: errorMessage(err) })
    } finally {
      setFetching(false)
    }
  }

  const reset = async () => {
    setConfirmReset(false)
    try {
      const fresh = await api.resetSettings()
      onSaved(fresh)
      setTarget((fresh.dailyTargetHundredths / 100).toString())
      setMessage({ tone: 'ok', text: 'Settings reset to defaults' })
    } catch (err) {
      setMessage({ tone: 'bad', text: errorMessage(err) })
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-4 p-6">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">Settings</h1>
          <div className="ml-auto flex gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmReset(true)}>
              Reset to defaults
            </button>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Back
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={!dirty}>
              Save
            </button>
          </div>
        </div>
        {message && <Banner tone={message.tone}>{message.text}</Banner>}

        <Section
          title="Growtrail lists"
          hint="Projects and employees are read from your Create Task form in Growtrail, so the app never guesses them."
        >
          <div className="col-span-2 flex items-center gap-3">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void fetchOptions()}
              disabled={fetching || browser.state !== 'connected'}
            >
              {fetching ? 'Fetching…' : 'Fetch from Growtrail'}
            </button>
            <span className="text-xs text-muted">
              {browser.state !== 'connected'
                ? 'Connect the browser first.'
                : settings.optionsFetchedAt
                  ? `${settings.knownProjects.length} projects, ${settings.knownEmployees.length} employees · fetched ${new Date(settings.optionsFetchedAt).toLocaleString()}`
                  : 'Not fetched yet.'}
            </span>
          </div>
        </Section>

        <Section title="People" hint="Used for every task the app creates.">
          <div>
            <Label htmlFor="assigned">Assigned To</Label>
            <Select id="assigned" value={form.assignedTo} options={employees} placeholder={employees.length ? 'Select employee' : 'Fetch from Growtrail first'} onChange={(v) => set('assignedTo', v)} />
          </div>
          <div>
            <Label htmlFor="followed">Followed By (optional)</Label>
            <Select
              id="followed"
              value=""
              options={employees.filter((n) => !form.followedBy.includes(n))}
              placeholder={employees.length ? 'Add a person' : 'Fetch from Growtrail first'}
              onChange={(name) => name && set('followedBy', [...form.followedBy, name])}
            />
            {form.followedBy.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {form.followedBy.map((name) => (
                  <span key={name} className="inline-flex items-center gap-1 rounded-full bg-brand-soft py-0.5 pl-2.5 pr-1 text-xs text-brand">
                    {name}
                    <button
                      type="button"
                      aria-label={`Remove ${name}`}
                      className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-brand/15"
                      onClick={() => set('followedBy', form.followedBy.filter((n) => n !== name))}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </Section>

        <Section title="Task defaults" hint="New task rows start with these. Each row can still be changed.">
          <div>
            <Label htmlFor="dproject">Default project</Label>
            <Select id="dproject" value={form.defaultProject} options={form.knownProjects} placeholder="None" onChange={(v) => set('defaultProject', v)} />
          </div>
          <div>
            <Label htmlFor="dtype">Default task type</Label>
            <Select id="dtype" value={form.defaultTaskType} options={TASK_TYPES} placeholder="None" onChange={(v) => set('defaultTaskType', v)} />
          </div>
          <div>
            <Label htmlFor="dstatus">Default status</Label>
            <Select id="dstatus" value={form.defaultStatus} options={TASK_STATUSES} format={statusLabel} onChange={(v) => set('defaultStatus', v)} />
            <p className="mt-1 text-xs text-muted">"Delete" is never allowed.</p>
          </div>
          <div>
            <Label htmlFor="dpriority">Default priority</Label>
            <Select id="dpriority" value={form.defaultPriority} options={PRIORITIES} onChange={(v) => set('defaultPriority', v)} />
          </div>
          <div>
            <Label htmlFor="dtbill">Default task billable</Label>
            <Select id="dtbill" value={form.defaultTaskBillable} options={BILLABLE} onChange={(v) => set('defaultTaskBillable', v as Settings['defaultTaskBillable'])} />
          </div>
        </Section>

        <Section title="Time log defaults">
          <div>
            <Label htmlFor="dltype">Default time log type</Label>
            <Select id="dltype" value={form.defaultTimeLogType} options={TIME_LOG_TYPES} placeholder="None" onChange={(v) => set('defaultTimeLogType', v)} />
            <p className="mt-1 text-xs text-warn">
              Known Growtrail issue: its form sends an empty value for every type, so the type you pick is not stored by Growtrail.
            </p>
          </div>
          <div>
            <Label htmlFor="dlbill">Default time log billable</Label>
            <Select id="dlbill" value={form.defaultTimeLogBillable} options={BILLABLE} onChange={(v) => set('defaultTimeLogBillable', v as Settings['defaultTimeLogBillable'])} />
          </div>
          <div>
            <Label htmlFor="target">Daily target (hours)</Label>
            <input id="target" className="field font-mono" value={target} onChange={(e) => setTarget(e.target.value)} />
            <p className="mt-1 text-xs text-muted">
              {(() => {
                const p = parseDuration(target)
                return p.ok ? `${formatDuration(p.hundredths)}. Below this shows a warning; it never blocks a run.` : p.error
              })()}
            </p>
          </div>
          <div>
            <Label>Work date</Label>
            <p className="text-sm text-muted">Today or yesterday. Growtrail rejects other dates. Pick it in the header.</p>
          </div>
        </Section>

        <Section
          title="Browser"
          hint="Chrome-based browsers block automation of your everyday profile, so the app opens your browser with its own profile. Sign in to Growtrail there once; it is remembered."
        >
          <div>
            <Label htmlFor="mode">Connection</Label>
            <Select
              id="mode"
              value={form.connectionMode}
              options={['launch', 'attach']}
              format={(v) => (v === 'launch' ? 'Launch browser with app profile (recommended)' : 'Attach to a browser I started myself')}
              onChange={(v) => set('connectionMode', v as Settings['connectionMode'])}
            />
          </div>
          <div>
            <Label htmlFor="port">Debugging port (localhost only)</Label>
            <input
              id="port"
              className="field font-mono"
              inputMode="numeric"
              value={form.cdpPort}
              onChange={(e) => set('cdpPort', Number(e.target.value.replace(/\D/g, '')) || 0)}
            />
          </div>
          <div className="col-span-2">
            <Label htmlFor="exe">Browser program</Label>
            <Select
              id="exe"
              value={form.browserExecutable}
              options={detected}
              placeholder={detected[0] ? `Auto-detect (${detected[0]})` : 'No supported browser found'}
              onChange={(v) => set('browserExecutable', v)}
            />
            {form.connectionMode === 'attach' && (
              <p className="mt-2 rounded-md bg-canvas p-2 font-mono text-xs">
                {(form.browserExecutable || detected[0] || 'google-chrome') +
                  ` --remote-debugging-port=${form.cdpPort} --user-data-dir=$HOME/.growtrail-logger-profile`}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="base">Growtrail address</Label>
            <input id="base" className="field" value={form.growtrailBaseUrl} onChange={(e) => set('growtrailBaseUrl', e.target.value)} />
          </div>
          <div>
            <Label htmlFor="route">My Task route</Label>
            <input id="route" className="field" value={form.taskListPath} onChange={(e) => set('taskListPath', e.target.value)} />
          </div>
        </Section>
      </div>

      {confirmReset && (
        <Modal
          title="Reset all settings?"
          actions={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmReset(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger" onClick={() => void reset()}>
                Reset
              </button>
            </>
          }
        >
          <p>People, defaults, target and browser settings go back to their defaults. The project and employee lists are kept.</p>
        </Modal>
      )}
    </div>
  )
}
