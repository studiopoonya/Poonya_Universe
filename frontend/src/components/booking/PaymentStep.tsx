import { useState } from 'react'
import { motion } from 'framer-motion'
import { format, parseISO } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import toast from 'react-hot-toast'
import api from '@/lib/axios'
import { openSnap } from '@/lib/snap'
import { formatIDR } from '@/lib/utils'
import { useStudios } from '@/hooks/useStudios'
import { useBookingStatus } from '@/hooks/useBookingStatus'
import PrimaryButton from '@/components/ui/PrimaryButton'
import StepActions from '@/components/ui/StepActions'
import type { BookingPayload, BookingResponse } from '@/types'

interface Props {
  booking: Partial<BookingPayload> & { time?: string }
  onBack: () => void
  /** Start over from date/time selection after the booking expired or failed */
  onRestart: () => void
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-4 py-2.5 border-b border-surface-subtle last:border-0">
      <span className="text-sm text-gray-400 shrink-0">{label}</span>
      <span className="text-sm font-semibold text-gray-900 text-right break-all">{value}</span>
    </div>
  )
}

export default function PaymentStep({ booking, onBack, onRestart }: Props) {
  const { data: studios = [] } = useStudios()
  const studio = studios.find((s) => s.id === booking.studio_id)

  const [loading, setLoading]         = useState(false)
  const [bookingResult, setResult]    = useState<BookingResponse | null>(null)

  const { data: statusData } = useBookingStatus(bookingResult?.booking_id ?? null)

  const handlePay = async () => {
    setLoading(true)
    try {
      const res = await api.post<BookingResponse>('/bookings', booking)
      setResult(res.data)

      await pay(res.data.payment_token)
    } catch (err: any) {
      const code = err.response?.data?.code
      if (err.response?.status === 429) {
        toast.error('Terlalu banyak percobaan booking. Tunggu sebentar lalu coba lagi.')
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

  const pay = (token: string) =>
    openSnap(token, {
      onError: () => toast.error('Pembayaran gagal. Silakan coba lagi.'),
      onClose: () => toast('Pembayaran belum selesai.', { icon: '⚠️' }),
    }).catch(() => toast.error('Gagal membuka halaman pembayaran. Periksa koneksi lalu coba lagi.'))

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
        <p className="text-xs text-gray-300">Order ID: {bookingResult?.order_id}</p>
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
        <Row label="Nama"    value={(booking as any).customer_name ?? '—'} />
        <Row label="Email"   value={(booking as any).customer_email ?? '—'} />
        <Row label="No. HP"  value={(booking as any).customer_phone ?? '—'} />
      </div>

      <div className="flex items-center justify-between bg-brand-50 border border-brand-100 rounded-2xl px-4 md:px-5 py-4 mb-2 md:mb-6">
        <span className="font-semibold text-gray-700">Total</span>
        <span className="text-xl font-bold text-brand-600">{formatIDR(studio?.price ?? 0)}</span>
      </div>

      {bookingResult && statusData?.status === 'pending' && (
        <p className="text-center text-xs text-gray-400 mb-3 animate-pulse">
          Menunggu konfirmasi pembayaran…
        </p>
      )}

      <StepActions>
        {!bookingResult && (
          <PrimaryButton variant="ghost" onClick={onBack} className="w-auto px-5">
            ← Kembali
          </PrimaryButton>
        )}
        {!bookingResult ? (
          <PrimaryButton loading={loading} onClick={handlePay}>
            Bayar Sekarang
          </PrimaryButton>
        ) : (
          <PrimaryButton onClick={() => pay(bookingResult.payment_token)}>
            Buka Kembali Pembayaran
          </PrimaryButton>
        )}
      </StepActions>
    </div>
  )
}
