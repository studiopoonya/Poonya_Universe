import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { format, parseISO } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import api from '@/lib/axios'

interface OrderSummary {
  order_id: string
  status: 'pending' | 'onsite' | 'confirmed' | 'cancelled' | 'expired'
  studio: string | null
  date: string | null
  start_time: string | null
  end_time: string | null
}

const STATES = {
  confirmed: { icon: '🎉', title: 'Booking Dikonfirmasi!', desc: 'Pembayaran berhasil. Detail booking sudah dikirim ke email kamu.', bg: 'bg-green-100' },
  onsite:    { icon: '🧾', title: 'Reservasi Bayar di Tempat', desc: 'Bayar di studio saat datang. Jadwal belum terkunci sampai kamu membayar.', bg: 'bg-sky-100' },
  pending:   { icon: '⏳', title: 'Menunggu Pembayaran',  desc: 'Kami sedang menunggu konfirmasi dari pembayaranmu. Halaman ini akan update otomatis.', bg: 'bg-amber-100' },
  expired:   { icon: '⌛', title: 'Booking Kadaluarsa',   desc: 'Waktu pembayaran sudah habis dan slot dilepas. Silakan booking ulang.', bg: 'bg-gray-100' },
  cancelled: { icon: '❌', title: 'Booking Dibatalkan',   desc: 'Pembayaran gagal atau dibatalkan. Silakan booking ulang.', bg: 'bg-rose-100' },
}

/** Landing page after Midtrans redirects back (common on phones, e.g. GoPay/ShopeePay). */
export default function BookingSuccessPage() {
  const [params] = useSearchParams()
  const orderId  = params.get('order_id')

  const { data, isLoading, isError } = useQuery<OrderSummary>({
    queryKey: ['booking-order', orderId],
    queryFn: () => api.get(`/bookings/order/${encodeURIComponent(orderId!)}`).then((r) => r.data),
    enabled: !!orderId,
    retry: false,
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? 3000 : false),
  })

  const state = data ? STATES[data.status] : null

  return (
    <div className="flex justify-center px-4 pt-8 pb-12 md:py-20">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-3xl border-2 border-ink shadow-cartoon-lg p-6 md:p-8 text-center"
      >
        {isLoading && (
          <p className="py-10 text-sm font-bold text-gray-400 animate-pulse">Mengecek status booking…</p>
        )}

        {(!orderId || isError) && (
          <>
            <div className="text-5xl mb-3">🤔</div>
            <h1 className="text-xl font-extrabold text-ink mb-1">Booking tidak ditemukan</h1>
            <p className="text-sm text-gray-400 font-semibold mb-6">Link ini tidak valid atau sudah kadaluarsa.</p>
          </>
        )}

        {data && state && (
          <>
            <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl ${state.bg} border-2 border-ink shadow-cartoon-sm flex items-center justify-center text-3xl`}>
              {state.icon}
            </div>
            <h1 className="text-xl md:text-2xl font-extrabold text-ink mb-1">{state.title}</h1>
            <p className={`text-sm text-gray-500 font-semibold mb-6 ${data.status === 'pending' ? 'animate-pulse' : ''}`}>
              {state.desc}
            </p>

            <div className="text-left bg-surface-subtle rounded-2xl px-4 py-2 mb-6">
              {[
                ['Studio',   data.studio],
                ['Tanggal',  data.date && format(parseISO(data.date), 'EEEE, d MMMM yyyy', { locale: idLocale })],
                ['Waktu',    data.start_time && `${data.start_time} – ${data.end_time} WIB`],
                ['Order ID', data.order_id],
              ].map(([label, value]) => value && (
                <div key={label} className="flex justify-between items-start gap-4 py-2.5 border-b border-white last:border-0">
                  <span className="text-sm text-gray-400 shrink-0">{label}</span>
                  <span className="text-sm font-semibold text-gray-900 text-right min-w-0 [overflow-wrap:anywhere]">{value}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {!isLoading && (
          <Link
            to={data?.status === 'confirmed' ? '/' : '/booking'}
            className="inline-flex w-full items-center justify-center py-3.5 rounded-2xl bg-brand-500 text-white font-extrabold text-sm border-2 border-ink shadow-cartoon hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-cartoon-lg active:translate-x-1 active:translate-y-1 active:shadow-none transition-all duration-100"
          >
            {data?.status === 'confirmed' ? 'Kembali ke Beranda' : data?.status === 'pending' ? 'Booking Lain' : 'Booking Ulang'}
          </Link>
        )}
      </motion.div>
    </div>
  )
}
