import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { format, parseISO } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import toast from 'react-hot-toast'
import api from '@/lib/axios'
import { formatIDR } from '@/lib/utils'
import PrimaryButton from '@/components/ui/PrimaryButton'
import DateTimeStep from '@/components/booking/DateTimeStep'
import { durationLabel } from '@/lib/sessions'

interface LookupResult {
  order_id: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'expired'
  customer_name: string
  studio_id: number
  studio: string | null
  date: string | null
  start_time: string | null
  end_time: string | null
  sessions: number
  amount: number | null
  payment_status: string | null
  rescheduled: boolean
  reschedule_error: string | null
}

const STATUS_LABEL: Record<LookupResult['status'], { text: string; cls: string }> = {
  confirmed: { text: 'Dikonfirmasi', cls: 'bg-green-100 text-green-700' },
  pending:   { text: 'Menunggu pembayaran', cls: 'bg-amber-100 text-amber-700' },
  cancelled: { text: 'Dibatalkan', cls: 'bg-rose-100 text-rose-600' },
  expired:   { text: 'Kadaluarsa', cls: 'bg-gray-100 text-gray-500' },
}

const inputCls = 'w-full px-4 py-3 rounded-xl bg-surface-subtle border border-transparent text-base md:text-sm font-medium text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-brand-500 focus:bg-white transition-all'

/** Customer self-service: find a booking by Order ID + email, and reschedule it once. */
export default function CheckBookingPage() {
  const [params] = useSearchParams()
  const [orderId, setOrderId] = useState(params.get('order_id') ?? '')
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [booking, setBooking] = useState<LookupResult | null>(null)
  const [picking, setPicking] = useState(false)

  const creds = () => ({ order_id: orderId.trim(), email: email.trim() })
  const errMsg = (err: any) =>
    err.response?.status === 429 ? 'Terlalu banyak percobaan. Tunggu 1 menit lalu coba lagi.' : err.response?.data?.message ?? 'Terjadi kesalahan.'

  const lookup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      setBooking((await api.post<LookupResult>('/bookings/lookup', creds())).data)
    } catch (err: any) {
      setBooking(null)
      toast.error(errMsg(err))
    } finally {
      setLoading(false)
    }
  }

  const reschedule = async (slotId: number) => {
    try {
      const res = await api.post<LookupResult & { message: string }>('/bookings/reschedule', { ...creds(), slot_id: slotId })
      setBooking(res.data)
      setPicking(false)
      toast.success(res.data.message, { duration: 6000 })
    } catch (err: any) {
      toast.error(errMsg(err), { duration: 6000 })
    }
  }

  return (
    <div className="flex justify-center px-4 pt-6 pb-12 md:py-16">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-6">
          <h1 className="text-2xl md:text-3xl font-extrabold text-ink tracking-tight">Cek Booking</h1>
          <p className="text-sm text-gray-400 font-semibold mt-1">Lihat status atau ubah jadwal booking kamu.</p>
        </div>

        <div className="bg-white rounded-3xl border-2 border-ink shadow-cartoon-lg p-5 md:p-8">
          {picking && booking ? (
            <DateTimeStep
              studioId={booking.studio_id}
              fixedSessions={booking.sessions}
              onBack={() => setPicking(false)}
              onNext={({ slot_id }) => reschedule(slot_id)}
            />
          ) : (
            <>
              <form onSubmit={lookup} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Order ID</label>
                  <input required value={orderId} onChange={(e) => setOrderId(e.target.value.toUpperCase())} placeholder="ORD-XXXXXXXX-…" className={`${inputCls} font-mono uppercase`} autoCapitalize="characters" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Email saat booking</label>
                  <input required type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@gmail.com" className={inputCls} />
                </div>
                <PrimaryButton type="submit" loading={loading}>Cari Booking</PrimaryButton>
                <p className="text-xs text-gray-400 text-center">Order ID ada di email konfirmasi booking.</p>
              </form>

              {booking && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6 pt-6 border-t-2 border-surface-subtle">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <p className="font-extrabold text-ink truncate">{booking.customer_name}</p>
                    <span className={`shrink-0 text-[11px] font-extrabold px-2.5 py-1 rounded-full border-2 border-ink ${STATUS_LABEL[booking.status].cls}`}>
                      {STATUS_LABEL[booking.status].text}
                    </span>
                  </div>
                  <div className="bg-surface-subtle rounded-2xl px-4 py-2 mb-4">
                    {[
                      ['Studio',   booking.studio],
                      ['Tanggal',  booking.date && format(parseISO(booking.date), 'EEEE, d MMMM yyyy', { locale: idLocale })],
                      ['Jam',      booking.start_time && `${booking.start_time} – ${booking.end_time} WIB`],
                      ['Durasi',   durationLabel(booking.sessions ?? 1)],
                      ['Total',    booking.amount != null ? formatIDR(booking.amount) : null],
                      ['Order ID', booking.order_id],
                    ].map(([label, value]) => value && (
                      <div key={label} className="flex justify-between items-start gap-4 py-2.5 border-b border-white last:border-0">
                        <span className="text-sm text-gray-400 shrink-0">{label}</span>
                        <span className="text-sm font-semibold text-gray-900 text-right break-all">{value}</span>
                      </div>
                    ))}
                  </div>
                  {booking.payment_status === 'refund_pending' && (
                    <p className="text-xs font-semibold text-orange-600 mb-3">💸 Pembayaran kamu sedang diproses untuk refund oleh admin.</p>
                  )}
                  {booking.reschedule_error ? (
                    booking.status === 'confirmed' && <p className="text-xs font-semibold text-gray-400">{booking.reschedule_error}</p>
                  ) : (
                    <PrimaryButton variant="ghost" className="w-full" onClick={() => setPicking(true)}>
                      📅 Ubah Jadwal
                    </PrimaryButton>
                  )}
                </motion.div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
