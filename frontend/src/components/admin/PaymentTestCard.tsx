import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { QrCode, ExternalLink, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/axios'
import { openSnap } from '@/lib/snap'
import { formatIDR } from '@/lib/utils'

interface TestCharge {
  order_id: string
  amount: number
  provider: 'midtrans' | 'xendit'
  payment_token?: string
  payment_url?: string
}

interface TestStatus {
  status: 'pending' | 'paid' | 'failed'
  method: string | null
  paid_at: string | null
}

/**
 * "Tes Pembayaran": a tiny real charge through the saved gateway. Status is read
 * straight from the gateway every few seconds, so it works even where webhooks
 * can't arrive (e.g. on a laptop).
 */
export default function PaymentTestCard({ gatewayLabel }: { gatewayLabel: string }) {
  const [amount, setAmount] = useState('100')
  const [charge, setCharge] = useState<TestCharge | null>(null)

  const create = useMutation({
    mutationFn: async () => {
      // Xendit opens in a new tab: open it now, inside the click, so popup blockers allow it
      const tab = gatewayLabel === 'Xendit' ? window.open('', '_blank') : null
      try {
        const res = await api.post<TestCharge>('/admin/payment-test', { amount: Number(amount) || 100 })
        return { data: res.data, tab }
      } catch (e) {
        tab?.close()
        throw e
      }
    },
    onSuccess: ({ data, tab }) => {
      setCharge(data)
      if (data.payment_url) {
        if (tab) tab.location.href = data.payment_url
      } else if (data.payment_token) {
        openSnap(data.payment_token, {
          onClose: () => toast('Popup ditutup. Status tetap dicek otomatis.', { icon: 'ℹ️' }),
        }).catch(() => toast.error('Gagal membuka popup Midtrans. Cek Client Key.'))
      }
    },
    onError: (err: any) => toast.error(err.response?.data?.message ?? 'Gagal membuat tes pembayaran.', { duration: 9000 }),
  })

  const { data: status } = useQuery<TestStatus>({
    queryKey: ['payment-test', charge?.order_id],
    queryFn: () => api.get(`/admin/payment-test/${charge!.order_id}`).then((r) => r.data),
    enabled: !!charge,
    refetchInterval: (q) => (q.state.data?.status && q.state.data.status !== 'pending' ? false : 3000),
  })

  const reopen = () => {
    if (!charge) return
    if (charge.payment_url) window.open(charge.payment_url, '_blank')
    else if (charge.payment_token) openSnap(charge.payment_token).catch(() => toast.error('Gagal membuka popup Midtrans.'))
  }

  return (
    <div className="bg-white rounded-3xl border-2 border-ink shadow-cartoon p-5 md:p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 shrink-0 rounded-2xl bg-brand-500 border-2 border-ink shadow-cartoon-sm grid place-items-center text-white">
          <QrCode className="w-5 h-5" strokeWidth={2.5} />
        </div>
        <div>
          <p className="font-extrabold text-ink">Tes Pembayaran</p>
          <p className="text-xs font-semibold text-gray-400">
            Buat tagihan kecil lewat <strong>{gatewayLabel}</strong> (pengaturan yang sudah disimpan), lalu scan QRIS-nya untuk memastikan pembayaran berjalan.
          </p>
        </div>
      </div>

      {!charge || status?.status === 'failed' ? (
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative sm:w-40">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-extrabold text-gray-400">Rp</span>
            <input
              inputMode="numeric" value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
              className="w-full pl-10 pr-3 py-3 rounded-2xl border-2 border-ink text-sm font-extrabold text-ink shadow-cartoon-sm text-right focus:outline-none"
            />
          </div>
          <button
            onClick={() => create.mutate()} disabled={create.isPending || !Number(amount)}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-amber-400 border-2 border-ink text-sm font-extrabold text-ink shadow-cartoon-sm disabled:opacity-50"
          >
            <QrCode className="w-4 h-4" strokeWidth={2.5} />
            {create.isPending ? 'Membuat…' : `Buat QR Tes ${formatIDR(Number(amount) || 0)}`}
          </button>
        </div>
      ) : null}

      {charge && (
        <div className={`mt-4 rounded-2xl border-2 p-4 ${
          status?.status === 'paid' ? 'border-green-400 bg-green-50'
            : status?.status === 'failed' ? 'border-rose-400 bg-rose-50'
            : 'border-amber-300 bg-amber-50'}`}
        >
          {status?.status === 'paid' ? (
            <>
              <p className="text-lg font-extrabold text-green-700">✅ Pembayaran berhasil!</p>
              <p className="text-xs font-semibold text-green-700 mt-1">
                {formatIDR(charge.amount)} diterima{status.method ? ` via ${status.method.toUpperCase()}` : ''}. {gatewayLabel} sudah siap dipakai customer.
              </p>
            </>
          ) : status?.status === 'failed' ? (
            <p className="text-sm font-extrabold text-rose-600">❌ Tes gagal / kedaluwarsa. Coba buat lagi.</p>
          ) : (
            <>
              <p className="text-sm font-extrabold text-amber-800 animate-pulse">⏳ Menunggu pembayaran {formatIDR(charge.amount)}…</p>
              <p className="text-xs font-semibold text-amber-700 mt-1">
                {charge.payment_url ? 'Halaman checkout Xendit dibuka di tab baru.' : 'Pilih QRIS di popup Midtrans, lalu scan dengan e-wallet / m-banking.'} Status dicek otomatis setiap 3 detik.
              </p>
              <button onClick={reopen} className="mt-3 inline-flex items-center gap-1.5 text-xs font-extrabold text-brand-600">
                <ExternalLink className="w-3.5 h-3.5" /> Buka lagi halaman pembayaran
              </button>
            </>
          )}
          <p className="text-[10px] font-mono text-gray-400 mt-2">{charge.order_id}</p>
          {status?.status === 'paid' && (
            <button onClick={() => setCharge(null)} className="mt-2 inline-flex items-center gap-1.5 text-xs font-extrabold text-gray-500">
              <RotateCcw className="w-3.5 h-3.5" /> Tes lagi
            </button>
          )}
        </div>
      )}

      <p className="text-[11px] font-semibold text-gray-400 mt-3">
        Di mode Production uang tes masuk sungguhan ke akun merchant. Sebagian metode punya minimum nominal (misalnya QRIS di Xendit) — kalau ditolak, pesan dari gateway akan muncul di sini.
      </p>
    </div>
  )
}
