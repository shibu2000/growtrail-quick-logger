export const MAX_HUNDREDTHS_PER_ENTRY = 2400

export type ParseResult = { ok: true; hundredths: number } | { ok: false; error: string }

export function parseDuration(raw: string): ParseResult {
  const input = raw.trim().toLowerCase()
  if (input === '') return { ok: false, error: 'Enter the time spent' }

  let hundredths: number | null = null

  const decimal = /^(\d+)?(?:\.(\d{1,2}))?$/.exec(input)
  if (decimal && (decimal[1] !== undefined || decimal[2] !== undefined)) {
    const whole = Number(decimal[1] ?? '0')
    const frac = Number((decimal[2] ?? '0').padEnd(2, '0'))
    hundredths = whole * 100 + frac
  } else if (/^\d+\.\d{3,}$/.test(input)) {
    return { ok: false, error: 'Growtrail accepts at most 2 decimals (e.g. 1.25)' }
  } else {
    const hm = /^(\d+):([0-5]\d)$/.exec(input) ?? /^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?$/.exec(input)
    if (!hm || (hm[1] === undefined && hm[2] === undefined)) {
      return { ok: false, error: 'Use hours like 1.5, 1:30 or 1h 30m' }
    }
    const minutes = Number(hm[1] ?? '0') * 60 + Number(hm[2] ?? '0')
    if ((minutes * 100) % 60 !== 0) {
      return {
        ok: false,
        error: `${minutes} min is ${(minutes / 60).toFixed(4).replace(/0+$/, '')} h; Growtrail needs 2 decimals. Enter decimal hours instead`,
      }
    }
    hundredths = (minutes * 100) / 60
  }

  if (hundredths <= 0) return { ok: false, error: 'Time must be greater than zero' }
  if (hundredths > MAX_HUNDREDTHS_PER_ENTRY) return { ok: false, error: 'Time cannot exceed 24 hours' }
  return { ok: true, hundredths }
}

export function toGrowtrailHours(hundredths: number): string {
  if (!Number.isInteger(hundredths) || hundredths <= 0) throw new Error(`Invalid duration: ${hundredths}`)
  return (hundredths / 100).toFixed(2)
}

export function formatDuration(hundredths: number): string {
  const minutes = (hundredths * 60) / 100
  if (!Number.isInteger(minutes)) return `${(hundredths / 100).toFixed(2)} h`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export function sumDurations(values: number[]): number {
  return values.reduce((a, b) => a + b, 0)
}
