import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  format, addDays, startOfDay, isSameDay, parseISO,
  startOfMonth, endOfMonth, addMonths, subMonths, isBefore,
} from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { useAvailableSlots } from '@/hooks/useAvailableSlots'
import PrimaryButton from '@/components/ui/PrimaryButton'
import StepActions from '@/components/ui/StepActions'
import SkeletonCard from '@/components/ui/SkeletonCard'
import { SESSION_OPTIONS, runFrom, durationLabel } from '@/lib/sessions'
import type { Slot } from '@/types'

interface Props {
  studioId: number
  onNext: (data: { slot_id: number; date: string; time: string; sessions: number }) => void
  onBack: () => void
  initialSlotId?: number
  initialSessions?: number
  /** Duration can't be changed (rescheduling keeps the booked length) */
  fixedSessions?: number
  /** yyyy-MM-dd of the slot picked earlier, so going back shows that day again */
  initialDate?: string
}

const today = startOfDay(new Date())

export default function DateTimeStep({ studioId, onNext, onBack, initialSlotId, initialDate, initialSessions, fixedSessions }: Props) {
  const startDate = initialDate && !isBefore(parseISO(initialDate), today) ? parseISO(initialDate) : today
  const [viewMonth, setViewMonth] = useState<Date>(startOfMonth(startDate))
  const [date, setDate]           = useState<Date>(startDate)
  const [slotId, setSlot]         = useState<number | null>(initialSlotId ?? null)
  const [sessions, setSessions]   = useState<number>(fixedSessions ?? initialSessions ?? 1)

  const dateStr = format(date, 'yyyy-MM-dd')
  const { data: slots = [], isLoading } = useAvailableSlots(studioId, dateStr)
  // The picked start + the following sessions, only if all of them are free and back to back
  const startIdx = slots.findIndex((s: Slot) => s.id === slotId)
  const run      = startIdx >= 0 ? runFrom(slots, startIdx, sessions) : null
  const runIds   = new Set(run?.map((s) => s.id))

  const windowStart = isBefore(startOfMonth(viewMonth), today) ? today : startOfMonth(viewMonth)
  const windowEnd   = endOfMonth(viewMonth)
  const days: Date[] = []
  let cursor = windowStart
  while (!isBefore(windowEnd, cursor)) {
    days.push(cursor)
    cursor = addDays(cursor, 1)
  }

  const prevDisabled = !isBefore(today, startOfMonth(viewMonth))

  return (
    <div>
      <h2 className="text-xl md:text-2xl font-extrabold text-ink mb-1">Pilih Tanggal & Waktu 📅</h2>
      <p className="text-sm text-gray-400 font-semibold mb-5">Setiap sesi adalah booth pribadi untukmu.</p>

      {/* Month navigator */}
      <div className="flex items-center justify-between mb-3 bg-white border-2 border-ink rounded-2xl px-3 py-2 shadow-cartoon-sm">
        <button
          disabled={prevDisabled}
          onClick={() => { setViewMonth((m) => subMonths(m, 1)); setSlot(null) }}
          className="w-10 h-10 md:w-8 md:h-8 rounded-xl border-2 border-ink flex items-center justify-center text-ink font-extrabold text-lg shadow-cartoon-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-cartoon disabled:opacity-25 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0 transition-all duration-100 bg-white"
        >
          ‹
        </button>
        <motion.p
          key={viewMonth.toISOString()}
          initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          className="text-xs font-extrabold text-ink tracking-widest uppercase"
        >
          {format(viewMonth, 'MMMM yyyy', { locale: idLocale })}
        </motion.p>
        <button
          onClick={() => { setViewMonth((m) => addMonths(m, 1)); setSlot(null) }}
          className="w-10 h-10 md:w-8 md:h-8 rounded-xl border-2 border-ink flex items-center justify-center text-ink font-extrabold text-lg shadow-cartoon-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-cartoon transition-all duration-100 bg-white"
        >
          ›
        </button>
      </div>

      {/* Date carousel */}
      <AnimatePresence mode="wait">
        <motion.div
          key={viewMonth.toISOString()}
          initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }}
          className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-none -mx-1 px-1"
        >
          {days.map((d) => (
            <button
              key={d.toISOString()}
              onClick={() => { setDate(d); setSlot(null) }}
              className={`
                flex-shrink-0 flex flex-col items-center px-3 py-2.5 rounded-2xl border-2 border-ink transition-all duration-100 min-w-[52px]
                ${isSameDay(d, date)
                  ? 'bg-brand-500 text-white shadow-cartoon-sm -translate-x-0.5 -translate-y-0.5'
                  : 'bg-white text-gray-500 shadow-cartoon-sm hover:shadow-cartoon hover:-translate-x-0.5 hover:-translate-y-0.5'}
              `}
            >
              <span className="text-[9px] font-extrabold uppercase tracking-wider opacity-70">
                {format(d, 'EEE', { locale: idLocale })}
              </span>
              <span className="text-[15px] font-extrabold mt-0.5 leading-none">{format(d, 'd')}</span>
              <span className="text-[9px] mt-1 opacity-70">
                {format(d, 'MMM', { locale: idLocale })}
              </span>
            </button>
          ))}
        </motion.div>
      </AnimatePresence>

      {/* Selected date label */}
      <div className="flex items-center gap-2 mb-3">
        <div className="h-px flex-1 bg-ink/10" />
        <p className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider">
          {format(date, 'EEEE, d MMMM yyyy', { locale: idLocale })}
        </p>
        <div className="h-px flex-1 bg-ink/10" />
      </div>

      {/* Duration: several 30-minute sessions in a row */}
      {fixedSessions ? (
        <p className="text-xs font-bold text-gray-500 mb-3">Durasi: {durationLabel(fixedSessions)} (sesuai booking)</p>
      ) : (
        <div className="mb-4">
          <p className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider mb-2">Durasi</p>
          <div className="grid grid-cols-4 gap-2">
            {SESSION_OPTIONS.map((o) => (
              <button
                key={o.sessions}
                type="button"
                onClick={() => setSessions(o.sessions)}
                className={`py-2 rounded-xl border-2 border-ink text-xs font-extrabold transition-all duration-100 ${
                  sessions === o.sessions ? 'bg-ink text-white shadow-cartoon-sm' : 'bg-white text-ink hover:bg-surface-subtle'
                }`}
              >
                {o.label}
                <span className={`block text-[10px] font-bold ${sessions === o.sessions ? 'text-white/60' : 'text-gray-400'}`}>
                  {o.sessions} sesi
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Time slots (pick the start; the next sessions are highlighted) */}
      <AnimatePresence mode="wait">
        <motion.div
          key={dateStr}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.16 }}
          className="grid grid-cols-3 sm:grid-cols-4 gap-2"
        >
          {isLoading
            ? Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} className="h-11" />)
            : slots.length === 0
              ? (
                <div className="col-span-full text-center py-8 bg-white rounded-2xl border-2 border-ink shadow-cartoon-sm">
                  <p className="text-sm font-bold text-gray-400">😴 Tidak ada slot tersedia.</p>
                </div>
              )
              : slots.map((s: Slot, i: number) => {
                const canStart = !!runFrom(slots, i, sessions)
                const isStart  = run && s.id === slotId
                const inRun    = runIds.has(s.id)
                return (
                  <button
                    key={s.id}
                    disabled={!canStart && !inRun}
                    onClick={() => canStart && setSlot(s.id)}
                    title={s.is_available && !canStart ? `Tidak cukup slot kosong berurutan untuk ${durationLabel(sessions)}` : undefined}
                    className={`
                      py-3 md:py-2.5 rounded-xl text-sm font-extrabold transition-all duration-100 border-2
                      ${isStart
                        ? 'bg-brand-500 text-white border-ink shadow-cartoon-sm -translate-x-0.5 -translate-y-0.5'
                        : inRun
                          ? 'bg-brand-100 text-brand-600 border-brand-500'
                          : !s.is_available
                            ? 'bg-gray-50 text-gray-300 cursor-not-allowed line-through border-gray-200'
                            : !canStart
                              ? 'bg-white text-gray-300 cursor-not-allowed border-gray-200'
                              : 'bg-white text-ink border-ink shadow-cartoon-sm hover:shadow-cartoon hover:-translate-x-0.5 hover:-translate-y-0.5'}
                    `}
                  >
                    {s.start_time.slice(0, 5)}
                  </button>
                )
              })
          }
        </motion.div>
      </AnimatePresence>

      {run && (
        <p className="text-center text-xs font-extrabold text-brand-600 mt-4">
          {run[0].start_time.slice(0, 5)} – {run[run.length - 1].end_time.slice(0, 5)} · {durationLabel(sessions)}
        </p>
      )}

      <StepActions>
        <PrimaryButton variant="ghost" onClick={onBack} className="w-auto px-5">
          ← Kembali
        </PrimaryButton>
        <PrimaryButton
          disabled={!run}
          onClick={() => run && onNext({
            slot_id: run[0].id,
            date: dateStr,
            time: `${run[0].start_time.slice(0, 5)} – ${run[run.length - 1].end_time.slice(0, 5)}`,
            sessions,
          })}
        >
          Lanjut →
        </PrimaryButton>
      </StepActions>
    </div>
  )
}
