import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  addDays, addMonths, addYears, endOfMonth, endOfWeek, format, isAfter, isBefore, isSameDay,
  isSameMonth, parseISO, startOfDay, startOfMonth, startOfWeek, subMonths, subYears,
} from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'

const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
const POPOVER_W = 300

/**
 * Open/close, outside-click/Esc, and placement. The panel renders in a portal with
 * fixed positioning so scrolling modals/cards can't clip it; it stays inside the
 * viewport horizontally and opens upward when there's no room below.
 */
function usePopover(width: number, height: number) {
  const [open, setOpen] = useState(false)
  const [style, setStyle] = useState<React.CSSProperties>({})
  const ref = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const place = () => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    const left  = Math.max(8, Math.min(r.left, window.innerWidth - width - 8))
    const below = window.innerHeight - r.bottom
    setStyle(below < height + 12 && r.top > below
      ? { left, width, bottom: window.innerHeight - r.top + 8 }
      : { left, width, top: r.bottom + 8 })
  }

  useLayoutEffect(() => { if (open) place() }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node
      if (!ref.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true) // any scrolling ancestor, e.g. a modal
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  return { open, setOpen, ref, panelRef, style }
}

const triggerCls =
  'w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl border-2 border-ink bg-white text-sm font-extrabold text-ink shadow-cartoon-sm text-left hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-cartoon transition-all duration-100'

const panelCls = 'fixed z-[100] bg-white rounded-3xl border-2 border-ink shadow-cartoon-lg p-4'

const navBtn =
  'w-8 h-8 rounded-xl border-2 border-ink bg-white grid place-items-center shadow-cartoon-sm hover:-translate-y-0.5 transition-all disabled:opacity-25 disabled:shadow-none disabled:translate-y-0'

interface DatePickerProps {
  /** yyyy-MM-dd, or '' for none */
  value: string
  onChange: (value: string) => void
  /** Earliest selectable day (yyyy-MM-dd) */
  min?: string
  placeholder?: string
  /** Show a × to clear (for optional dates like filters) */
  clearable?: boolean
  className?: string
}

/** Branded calendar popover replacing the browser's date input. Monday-first, Indonesian. */
export default function DatePicker({ value, onChange, min, placeholder = 'Pilih tanggal', clearable, className = '' }: DatePickerProps) {
  const { open, setOpen, ref, panelRef, style } = usePopover(POPOVER_W, 400)
  const selected = value ? parseISO(value) : null
  const minDate  = min ? startOfDay(parseISO(min)) : null
  const today    = startOfDay(new Date())
  const [view, setView]   = useState<Date>(startOfMonth(selected ?? today))
  const [pickMonth, setPickMonth] = useState(false)

  // Re-centre on the selected month whenever the popover opens
  useEffect(() => {
    if (open) { setView(startOfMonth(selected ?? today)); setPickMonth(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const days: Date[] = []
  for (let d = startOfWeek(startOfMonth(view), { weekStartsOn: 1 }); !isAfter(d, endOfWeek(endOfMonth(view), { weekStartsOn: 1 })); d = addDays(d, 1)) {
    days.push(d)
  }
  const disabled = (d: Date) => !!minDate && isBefore(d, minDate)
  const pick = (d: Date) => { onChange(format(d, 'yyyy-MM-dd')); setOpen(false) }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} className={triggerCls} aria-haspopup="dialog" aria-expanded={open}>
        <CalendarDays className="w-4 h-4 shrink-0 text-brand-500" strokeWidth={2.5} />
        <span className={`flex-1 truncate ${selected ? '' : 'text-gray-300'}`}>
          {selected ? format(selected, 'EEE, d MMM yyyy', { locale: idLocale }) : placeholder}
        </span>
        {clearable && selected && (
          <span
            role="button" aria-label="Hapus tanggal"
            onClick={(e) => { e.stopPropagation(); onChange('') }}
            className="w-5 h-5 rounded-full grid place-items-center text-gray-400 hover:bg-surface-subtle hover:text-ink"
          >
            <X className="w-3.5 h-3.5" strokeWidth={3} />
          </span>
        )}
      </button>

      {createPortal(<AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef} role="dialog" aria-label="Pilih tanggal"
            initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className={panelCls}
            style={style}
          >
            {/* header: month nav; tap the label to jump months */}
            <div className="flex items-center justify-between mb-3">
              <button type="button" aria-label="Bulan sebelumnya" className={navBtn}
                onClick={() => setView((v) => (pickMonth ? subYears(v, 1) : subMonths(v, 1)))}
                disabled={!pickMonth && !!minDate && !isAfter(startOfMonth(view), minDate)}>
                <ChevronLeft className="w-4 h-4" strokeWidth={3} />
              </button>
              <button type="button" onClick={() => setPickMonth((p) => !p)}
                className="px-3 py-1 rounded-xl text-sm font-extrabold text-ink capitalize hover:bg-surface-subtle">
                {pickMonth ? format(view, 'yyyy') : format(view, 'MMMM yyyy', { locale: idLocale })}
              </button>
              <button type="button" aria-label="Bulan berikutnya" className={navBtn}
                onClick={() => setView((v) => (pickMonth ? addYears(v, 1) : addMonths(v, 1)))}>
                <ChevronRight className="w-4 h-4" strokeWidth={3} />
              </button>
            </div>

            {pickMonth ? (
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 12 }, (_, m) => new Date(view.getFullYear(), m, 1)).map((m) => {
                  const off = !!minDate && isBefore(endOfMonth(m), minDate)
                  const cur = isSameMonth(m, view)
                  return (
                    <button key={m.getMonth()} type="button" disabled={off}
                      onClick={() => { setView(m); setPickMonth(false) }}
                      className={`py-2.5 rounded-xl border-2 text-xs font-extrabold capitalize transition-all disabled:opacity-25 ${
                        cur ? 'bg-brand-500 text-white border-ink shadow-cartoon-sm' : 'bg-white text-ink border-transparent hover:border-ink'}`}>
                      {format(m, 'MMM', { locale: idLocale })}
                    </button>
                  )
                })}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-7 mb-1">
                  {WEEKDAYS.map((d, i) => (
                    <span key={d} className={`text-center text-[10px] font-extrabold uppercase tracking-wider ${i >= 5 ? 'text-brand-500' : 'text-gray-400'}`}>{d}</span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {days.map((d) => {
                    const inMonth = isSameMonth(d, view)
                    const isSel   = !!selected && isSameDay(d, selected)
                    const isToday = isSameDay(d, today)
                    const off     = disabled(d)
                    return (
                      <button
                        key={d.toISOString()} type="button" disabled={off} onClick={() => pick(d)}
                        aria-pressed={isSel} aria-label={format(d, 'EEEE, d MMMM yyyy', { locale: idLocale })}
                        className={`h-9 rounded-xl text-sm font-extrabold border-2 transition-all duration-100 ${
                          isSel ? 'bg-brand-500 text-white border-ink shadow-cartoon-sm'
                            : off ? 'text-gray-200 border-transparent cursor-not-allowed'
                            : isToday ? 'text-brand-600 border-brand-500 bg-brand-50'
                            : inMonth ? 'text-ink border-transparent hover:border-ink hover:bg-surface-subtle'
                            : 'text-gray-300 border-transparent hover:border-gray-200'}`}
                      >
                        {format(d, 'd')}
                      </button>
                    )
                  })}
                </div>
              </>
            )}

            <div className="flex items-center justify-between mt-3 pt-3 border-t-2 border-surface-subtle">
              {clearable ? (
                <button type="button" onClick={() => { onChange(''); setOpen(false) }} className="text-xs font-extrabold text-gray-400 hover:text-ink">Hapus</button>
              ) : <span />}
              <button type="button" disabled={!!minDate && isBefore(today, minDate)} onClick={() => pick(today)}
                className="text-xs font-extrabold text-brand-500 hover:text-brand-700 disabled:opacity-30">Hari ini</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>, document.body)}
    </div>
  )
}

interface MonthPickerProps {
  /** yyyy-MM */
  value: string
  onChange: (value: string) => void
  /** Latest selectable month (yyyy-MM) */
  max?: string
  className?: string
}

/** Same look, for choosing a month (dashboard reports). */
export function MonthPicker({ value, onChange, max, className = '' }: MonthPickerProps) {
  const { open, setOpen, ref, panelRef, style } = usePopover(260, 220)
  const selected = parseISO(`${value}-01`)
  const maxDate  = max ? parseISO(`${max}-01`) : null
  const [year, setYear] = useState(selected.getFullYear())

  useEffect(() => { if (open) setYear(selected.getFullYear()) }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} className={triggerCls} aria-haspopup="dialog" aria-expanded={open}>
        <CalendarDays className="w-4 h-4 shrink-0 text-brand-500" strokeWidth={2.5} />
        <span className="flex-1 capitalize">{format(selected, 'MMMM yyyy', { locale: idLocale })}</span>
      </button>
      {createPortal(<AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef} role="dialog" aria-label="Pilih bulan"
            initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className={panelCls} style={style}
          >
            <div className="flex items-center justify-between mb-3">
              <button type="button" aria-label="Tahun sebelumnya" className={navBtn} onClick={() => setYear((y) => y - 1)}>
                <ChevronLeft className="w-4 h-4" strokeWidth={3} />
              </button>
              <span className="text-sm font-extrabold text-ink">{year}</span>
              <button type="button" aria-label="Tahun berikutnya" className={navBtn} onClick={() => setYear((y) => y + 1)}
                disabled={!!maxDate && year >= maxDate.getFullYear()}>
                <ChevronRight className="w-4 h-4" strokeWidth={3} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 12 }, (_, m) => new Date(year, m, 1)).map((m) => {
                const off = !!maxDate && isAfter(m, maxDate)
                const cur = isSameMonth(m, selected)
                return (
                  <button key={m.getMonth()} type="button" disabled={off}
                    onClick={() => { onChange(format(m, 'yyyy-MM')); setOpen(false) }}
                    className={`py-2.5 rounded-xl border-2 text-xs font-extrabold capitalize transition-all disabled:opacity-25 ${
                      cur ? 'bg-brand-500 text-white border-ink shadow-cartoon-sm' : 'bg-white text-ink border-transparent hover:border-ink'}`}>
                    {format(m, 'MMM', { locale: idLocale })}
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>, document.body)}
    </div>
  )
}
