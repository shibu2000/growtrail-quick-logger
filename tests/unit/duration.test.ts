import { describe, expect, it } from 'vitest'
import { formatDuration, parseDuration, sumDurations, toGrowtrailHours } from '@shared/duration'

const ok = (raw: string) => {
  const r = parseDuration(raw)
  if (!r.ok) throw new Error(`expected ok for "${raw}": ${r.error}`)
  return r.hundredths
}
const err = (raw: string) => {
  const r = parseDuration(raw)
  if (r.ok) throw new Error(`expected error for "${raw}"`)
  return r.error
}

describe('parseDuration', () => {
  it('parses decimal hours', () => {
    expect(ok('1')).toBe(100)
    expect(ok('1.5')).toBe(150)
    expect(ok('0.25')).toBe(25)
    expect(ok('.5')).toBe(50)
    expect(ok(' 9 ')).toBe(900)
    expect(ok('1.05')).toBe(105)
  })

  it('parses h:mm and h/m forms that map to whole hundredths', () => {
    expect(ok('1:30')).toBe(150)
    expect(ok('0:15')).toBe(25)
    expect(ok('1h 30m')).toBe(150)
    expect(ok('2h')).toBe(200)
    expect(ok('45m')).toBe(75)
    expect(ok('1H30M')).toBe(150)
  })

  it('rejects minutes that Growtrail cannot represent with 2 decimals', () => {
    expect(err('1:20')).toMatch(/2 decimals/)
    expect(err('10m')).toMatch(/2 decimals/)
  })

  it('rejects more than 2 decimals, zero, negatives, garbage and >24h', () => {
    expect(err('1.333')).toMatch(/2 decimals/)
    expect(err('0')).toMatch(/greater than zero/)
    expect(err('-1')).toBeTruthy()
    expect(err('abc')).toBeTruthy()
    expect(err('')).toMatch(/Enter/)
    expect(err('25')).toMatch(/24/)
  })
})

describe('toGrowtrailHours', () => {
  it('formats with two decimals as Growtrail stores them', () => {
    expect(toGrowtrailHours(25)).toBe('0.25')
    expect(toGrowtrailHours(900)).toBe('9.00')
    expect(toGrowtrailHours(150)).toBe('1.50')
  })
  it('refuses invalid values', () => {
    expect(() => toGrowtrailHours(0)).toThrow()
    expect(() => toGrowtrailHours(1.5)).toThrow()
  })
})

describe('formatDuration', () => {
  it('shows hours and minutes when exact', () => {
    expect(formatDuration(150)).toBe('1h 30m')
    expect(formatDuration(900)).toBe('9h')
    expect(formatDuration(25)).toBe('15m')
  })
  it('falls back to decimal hours otherwise', () => {
    expect(formatDuration(133)).toBe('1.33 h')
  })
})

describe('daily totals', () => {
  it('sums without floating-point drift', () => {
    expect(sumDurations([33, 33, 33, 1])).toBe(100)
    expect(sumDurations([100, 100, 500, 200])).toBe(900)
  })
})
