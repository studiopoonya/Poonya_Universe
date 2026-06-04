import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  format, addDays, startOfDay, isSameDay,
  startOfMonth, endOfMonth, addMonths, subMonths, isBefore,
} from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { useAvailableSlots } from '@/hooks/useAvailableSlots'
import PrimaryButton from '@/components/ui/PrimaryButton'
import SkeletonCard from '@/components/ui/SkeletonCard'
import type { Slot } from '@/types'

interface Props {
  studioId: number
  onNext: (data: { slot_id: number; date: string }) => void
  onBack: () => void
  initialSlotId?: number
}

const today = startOfDay(new Date())

export default function DateTimeStep({ studioId, onNext, onBack, initialSlotId }: Props) {
  const [viewMonth, setViewMonth] = useState<Date>(startOfMonth(today))
  const [date, setDate]           = useState<Date>(today)
  const [slotId, setSlot]         = useState<number | null>(initialSlotId ?? null)

  const dateStr = format(date, 'yyyy-MM-dd')
  const { data: slots = [], isLoading } = useAvailableSlots(studioId, dateStr)

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
      <h2 className="text-2xl font-extrabold text-ink mb-1">Pilih Tanggal & Waktu 📅</h2>
      <p className="text-sm text-gray-400 font-semibold mb-5">Setiap sesi adalah booth pribadi untukmu.</p>

      {/* Month navigator */}
      <div className="flex items-center justify-between mb-3 bg-white border-2 border-ink rounded-2xl px-3 py-2 shadow-cartoon-sm">
        <button
          disabled={prevDisabled}
          onClick={() => { setViewMonth((m) => subMonths(m, 1)); setSlot(null) }}
          className="w-8 h-8 rounded-xl border-2 border-ink flex items-center justify-center text-ink font-extrabold text-lg shadow-cartoon-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-cartoon disabled:opacity-25 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0 transition-all duration-100 bg-white"
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
          className="w-8 h-8 rounded-xl border-2 border-ink flex items-center justify-center text-ink font-extrabold text-lg shadow-cartoon-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-cartoon transition-all duration-100 bg-white"
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

      {/* Time slots */}
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
                <div className="col-span-4 text-center py-8 bg-white rounded-2xl border-2 border-ink shadow-cartoon-sm">
                  <p className="text-sm font-bold text-gray-400">😴 Tidak ada slot tersedia.</p>
                </div>
              )
              : slots.map((s: Slot) => (
                <button
                  key={s.id}
                  disabled={!s.is_available}
                  onClick={() => setSlot(s.id)}
                  className={`
                    py-2.5 rounded-xl text-sm font-extrabold transition-all duration-100 border-2
                    ${!s.is_available
                      ? 'bg-gray-50 text-gray-300 cursor-not-allowed line-through border-gray-200'
                      : slotId === s.id
                        ? 'bg-brand-500 text-white border-ink shadow-cartoon-sm -translate-x-0.5 -translate-y-0.5'
                        : 'bg-white text-ink border-ink shadow-cartoon-sm hover:shadow-cartoon hover:-translate-x-0.5 hover:-translate-y-0.5'}
                  `}
                >
                  {s.start_time.slice(0, 5)}
                </button>
              ))
          }
        </motion.div>
      </AnimatePresence>

      <div className="flex gap-3 mt-8">
        <PrimaryButton variant="ghost" onClick={onBack} className="w-auto px-5">
          ← Kembali
        </PrimaryButton>
        <PrimaryButton
          disabled={!slotId}
          onClick={() => slotId && onNext({ slot_id: slotId, date: dateStr })}
        >
          Lanjut →
        </PrimaryButton>
      </div>
    </div>
  )
}
