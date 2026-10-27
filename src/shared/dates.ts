export function toIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayIso(now = new Date()): string {
  return toIsoDate(now)
}

export function yesterdayIso(now = new Date()): string {
  const d = new Date(now)
  d.setDate(d.getDate() - 1)
  return toIsoDate(d)
}

export function allowedWorkDates(now = new Date()): string[] {
  return [todayIso(now), yesterdayIso(now)]
}

export function isAllowedWorkDate(date: string, now = new Date()): boolean {
  return allowedWorkDates(now).includes(date)
}

export function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}
