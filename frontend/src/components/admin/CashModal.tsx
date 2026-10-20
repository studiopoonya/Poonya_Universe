import { useState } from 'react'
import { motion } from 'framer-motion'
import { formatIDR } from '@/lib/utils'

/** Cash at the counter: enter what the customer handed over, see the change. */
export default function CashModal({
  price,
  onConfirm,
  onCancel,
  subtitle,
  loading = false,
}: {
  price: number
  /** Receives the cash handed over, so it (and the change) can be recorded */
  onConfirm: (cashReceived: number) => void
  onCancel: () => void
  /** e.g. the customer and session being paid for */
  subtitle?: string
  loading?: boolean
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
              {subtitle && <p className="text-xs font-semibold text-gray-500 mt-0.5">{subtitle}</p>}
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
            onClick={() => onConfirm(uang)}
            disabled={!cukup || loading}
            className="flex-1 py-3 rounded-2xl border-2 border-ink text-sm font-extrabold text-white bg-brand-500 shadow-cartoon hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-cartoon-lg disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-x-0 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all duration-100"
          >
            {loading ? 'Memproses…' : '✓ Konfirmasi'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
