import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label className="label" htmlFor={htmlFor}>
      {children}
    </label>
  )
}

interface SelectProps {
  id?: string
  value: string
  options: readonly string[]
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  format?: (value: string) => string
}

const POPUP_HEIGHT = 290

export function Select({ id, value, options, onChange, placeholder, disabled, invalid, format }: SelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [dropUp, setDropUp] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const label = (o: string) => (format ? format(o) : o)

  const base = value !== '' && !options.includes(value) ? [value, ...options] : [...options]
  const all = placeholder !== undefined ? ['', ...base.filter((o) => o !== '')] : base
  const q = query.trim().toLowerCase()
  const shown = q ? all.filter((o) => o !== '' && label(o).toLowerCase().includes(q)) : all

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  useEffect(() => {
    if (open) listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  const openList = () => {
    const rect = button.current?.getBoundingClientRect()
    if (rect) {
      const below = window.innerHeight - rect.bottom
      setDropUp(below < POPUP_HEIGHT && rect.top > below)
    }
    setQuery('')
    setActive(Math.max(0, all.indexOf(value)))
    setOpen(true)
  }
  const close = () => {
    setOpen(false)
    button.current?.focus()
  }
  const pick = (o: string) => {
    onChange(o)
    close()
  }

  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(shown.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (shown[active] !== undefined) pick(shown[active])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      close()
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div ref={root} className="relative">
      <button
        id={id}
        ref={button}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`field flex items-center justify-between gap-2 text-left ${invalid ? 'field-invalid' : ''}`}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={(e) => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            openList()
          }
        }}
      >
        <span className={`truncate ${value === '' && placeholder !== undefined ? 'text-muted' : ''}`}>
          {value === '' && placeholder !== undefined ? placeholder : label(value)}
        </span>
        <span aria-hidden className="text-[10px] text-muted">▼</span>
      </button>
      {open && (
        <div className={`absolute left-0 right-0 z-30 rounded-md border border-line bg-panel shadow-lg ${dropUp ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
          <input
            autoFocus
            className="w-full border-b border-line bg-transparent px-2.5 py-1.5 text-sm text-ink outline-none"
            placeholder="Search…"
            value={query}
            aria-label="Search options"
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={onSearchKey}
          />
          <ul ref={listRef} role="listbox" className="max-h-60 overflow-y-auto py-1">
            {shown.length === 0 && <li className="px-2.5 py-1.5 text-sm text-muted">No matches</li>}
            {shown.map((o, i) => (
              <li
                key={o || '__empty'}
                role="option"
                aria-selected={o === value}
                className={`cursor-pointer px-2.5 py-1.5 text-sm ${i === active ? 'bg-brand-soft text-brand' : ''} ${o === value ? 'font-semibold' : ''} ${o === '' && placeholder !== undefined ? 'text-muted' : ''}`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(o)}
              >
                {o === '' && placeholder !== undefined ? placeholder : label(o)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function Banner({ tone, children }: { tone: 'warn' | 'bad' | 'ok' | 'info'; children: ReactNode }) {
  const styles = {
    warn: 'border-warn/30 bg-warn-soft text-warn',
    bad: 'border-bad/30 bg-bad-soft text-bad',
    ok: 'border-ok/30 bg-ok-soft text-ok',
    info: 'border-brand/20 bg-brand-soft text-brand',
  }[tone]
  return <div className={`rounded-md border px-3 py-2 text-sm ${styles}`}>{children}</div>
}

export function Modal({
  title,
  children,
  actions,
}: {
  title: string
  children: ReactNode
  actions: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-6" role="dialog" aria-modal="true">
      <div className="card w-full max-w-lg shadow-xl">
        <div className="border-b border-line px-5 py-3 text-base font-semibold">{title}</div>
        <div className="space-y-3 px-5 py-4 text-sm">{children}</div>
        <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{actions}</div>
      </div>
    </div>
  )
}
