import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { format, parseISO } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import toast from 'react-hot-toast'
import api from '@/lib/axios'
import { openSnap } from '@/lib/snap'
import { formatIDR } from '@/lib/utils'
import { durationLabel } from '@/lib/sessions'
import { useStudios } from '@/hooks/useStudios'
import { useBookingStatus } from '@/hooks/useBookingStatus'
import PrimaryButton from '@/components/ui/PrimaryButton'
import StepActions from '@/components/ui/StepActions'
import type { BookingPayload, BookingResponse, Quote } from '@/types'

interface Props {
  booking: Partial<BookingPayload> & { time?: string; sessions?: number }
  onBack: () => void
  /** Start over from date/time selection after the booking expired or failed */
  onRestart: () => void
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-4 py-2.5 border-b border-surface-subtle last:border-0">
      <span className="text-sm text-gray-400 shrink-0">{label}</span>
      <span className="text-sm font-semibold text-gray-900 text-right min-w-0 [overflow-wrap:anywhere]">{value}</span>
    </div>
  )
}

export default function PaymentStep({ booking, onBack, onRestart }: Props) {
  const { data: studios = [] } = useStudios()
  const studio = studios.find((s) => s.id === booking.studio_id)

  const [loading, setLoading]         = useState(false)
  const [bookingResult, setResult]    = useState<BookingResponse | null>(null)
  const [promoInput, setPromoInput]   = useState('')
  const [promoCode, setPromoCode]     = useState('')   // code sent to /quote
  const [method, setMethod]           = useState<'online' | 'onsite'>('online')
  const qc = useQueryClient()

  // Server-side price (weekend price + promo) — the exact amount that will be charged
  const { data: quote, isFetching: quoting } = useQuery<Quote>({
    queryKey: ['quote', booking.studio_id, booking.slot_id, booking.sessions, promoCode],
    queryFn: () => api.get('/quote', { params: { studio_id: booking.studio_id, slot_id: booking.slot_id, sessions: booking.sessions ?? 1, promo_code: promoCode || undefined } }).then((r) => r.data),
    enabled: !!booking.studio_id && !!booking.slot_id,
  })

  const { data: statusData } = useBookingStatus(bookingResult?.booking_id ?? null)

  const handlePay = async () => {
    setLoading(true)
    try {
      const res = await api.post<BookingResponse>('/bookings', { ...booking, promo_code: quote?.promo?.code, payment_method: method })
      setResult(res.data)

      // 100% promo: already confirmed, nothing to pay (the status poll shows the success screen)
      if (res.data.payment_token) await pay(res.data.payment_token)
    } catch (err: any) {
      const code = err.response?.data?.code
      if (err.response?.status === 429) {
        toast.error('Terlalu banyak percobaan booking. Tunggu sebentar lalu coba lagi.')
      } else if (code === 'SLOT_RESERVED') {
        toast.error(err.response.data.message, { duration: 7000 })
        setMethod('online')
      } else if (code === 'SLOT_UNAVAILABLE') {
        toast.error('Slot ini baru saja diambil orang lain. Pilih waktu lain.')
        onRestart()
      } else {
        toast.error(err.response?.data?.message ?? 'Terjadi kesalahan. Silakan coba lagi.')
      }
    } finally {
      setLoading(false)
    }
  }

  /** Reserved to pay at the studio → lock the slot now by paying online instead. */
  const secureNow = async () => {
    if (!bookingResult) return
    setLoading(true)
    try {
      const res = await api.post<BookingResponse>('/bookings/pay-online', { order_id: bookingResult.order_id, email: booking.customer_email })
      setResult(res.data)
      await qc.invalidateQueries({ queryKey: ['booking-status', bookingResult.booking_id] }) // resume polling
      if (res.data.payment_token) await pay(res.data.payment_token)
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Terjadi kesalahan. Silakan coba lagi.', { duration: 7000 })
      if (err.response?.data?.code === 'SLOT_UNAVAILABLE') onRestart()
    } finally {
      setLoading(false)
    }
  }

  const pay = (token: string) =>
    openSnap(token, {
      onError: () => toast.error('Pembayaran gagal. Silakan coba lagi.'),
      onClose: () => toast('Pembayaran belum selesai.', { icon: '⚠️' }),
    }).catch(() => toast.error('Gagal membuka halaman pembayaran. Periksa koneksi lalu coba lagi.'))

  // Reserved to pay at the studio — the slot is NOT locked, so nudge toward paying now
  const status = statusData?.status ?? (bookingResult?.status === 'onsite' ? 'onsite' : undefined)
  if (status === 'onsite') {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 border-2 border-ink shadow-cartoon-sm flex items-center justify-center mx-auto mb-4 text-3xl">🧾</div>
        <h2 className="text-xl font-extrabold text-ink mb-1">Reservasi Tercatat</h2>
        <p className="text-sm text-gray-500 font-semibold">Bayar di studio saat kamu datang.</p>
        <p className="text-sm font-extrabold text-ink font-mono mt-2">{bookingResult?.order_id}</p>

        <div className="text-left bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 mt-5">
          <p className="text-sm font-extrabold text-amber-800">⚠️ Jadwal kamu belum terkunci</p>
          <p className="text-xs font-semibold text-amber-700 mt-1 leading-relaxed">
            Kalau ada orang lain yang bayar online di jam yang sama lebih dulu, reservasi ini <strong>otomatis batal</strong>.
            Bayar sekarang via QRIS supaya jadwal langsung jadi milikmu.
          </p>
        </div>

        <div className="mt-5 space-y-2">
          <PrimaryButton loading={loading} onClick={secureNow}>🔒 Amankan Sekarang via QRIS</PrimaryButton>
          <p className="text-xs text-gray-400">Atau tutup halaman ini — detail reservasi sudah dikirim ke email kamu.</p>
        </div>
      </motion.div>
    )
  }

  // Payment window ran out, or the payment failed — the slot is released
  if (statusData?.status === 'expired' || statusData?.status === 'cancelled') {
    const expired = statusData.status === 'expired'
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-6">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 border-2 border-ink shadow-cartoon-sm flex items-center justify-center mx-auto mb-4 text-3xl">
          {expired ? '⌛' : '❌'}
        </div>
        <h2 className="text-xl font-extrabold text-ink mb-1">{expired ? 'Waktu Pembayaran Habis' : 'Pembayaran Gagal'}</h2>
        <p className="text-sm text-gray-400 font-semibold mb-6">
          {expired ? 'Booking kamu kadaluarsa dan slot sudah dilepas.' : 'Pembayaran dibatalkan atau ditolak.'} Silakan pilih jadwal lagi.
        </p>
        <PrimaryButton onClick={onRestart}>Pilih Jadwal Lagi</PrimaryButton>
      </motion.div>
    )
  }

  // Success screen
  if (statusData?.status === 'confirmed') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center py-6"
      >
        <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">Booking Dikonfirmasi!</h2>
        <p className="text-sm text-gray-400 mb-2">Cek email kamu untuk detail lengkap.</p>
        <p className="text-sm font-extrabold text-ink font-mono">{bookingResult?.order_id}</p>
        <p className="text-xs text-gray-400 mt-1">Simpan Order ID ini untuk cek atau ubah jadwal di menu Cek Booking.</p>
      </motion.div>
    )
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">Ringkasan Pembayaran</h2>
      <p className="text-sm text-gray-400 mb-6">Periksa detail booking sebelum membayar.</p>

      <div className="bg-surface-subtle rounded-2xl px-4 py-2 md:p-5 mb-5">
        <Row label="Studio"  value={studio?.name ?? '—'} />
        {booking.date && (
          <Row
            label="Tanggal"
            value={format(parseISO(booking.date), 'EEEE, d MMMM yyyy', { locale: idLocale })}
          />
        )}
        {booking.time && <Row label="Jam" value={`${booking.time} WIB`} />}
        <Row label="Durasi" value={durationLabel(booking.sessions ?? 1)} />
        <Row label="Nama"    value={(booking as any).customer_name ?? '—'} />
        <Row label="Email"   value={(booking as any).customer_email ?? '—'} />
        <Row label="No. HP"  value={(booking as any).customer_phone ?? '—'} />
      </div>

      {/* Promo code */}
      {!bookingResult && (
        <div className="mb-4">
          <div className="flex gap-2">
            <input
              value={promoInput}
              onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
              placeholder="Kode promo (opsional)"
              autoCapitalize="characters"
              className="flex-1 min-w-0 px-4 py-3 rounded-xl bg-surface-subtle border border-transparent text-base md:text-sm font-semibold text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-brand-500 focus:bg-white uppercase placeholder:normal-case"
            />
            <button
              type="button"
              disabled={!promoInput.trim() || quoting}
              onClick={() => setPromoCode(promoInput.trim())}
              className="shrink-0 px-4 rounded-xl border-2 border-ink bg-white text-sm font-extrabold text-ink shadow-cartoon-sm disabled:opacity-40"
            >
              Pakai
            </button>
          </div>
          {promoCode && quote?.promo_error && <p className="text-red-500 text-xs mt-1.5">{quote.promo_error}</p>}
          {quote?.promo && (
            <p className="text-green-600 text-xs font-bold mt-1.5">
              ✓ {quote.promo.code}: {quote.promo.label}{' '}
              <button type="button" className="underline text-gray-400 ml-1" onClick={() => { setPromoCode(''); setPromoInput('') }}>hapus</button>
            </p>
          )}
        </div>
      )}

      <div className="bg-brand-50 border border-brand-100 rounded-2xl px-4 md:px-5 py-4 mb-2 md:mb-6 space-y-1.5">
        {quote && (quote.discount > 0 || quote.is_weekend || quote.sessions > 1) && (
          <div className="flex items-center justify-between gap-3 text-sm text-gray-500">
            <span>
              Harga{quote.is_weekend ? ' weekend' : ''}
              {quote.sessions > 1 && <span className="text-gray-400"> ({quote.sessions} × {formatIDR(quote.per_session)})</span>}
            </span>
            <span className="shrink-0">{formatIDR(quote.base_price)}</span>
          </div>
        )}
        {quote && quote.discount > 0 && (
          <div className="flex items-center justify-between text-sm text-green-600 font-semibold">
            <span>Diskon</span>
            <span>− {formatIDR(quote.discount)}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="font-semibold text-gray-700">Total</span>
          <span className="text-xl font-bold text-brand-600">{quote ? formatIDR(quote.total) : '…'}</span>
        </div>
      </div>

      {/* Payment method: online locks the slot now; pay-at-studio does not */}
      {!bookingResult && quote && quote.total > 0 && (
        <div className="mb-4 mt-4 md:mt-0">
          <p className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider mb-2">Metode Pembayaran</p>
          <div className="space-y-2">
            <button
              type="button" onClick={() => setMethod('online')}
              className={`relative w-full text-left rounded-2xl border-2 p-3.5 transition-all ${
                method === 'online' ? 'border-brand-500 bg-brand-50 shadow-cartoon-sm' : 'border-ink/15 bg-white'
              }`}
            >
              <span className="absolute -top-2.5 right-3 text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-green-500 text-white border-2 border-ink">
                Disarankan
              </span>
              <div className="flex items-center gap-3">
                <span className={`w-5 h-5 shrink-0 rounded-full border-2 ${method === 'online' ? 'border-brand-500 bg-brand-500 ring-2 ring-white ring-inset' : 'border-gray-300'}`} />
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-ink">📱 Bayar Sekarang via QRIS</p>
                  <p className="text-xs font-semibold text-green-700 mt-0.5">✓ Jadwal langsung terkunci untukmu</p>
                  <p className="text-xs font-semibold text-green-700">✓ Konfirmasi instan ke email</p>
                </div>
              </div>
            </button>
            <button
              type="button" onClick={() => setMethod('onsite')}
              className={`w-full text-left rounded-2xl border-2 p-3.5 transition-all ${
                method === 'onsite' ? 'border-amber-400 bg-amber-50' : 'border-ink/15 bg-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`w-5 h-5 shrink-0 rounded-full border-2 ${method === 'onsite' ? 'border-amber-500 bg-amber-500 ring-2 ring-white ring-inset' : 'border-gray-300'}`} />
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-ink">💵 Bayar di Studio (Cash)</p>
                  <p className="text-xs font-semibold text-gray-400 mt-0.5">Jadwal belum terkunci — bisa diambil orang lain yang bayar online lebih dulu</p>
                </div>
              </div>
            </button>
          </div>
          {method === 'onsite' && (
            <p className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mt-2">
              ⚠️ Kalau jam ini dibayar online oleh orang lain, reservasimu otomatis batal. Mau aman? Pilih QRIS.
            </p>
          )}
        </div>
      )}

      {bookingResult && statusData?.status === 'pending' && (
        <p className="text-center text-xs text-gray-400 mb-3 animate-pulse">
          Menunggu konfirmasi pembayaran…
        </p>
      )}

      <StepActions>
        {!bookingResult && (
          <PrimaryButton variant="ghost" aria-label="Kembali" onClick={onBack} className="w-auto shrink-0 px-4">
          ← <span className="hidden xs:inline">Kembali</span>
          </PrimaryButton>
        )}
        {!bookingResult ? (
          <PrimaryButton loading={loading} disabled={!quote || quoting} onClick={handlePay}>
            {quote?.total === 0 ? 'Konfirmasi Booking' : method === 'onsite' ? 'Reservasi' : 'Bayar Sekarang'}
          </PrimaryButton>
        ) : bookingResult.payment_token && (
          <PrimaryButton onClick={() => pay(bookingResult.payment_token!)}>
            Buka Kembali Pembayaran
          </PrimaryButton>
        )}
      </StepActions>
    </div>
  )
}
