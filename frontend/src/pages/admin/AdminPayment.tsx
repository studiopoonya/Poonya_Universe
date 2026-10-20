import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { format, addDays, startOfDay, isBefore, startOfMonth, endOfMonth } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import toast from 'react-hot-toast'
import api from '@/lib/axios'
import { openSnap } from '@/lib/snap'
import { formatIDR } from '@/lib/utils'
import type { Studio, Slot, Quote } from '@/types'
import { SESSION_OPTIONS, runFrom, durationLabel } from '@/lib/sessions'

// ─── types ────────────────────────────────────────────────────────────────────

interface BookingResult {
  booking_id: number
  order_id: string
  status?: string
  expires_at?: string
  payment_token?: string
}

// ─── step indicator ───────────────────────────────────────────────────────────

const STEPS = ['Studio & Waktu', 'Info Pelanggan', 'Pembayaran']

function Steps({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`flex items-center gap-2 ${i <= current ? 'opacity-100' : 'opacity-40'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              i < current ? 'bg-brand-500 text-white' :
              i === current ? 'bg-brand-500 text-white ring-4 ring-brand-100' :
              'bg-gray-200 text-gray-500'
            }`}>
              {i < current ? '✓' : i + 1}
            </div>
            <span className="text-xs font-semibold text-gray-600 hidden sm:block">{label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`h-px w-6 sm:w-12 transition-colors ${i < current ? 'bg-brand-500' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── step 1: studio + date + slot ─────────────────────────────────────────────

const today = startOfDay(new Date())

function StepSchedule({ onNext }: { onNext: (d: { studio_id: number; slot_id: number; date: string; sessions: number }) => void }) {
  const { data: studios = [] } = useQuery<Studio[]>({
    queryKey: ['studios'],
    queryFn: () => api.get('/studios').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const [studioId, setStudioId] = useState<number | null>(null)
  const [date, setDate]         = useState<Date>(today)
  const [slotId, setSlot]       = useState<number | null>(null)
  const [sessions, setSessions] = useState(1)

  const dateStr        = format(date, 'yyyy-MM-dd')
  const selectedStudio = studios.find((s) => s.id === studioId)

  const { data: slots = [], isLoading: slotsLoading } = useQuery<Slot[]>({
    queryKey: ['slots', studioId, dateStr],
    queryFn: () => api.get('/slots/available', { params: { studio_id: studioId, date: dateStr } }).then((r) => r.data),
    enabled: !!studioId,
  })

  const days: Date[] = Array.from({ length: 14 }, (_, i) => addDays(today, i))
  const startIdx = slots.findIndex((s) => s.id === slotId)
  const run      = startIdx >= 0 ? runFrom(slots, startIdx, sessions) : null
  const canNext  = !!studioId && !!run

  return (
    <div className="space-y-6">
      {/* Studio picker — horizontal scroll cards */}
      <div>
        <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-3 text-center">
          Pilih Studio
        </label>
        <div className="flex flex-wrap justify-center gap-4 pt-3 pb-4">
          {studios.map((s) => {
            const selected = studioId === s.id
            return (
              <motion.button
                key={s.id}
                whileHover={{ y: -6 }}
                onClick={() => { setStudioId(s.id); setSlot(null) }}
                className={`relative shrink-0 w-56 rounded-3xl border-2 border-ink overflow-hidden text-left transition-all duration-100 ${
                  selected
                    ? 'shadow-cartoon-lg -translate-y-1.5'
                    : 'shadow-cartoon bg-white'
                }`}
              >
                {/* image */}
                <div className="h-48 w-full relative overflow-hidden">
                  {s.thumbnail_url ? (
                    <img src={s.thumbnail_url} alt={s.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"
                      style={{ background: `linear-gradient(135deg, ${s.color}55 0%, ${s.color} 100%)` }}>
                      <span className="text-white font-extrabold text-6xl opacity-50 select-none">{s.name.charAt(0)}</span>
                    </div>
                  )}

                  {/* selected checkmark */}
                  {selected && (
                    <div className="absolute inset-0 bg-ink/20 flex items-start justify-end p-2.5">
                      <motion.div
                        initial={{ scale: 0 }} animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                        className="w-8 h-8 rounded-full bg-white border-2 border-ink shadow-cartoon-sm flex items-center justify-center"
                      >
                        <svg className="w-4 h-4 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </motion.div>
                    </div>
                  )}

                  {/* color bar */}
                  <div className="absolute bottom-0 left-0 right-0 h-2" style={{ background: s.color }} />
                </div>

                {/* info */}
                <div className={`p-4 transition-colors ${selected ? 'bg-brand-50' : 'bg-white'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-3 h-3 rounded-full border-2 border-ink shrink-0" style={{ background: s.color }} />
                    <p className="font-extrabold text-ink text-sm leading-tight line-clamp-1">{s.name}</p>
                  </div>
                  <p className="text-xs font-semibold text-gray-400 line-clamp-2 leading-relaxed mb-3">{s.description}</p>

                  {/* features */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {s.features?.slice(0, 2).map((f, i) => (
                      <span key={i} className="text-[9px] font-extrabold px-2 py-0.5 rounded-full border-2"
                        style={{ background: s.color + '20', color: s.color, borderColor: s.color }}>
                        {f}
                      </span>
                    ))}
                  </div>

                  <div className="border-t-2 border-ink/10 pt-3 flex items-end justify-between">
                    <div>
                      <p className="text-lg font-extrabold text-ink">{formatIDR(s.price)}</p>
                      <p className="text-[10px] font-bold text-gray-400">per sesi</p>
                    </div>
                    <span className="text-[10px] font-extrabold text-gray-500 bg-surface-subtle border-2 border-ink rounded-xl px-2.5 py-1 shadow-cartoon-sm">
                      Max {s.capacity}
                    </span>
                  </div>
                </div>
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* Date picker */}
      {studioId && (
        <div>
          <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-2">
            Pilih Tanggal
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {days.map((d) => {
              const isSelected = format(d, 'yyyy-MM-dd') === dateStr
              return (
                <button
                  key={d.toISOString()}
                  onClick={() => { setDate(d); setSlot(null) }}
                  className={`flex-shrink-0 flex flex-col items-center px-3 py-2.5 rounded-2xl border-2 border-ink transition-all duration-100 min-w-[52px] ${
                    isSelected
                      ? 'text-white shadow-cartoon-sm -translate-x-0.5 -translate-y-0.5'
                      : 'bg-white text-gray-500 shadow-cartoon-sm hover:shadow-cartoon hover:-translate-x-0.5 hover:-translate-y-0.5'
                  }`}
                  style={isSelected ? { background: selectedStudio?.color } : undefined}
                >
                  <span className="text-[9px] font-extrabold uppercase tracking-wider opacity-70">{format(d, 'EEE', { locale: idLocale })}</span>
                  <span className="text-sm font-extrabold mt-0.5">{format(d, 'd')}</span>
                  <span className="text-[9px] mt-0.5 opacity-70">{format(d, 'MMM', { locale: idLocale })}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Slots */}
      {studioId && (
        <div>
          <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-2">Durasi</label>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {SESSION_OPTIONS.map((o) => (
              <button
                key={o.sessions} type="button" onClick={() => setSessions(o.sessions)}
                className={`py-2 rounded-xl border-2 border-ink text-xs font-extrabold ${sessions === o.sessions ? 'bg-ink text-white' : 'bg-white text-ink'}`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-2">
            Jam Mulai — {format(date, 'EEEE, d MMMM', { locale: idLocale })}
          </label>
          {slotsLoading ? (
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-11 rounded-xl bg-surface-subtle animate-pulse border-2 border-ink" />)}
            </div>
          ) : slots.length === 0 ? (
            <div className="text-center py-8 bg-white rounded-2xl border-2 border-ink shadow-cartoon-sm">
              <p className="text-sm font-bold text-gray-400">😴 Tidak ada slot tersedia.</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {slots.map((s, i) => {
                const canStart = !!runFrom(slots, i, sessions)
                const isStart  = !!run && s.id === slotId
                const inRun    = !!run?.some((r) => r.id === s.id)
                return (
                  <button
                    key={s.id}
                    disabled={!canStart && !inRun}
                    onClick={() => canStart && setSlot(s.id)}
                    className={`py-2.5 rounded-xl text-xs font-extrabold border-2 transition-all duration-100 ${
                      isStart
                        ? 'text-white border-ink shadow-cartoon-sm -translate-x-0.5 -translate-y-0.5'
                        : inRun
                          ? 'bg-brand-100 text-brand-600 border-brand-500'
                          : !s.is_available
                            ? 'bg-gray-50 text-gray-300 line-through border-gray-200 cursor-not-allowed'
                            : !canStart
                              ? 'bg-white text-gray-300 border-gray-200 cursor-not-allowed'
                              : 'bg-white text-ink border-ink shadow-cartoon-sm hover:shadow-cartoon hover:-translate-x-0.5 hover:-translate-y-0.5'
                    }`}
                    style={isStart ? { background: selectedStudio?.color } : undefined}
                  >
                    {s.start_time.slice(0, 5)}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-center pt-2">
        <button
          disabled={!canNext}
          onClick={() => canNext && onNext({ studio_id: studioId!, slot_id: run![0].id, date: dateStr, sessions })}
          className="px-10 py-3 bg-brand-500 text-white text-sm font-extrabold rounded-2xl border-2 border-ink shadow-cartoon hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-cartoon-lg disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all duration-100"
        >
          Lanjut →
        </button>
      </div>
    </div>
  )
}

// ─── step 2: customer info ────────────────────────────────────────────────────

interface CustomerInfo {
  customer_name: string
  customer_email: string
  customer_phone: string
  notes: string
}

function StepCustomer({
  initial, onNext, onBack,
}: {
  initial: CustomerInfo
  onNext: (d: CustomerInfo) => void
  onBack: () => void
}) {
  const [form, setForm] = useState<CustomerInfo>(initial)
  const set = (k: keyof CustomerInfo, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const inputClass =
    'w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all'

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onNext(form) }}
      className="space-y-4"
    >
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Nama Lengkap</label>
        <input required value={form.customer_name} onChange={(e) => set('customer_name', e.target.value)}
          placeholder="Nama pelanggan" className={inputClass} />
      </div>
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Email</label>
        <input required type="email" value={form.customer_email} onChange={(e) => set('customer_email', e.target.value)}
          placeholder="email@contoh.com" className={inputClass} />
      </div>
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">No. HP</label>
        <input required value={form.customer_phone} onChange={(e) => set('customer_phone', e.target.value)}
          placeholder="08xxxxxxxxxx" className={inputClass} />
      </div>
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Catatan (opsional)</label>
        <textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)}
          placeholder="Request khusus, dll." className={inputClass + ' resize-none'} />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onBack}
          className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-surface-subtle transition-colors">
          ← Kembali
        </button>
        <button type="submit"
          className="flex-1 py-2.5 bg-brand-500 text-white text-sm font-semibold rounded-xl hover:bg-brand-600 transition-colors">
          Lanjut →
        </button>
      </div>
    </form>
  )
}

// ─── cash calculator modal ────────────────────────────────────────────────────

function CashModal({
  price,
  onConfirm,
  onCancel,
}: {
  price: number
  onConfirm: () => void
  onCancel: () => void
}) {
  const [raw, setRaw] = useState('')

  const uang     = Number(raw.replace(/\D/g, '')) || 0
  const kembalian = uang - price
  const cukup    = uang >= price

  const handleInput = (v: string) => {
    const digits = v.replace(/\D/g, '')
    setRaw(digits ? Number(digits).toLocaleString('id-ID') : '')
  }

  const addQuick = (n: number) => {
    const current = Number(raw.replace(/\D/g, '')) || 0
    handleInput(String(current + n))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        className="bg-white rounded-3xl border-2 border-ink shadow-cartoon-xl w-full max-w-sm"
      >
        {/* header */}
        <div className="px-6 pt-6 pb-4 border-b-2 border-ink">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400 border-2 border-ink shadow-cartoon-sm flex items-center justify-center text-xl">
              💵
            </div>
            <div>
              <p className="font-extrabold text-ink text-base">Hitung Kembalian</p>
              <p className="text-xs font-semibold text-gray-400">
                Tagihan: <span className="text-ink font-extrabold">{formatIDR(price)}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* input uang */}
          <div>
            <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-2">
              Uang dari Customer
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-extrabold text-gray-400">Rp</span>
              <input
                autoFocus
                type="text"
                inputMode="numeric"
                value={raw}
                onChange={(e) => handleInput(e.target.value)}
                placeholder="0"
                className="w-full pl-10 pr-4 py-3.5 rounded-2xl border-2 border-ink text-lg font-extrabold text-ink shadow-cartoon-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 text-right"
              />
            </div>
          </div>

          {/* quick amounts */}
          <div>
            <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-2">Nominal Cepat</p>
            <div className="grid grid-cols-4 gap-2">
              {[50_000, 100_000, 150_000, 200_000].map((n) => (
                <button
                  key={n}
                  onClick={() => addQuick(n)}
                  className="py-2 rounded-xl border-2 border-ink text-xs font-extrabold text-ink bg-white shadow-cartoon-sm hover:-translate-y-0.5 hover:shadow-cartoon active:translate-y-0.5 active:shadow-none transition-all duration-100"
                >
                  +{n / 1000}k
                </button>
              ))}
            </div>
            <button
              onClick={() => handleInput(String(price))}
              className="w-full mt-2 py-2 rounded-xl border-2 border-brand-500 text-xs font-extrabold text-brand-500 bg-brand-50 hover:bg-brand-100 transition-colors"
            >
              Uang pas ({formatIDR(price)})
            </button>
          </div>

          {/* kembalian display */}
          <div className={`rounded-2xl border-2 px-5 py-4 transition-colors ${
            uang === 0 ? 'border-gray-200 bg-gray-50' :
            cukup      ? 'border-green-400 bg-green-50 shadow-[3px_3px_0_#4ade80]' :
                         'border-red-400 bg-red-50 shadow-[3px_3px_0_#f87171]'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-extrabold text-gray-600">Kembalian</span>
              <span className={`text-2xl font-extrabold ${
                uang === 0 ? 'text-gray-300' :
                cukup      ? 'text-green-600' : 'text-red-500'
              }`}>
                {uang === 0 ? '—' : cukup ? formatIDR(kembalian) : `Kurang ${formatIDR(Math.abs(kembalian))}`}
              </span>
            </div>
          </div>
        </div>

        {/* actions */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-2xl border-2 border-ink text-sm font-extrabold text-gray-600 bg-white shadow-cartoon-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-cartoon active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all duration-100"
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            disabled={!cukup}
            className="flex-1 py-3 rounded-2xl border-2 border-ink text-sm font-extrabold text-white bg-brand-500 shadow-cartoon hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-cartoon-lg disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-x-0 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all duration-100"
          >
            ✓ Konfirmasi
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── step 3: payment ──────────────────────────────────────────────────────────

interface AllData {
  studio_id: number; slot_id: number; date: string; sessions: number
  customer_name: string; customer_email: string; customer_phone: string; notes: string
}

function StepPayment({
  data, onBack, onDone,
}: {
  data: AllData
  onBack: () => void
  onDone: () => void
}) {
  const { data: studios = [] } = useQuery<Studio[]>({ queryKey: ['studios'], queryFn: () => api.get('/studios').then((r) => r.data), staleTime: 5 * 60 * 1000 })
  const studio = studios.find((s) => s.id === data.studio_id)

  const [method,     setMethod]     = useState<'cash' | 'qris'>('cash')
  const [result,     setResult]     = useState<BookingResult | null>(null)
  const [loading,    setLoading]    = useState(false)
  const [showCashModal, setShowCashModal] = useState(false)
  const [promoInput, setPromoInput] = useState('')
  const [promoCode,  setPromoCode]  = useState('')

  // Same server-side pricing as online booking (weekend price + promo)
  const { data: quote } = useQuery<Quote>({
    queryKey: ['quote', data.studio_id, data.slot_id, data.sessions, promoCode],
    queryFn: () => api.get('/quote', { params: { studio_id: data.studio_id, slot_id: data.slot_id, sessions: data.sessions, promo_code: promoCode || undefined } }).then((r) => r.data),
  })
  const price = quote?.total ?? studio?.price ?? 0

  const doSubmit = async () => {
    setLoading(true)
    try {
      const res = await api.post<BookingResult>('/admin/bookings', { ...data, payment_method: method, promo_code: quote?.promo?.code })
      setResult(res.data)

      // Cash, or fully discounted (nothing to charge): already confirmed
      if (method === 'cash' || res.data.status === 'confirmed') {
        toast.success(`Booking ${res.data.order_id} dikonfirmasi!`)
        setTimeout(onDone, 1800)
        return
      }

      // QRIS — open Midtrans Snap
      await openSnap(res.data.payment_token!, {
        onSuccess:  () => { toast.success('Pembayaran berhasil!'); onDone() },
        onPending:  () => toast('Pembayaran pending.', { icon: '⏳' }),
        onError:    () => toast.error('Pembayaran gagal.'),
        onClose:    () => toast('Snap ditutup.', { icon: '⚠️' }),
      })
    } catch (err: any) {
      const code = err.response?.data?.code
      if (code === 'SLOT_UNAVAILABLE') {
        toast.error('Slot baru saja diambil. Kembali dan pilih waktu lain.')
      } else {
        toast.error(err.response?.data?.message ?? 'Terjadi kesalahan.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitClick = () => {
    if (method === 'cash') {
      setShowCashModal(true)
    } else {
      doSubmit()
    }
  }

  if (result?.status === 'confirmed') {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
        <motion.div
          initial={{ scale: 0 }} animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.1 }}
          className="w-20 h-20 bg-green-100 border-2 border-ink rounded-3xl shadow-cartoon flex items-center justify-center mx-auto mb-4 text-4xl"
        >
          🎉
        </motion.div>
        <h2 className="text-xl font-extrabold text-ink mb-1">Booking Dikonfirmasi!</h2>
        <p className="text-sm font-semibold text-gray-400">{result.order_id}</p>
      </motion.div>
    )
  }

  return (
    <>
      <div className="space-y-5">
        {/* summary */}
        <div className="bg-surface-subtle rounded-2xl border-2 border-ink shadow-cartoon-sm p-4 space-y-2.5">
          {[
            ['Studio',    studio?.name ?? '—'],
            ['Tanggal',   format(new Date(data.date), 'EEEE, d MMMM yyyy', { locale: idLocale })],
            ['Durasi',    durationLabel(data.sessions)],
            ['Pelanggan', data.customer_name],
            ['No. HP',    data.customer_phone],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between">
              <span className="text-sm font-semibold text-gray-400">{label}</span>
              <span className="text-sm font-extrabold text-ink">{value}</span>
            </div>
          ))}
        </div>

        {/* promo */}
        <div>
          <div className="flex gap-2">
            <input
              value={promoInput}
              onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
              placeholder="Kode promo (opsional)"
              className="flex-1 min-w-0 px-4 py-2.5 rounded-2xl border-2 border-ink text-sm font-semibold text-ink placeholder-gray-300 bg-white shadow-cartoon-sm uppercase focus:outline-none"
            />
            <button
              type="button" disabled={!promoInput.trim()}
              onClick={() => setPromoCode(promoInput.trim())}
              className="shrink-0 px-4 rounded-2xl border-2 border-ink bg-white text-sm font-extrabold text-ink shadow-cartoon-sm disabled:opacity-40"
            >
              Pakai
            </button>
          </div>
          {promoCode && quote?.promo_error && <p className="text-red-500 text-xs font-semibold mt-1.5">{quote.promo_error}</p>}
          {quote?.promo && <p className="text-green-600 text-xs font-bold mt-1.5">✓ {quote.promo.code}: {quote.promo.label} (− {formatIDR(quote.discount)})</p>}
        </div>

        {/* total */}
        <div className="flex items-center justify-between bg-brand-50 border-2 border-ink rounded-2xl shadow-cartoon-sm px-5 py-4">
          <span className="font-extrabold text-ink">Total{quote?.is_weekend ? ' (weekend)' : ''}</span>
          <span className="text-2xl font-extrabold text-brand-500">{formatIDR(price)}</span>
        </div>

        {/* method selector */}
        <div>
          <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-2">
            Metode Pembayaran
          </label>
          <div className="grid grid-cols-2 gap-3">
            {([
              { id: 'cash', icon: '💵', label: 'Cash', desc: 'Hitung kembalian otomatis' },
              { id: 'qris', icon: '📱', label: 'QRIS', desc: 'Generate via Midtrans' },
            ] as const).map((opt) => (
              <button
                key={opt.id}
                onClick={() => setMethod(opt.id)}
                className={`p-4 rounded-2xl border-2 text-left transition-all duration-100 ${
                  method === opt.id
                    ? 'border-ink bg-brand-50 shadow-cartoon-sm -translate-x-0.5 -translate-y-0.5'
                    : 'border-ink bg-white shadow-cartoon-sm hover:shadow-cartoon hover:-translate-x-0.5 hover:-translate-y-0.5'
                }`}
              >
                <span className="text-2xl block mb-1">{opt.icon}</span>
                <p className="text-sm font-extrabold text-ink">{opt.label}</p>
                <p className="text-xs font-semibold text-gray-400 mt-0.5">{opt.desc}</p>
                {method === opt.id && (
                  <div className="mt-2 w-4 h-4 rounded-full bg-brand-500 border-2 border-ink flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button
            onClick={onBack}
            className="px-5 py-3 rounded-2xl border-2 border-ink text-sm font-extrabold text-gray-600 bg-white shadow-cartoon-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-cartoon active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all duration-100"
          >
            ← Kembali
          </button>
          <button
            onClick={handleSubmitClick}
            disabled={loading}
            className="flex-1 py-3 rounded-2xl border-2 border-ink text-sm font-extrabold text-white bg-brand-500 shadow-cartoon hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-cartoon-lg disabled:opacity-50 disabled:cursor-not-allowed active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all duration-100"
          >
            {loading ? 'Memproses…' : method === 'cash' ? '💵 Konfirmasi & Selesai' : '📱 Generate QRIS'}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showCashModal && (
          <CashModal
            price={price}
            onCancel={() => setShowCashModal(false)}
            onConfirm={() => { setShowCashModal(false); doSubmit() }}
          />
        )}
      </AnimatePresence>
    </>
  )
}

// ─── main ─────────────────────────────────────────────────────────────────────

const EMPTY_CUSTOMER = { customer_name: '', customer_email: '', customer_phone: '', notes: '' }

export default function AdminPayment() {
  const qc = useQueryClient()
  const [step,     setStep]     = useState(0)
  const [schedule, setSchedule] = useState<{ studio_id: number; slot_id: number; date: string; sessions: number } | null>(null)
  const [customer, setCustomer] = useState<typeof EMPTY_CUSTOMER>(EMPTY_CUSTOMER)
  const [key,      setKey]      = useState(0) // reset flow

  const reset = () => {
    setStep(0); setSchedule(null); setCustomer(EMPTY_CUSTOMER); setKey((k) => k + 1)
    qc.invalidateQueries({ queryKey: ['admin', 'bookings'] })
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-extrabold text-ink">Walk-in Payment</h1>
        <p className="text-sm font-semibold text-gray-400 mt-0.5">Buat booking manual untuk pelanggan walk-in.</p>
      </div>

      <div className="bg-white rounded-3xl border-2 border-ink shadow-cartoon-xl">
        <div className="p-8 pb-0">
          <Steps current={step} />
        </div>
        <div className="px-8 pb-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${key}-${step}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.15 }}
            >
              {step === 0 && (
                <StepSchedule
                  onNext={(d) => { setSchedule(d); setStep(1) }}
                />
              )}
              {step === 1 && (
                <StepCustomer
                  initial={customer}
                  onNext={(d) => { setCustomer(d); setStep(2) }}
                  onBack={() => setStep(0)}
                />
              )}
              {step === 2 && schedule && (
                <StepPayment
                  data={{ ...schedule, ...customer }}
                  onBack={() => setStep(1)}
                  onDone={reset}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {step > 0 && step < 2 && (
            <button onClick={reset} className="mt-6 text-xs text-gray-300 hover:text-gray-500 transition-colors">
              Mulai ulang
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
