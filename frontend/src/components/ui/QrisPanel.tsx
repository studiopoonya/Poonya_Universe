import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Download } from 'lucide-react'
import { formatIDR } from '@/lib/utils'

interface Props {
  /** QRIS payload from the gateway (EMVCo string) */
  qrString: string
  amount?: number
  /** ISO time the QR stops working */
  expiresAt?: string
  /** Used for the downloaded file name */
  orderId: string
}

function useCountdown(expiresAt?: string) {
  const [left, setLeft] = useState(() => (expiresAt ? new Date(expiresAt).getTime() - Date.now() : 0))
  useEffect(() => {
    if (!expiresAt) return
    const tick = () => setLeft(new Date(expiresAt).getTime() - Date.now())
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [expiresAt])
  return Math.max(0, left)
}

/** Draws the QRIS code on our own page — no gateway popup or method list in between. */
export default function QrisPanel({ qrString, amount, expiresAt, orderId }: Props) {
  const [img, setImg] = useState('')
  const left = useCountdown(expiresAt)

  useEffect(() => {
    QRCode.toDataURL(qrString, { width: 640, margin: 2, errorCorrectionLevel: 'M' }).then(setImg)
  }, [qrString])

  const mm = String(Math.floor(left / 60000)).padStart(2, '0')
  const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, '0')
  const over = !!expiresAt && left === 0

  return (
    <div className="text-center">
      <div className="inline-block bg-white rounded-3xl border-2 border-ink shadow-cartoon p-3">
        <p className="text-[11px] font-black tracking-[0.2em] text-ink mb-1">QRIS</p>
        {img
          ? <img src={img} alt="Kode QRIS pembayaran" className={`w-56 h-56 xs:w-64 xs:h-64 [image-rendering:pixelated] ${over ? 'opacity-20' : ''}`} />
          : <div className="w-56 h-56 xs:w-64 xs:h-64 rounded-2xl bg-surface-subtle animate-pulse" />}
      </div>

      {amount != null && <p className="text-2xl font-extrabold text-brand-600 mt-3">{formatIDR(amount)}</p>}
      {expiresAt && (
        <p className={`text-xs font-bold mt-1 ${over ? 'text-rose-500' : 'text-gray-500'}`}>
          {over ? 'QR sudah kedaluwarsa' : <>Bayar dalam <span className="font-mono text-ink">{mm}:{ss}</span></>}
        </p>
      )}

      {img && !over && (
        <a
          href={img} download={`QRIS-${orderId}.png`}
          className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border-2 border-ink bg-white text-xs font-extrabold text-ink shadow-cartoon-sm"
        >
          <Download className="w-3.5 h-3.5" strokeWidth={2.5} /> Simpan QR
        </a>
      )}

      <p className="text-xs font-semibold text-gray-400 mt-3 leading-relaxed max-w-xs mx-auto">
        Scan pakai GoPay, OVO, DANA, ShopeePay, atau m-banking.
        Bayar dari HP ini? Simpan QR, lalu pilih <strong>scan dari galeri</strong> di aplikasimu.
      </p>
    </div>
  )
}
