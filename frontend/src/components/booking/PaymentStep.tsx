import { useState } from 'react'
import { motion } from 'framer-motion'
import { format, parseISO } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import toast from 'react-hot-toast'
import api from '@/lib/axios'
import { formatIDR } from '@/lib/utils'
import { useStudios } from '@/hooks/useStudios'
import { useBookingStatus } from '@/hooks/useBookingStatus'
import PrimaryButton from '@/components/ui/PrimaryButton'
import type { BookingPayload, BookingResponse } from '@/types'

interface Props {
  booking: Partial<BookingPayload>
  onBack: () => void
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-surface-subtle last:border-0">
      <span className="text-sm text-gray-400">{label}</span>
      <span className="text-sm font-semibold text-gray-900">{value}</span>
    </div>
  )
}

export default function PaymentStep({ booking, onBack }: Props) {
  const { data: studios = [] } = useStudios()
  const studio = studios.find((s) => s.id === booking.studio_id)

  const [loading, setLoading]         = useState(false)
  const [bookingResult, setResult]    = useState<BookingResponse | null>(null)
  const [snapOpened, setSnapOpened]   = useState(false)

  const { data: statusData } = useBookingStatus(bookingResult?.booking_id ?? null)

  const handlePay = async () => {
    setLoading(true)
    try {
      const res = await api.post<BookingResponse>('/bookings', booking)
      setResult(res.data)

      // Load Midtrans Snap
      const script = document.createElement('script')
      script.src = 'https://app.sandbox.midtrans.com/snap/snap.js'
      script.setAttribute('data-client-key', import.meta.env.VITE_MIDTRANS_CLIENT_KEY ?? '')
      document.head.appendChild(script)
      script.onload = () => {
        ;(window as any).snap.pay(res.data.payment_token, {
          onSuccess:  () => setSnapOpened(false),
          onPending:  () => setSnapOpened(false),
          onError:    () => toast.error('Pembayaran gagal. Silakan coba lagi.'),
          onClose:    () => toast('Pembayaran belum selesai.', { icon: '⚠️' }),
        })
        setSnapOpened(true)
      }
    } catch (err: any) {
      const code = err.response?.data?.code
      if (code === 'SLOT_UNAVAILABLE') {
        toast.error('Slot ini baru saja diambil orang lain. Pilih waktu lain.')
        onBack()
      } else {
        toast.error('Terjadi kesalahan. Silakan coba lagi.')
      }
    } finally {
      setLoading(false)
    }
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

      <div className="bg-surface-subtle rounded-2xl p-5 mb-5">
        <Row label="Studio"  value={studio?.name ?? '—'} />
        {booking.date && (
          <Row
            label="Tanggal"
            value={format(parseISO(booking.date), 'EEEE, d MMMM yyyy', { locale: idLocale })}
          />
        )}
        <Row label="Nama"    value={(booking as any).customer_name ?? '—'} />
        <Row label="Email"   value={(booking as any).customer_email ?? '—'} />
        <Row label="No. HP"  value={(booking as any).customer_phone ?? '—'} />
      </div>

      <div className="flex items-center justify-between bg-brand-50 border border-brand-100 rounded-2xl px-5 py-4 mb-6">
        <span className="font-semibold text-gray-700">Total</span>
        <span className="text-xl font-bold text-brand-600">{formatIDR(studio?.price ?? 0)}</span>
      </div>

      {bookingResult && statusData?.status === 'pending' && (
        <p className="text-center text-xs text-gray-400 mb-3 animate-pulse">
          Menunggu konfirmasi pembayaran…
        </p>
      )}

      <div className="flex gap-3">
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
          <PrimaryButton onClick={() => {
            ;(window as any).snap?.pay(bookingResult.payment_token)
          }}>
            Buka Kembali Pembayaran
          </PrimaryButton>
        )}
      </div>
    </div>
  )
}
