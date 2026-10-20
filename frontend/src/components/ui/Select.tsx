import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown } from 'lucide-react'

export interface SelectOption<V extends string | number> {
  value: V
  label: string
  /** Small grey line under the label */
  hint?: string
  /** Colour dot before the label (e.g. a studio colour) */
  dot?: string
}

interface Props<V extends string | number> {
  value: V
  onChange: (value: V) => void
  options: SelectOption<V>[]
  className?: string
  size?: 'md' | 'sm'
  ariaLabel?: string
}

/**
 * Branded dropdown replacing the browser's <select>. The list renders in a portal
 * with fixed positioning, so it isn't clipped inside scrolling modals, and opens
 * upward when there's no room below. Keyboard: ↑ ↓ Enter Esc.
 */
export default function Select<V extends string | number>({ value, onChange, options, className = '', size = 'md', ariaLabel }: Props<V>) {
  const [open, setOpen]     = useState(false)
  const [active, setActive] = useState(0)
  const [pos, setPos]       = useState<{ left: number; width: number; top?: number; bottom?: number }>({ left: 0, width: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef    = useRef<HTMLDivElement>(null)

  const current = options.find((o) => o.value === value)

  const place = () => {
    const r = triggerRef.current?.getBoundingClientRect()
    if (!r) return
    const listH = Math.min(options.length * 44 + 12, 280)
    const below = window.innerHeight - r.bottom
    setPos(below < listH + 12 && r.top > below
      ? { left: r.left, width: r.width, bottom: window.innerHeight - r.top + 6 }
      : { left: r.left, width: r.width, top: r.bottom + 6 })
  }

  useLayoutEffect(() => { if (open) place() }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return
    setActive(Math.max(0, options.findIndex((o) => o.value === value)))
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node
      if (!triggerRef.current?.contains(t) && !listRef.current?.contains(t)) setOpen(false)
    }
    const onMove = () => place()
    const onEsc  = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onEsc)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    window.addEventListener('resize', onMove)
    window.addEventListener('scroll', onMove, true) // any scrolling ancestor
    return () => {
      document.removeEventListener('keydown', onEsc)
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      window.removeEventListener('resize', onMove)
      window.removeEventListener('scroll', onMove, true)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const choose = (v: V) => { onChange(v); setOpen(false); triggerRef.current?.focus() }

  const onKey = (e: React.KeyboardEvent) => {
    if (!open && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); setOpen(true); return }
    if (!open) return
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false) }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(options.length - 1, a + 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)) }
    if (e.key === 'Enter') { e.preventDefault(); choose(options[active].value) }
  }

  const sm = size === 'sm'

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef} type="button" onClick={() => setOpen((o) => !o)} onKeyDown={onKey}
        aria-haspopup="listbox" aria-expanded={open} aria-label={ariaLabel}
        className={`w-full flex items-center gap-2 border-2 border-ink bg-white text-ink font-extrabold text-left shadow-cartoon-sm transition-all duration-100
          hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-cartoon
          ${open ? 'ring-2 ring-brand-500/30' : ''}
          ${sm ? 'px-2.5 py-1.5 rounded-xl text-xs' : 'px-3.5 py-2.5 rounded-2xl text-sm'}`}
      >
        {current?.dot && <span className="w-2.5 h-2.5 rounded-full border-2 border-ink shrink-0" style={{ background: current.dot }} />}
        <span className="flex-1 truncate">{current?.label ?? 'Pilih…'}</span>
        <ChevronDown className={`shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''} ${sm ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} strokeWidth={3} />
      </button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={listRef} role="listbox"
              initial={{ opacity: 0, y: pos.bottom !== undefined ? 6 : -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.13 }}
              className="fixed z-[100] bg-white rounded-2xl border-2 border-ink shadow-cartoon-lg p-1.5 overflow-y-auto"
              style={{ left: pos.left, top: pos.top, bottom: pos.bottom, minWidth: Math.max(pos.width, 160), maxHeight: 280 }}
            >
              {options.map((o, i) => {
                const sel = o.value === value
                return (
                  <button
                    key={String(o.value)} type="button" role="option" aria-selected={sel}
                    onMouseEnter={() => setActive(i)} onClick={() => choose(o.value)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-sm font-extrabold transition-colors
                      ${sel ? 'bg-brand-500 text-white' : i === active ? 'bg-surface-subtle text-ink' : 'text-ink'}`}
                  >
                    {o.dot && <span className="w-2.5 h-2.5 rounded-full border-2 border-ink shrink-0" style={{ background: o.dot }} />}
                    <span className="flex-1 min-w-0">
                      <span className="block truncate">{o.label}</span>
                      {o.hint && <span className={`block text-[11px] font-semibold ${sel ? 'text-white/70' : 'text-gray-400'}`}>{o.hint}</span>}
                    </span>
                    {sel && <Check className="w-4 h-4 shrink-0" strokeWidth={3} />}
                  </button>
                )
              })}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}
