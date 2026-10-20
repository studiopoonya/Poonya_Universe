import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import QRCode from 'qrcode'
import { ShieldCheck, ShieldOff, Copy } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/axios'

const card = 'bg-white rounded-3xl border-2 border-ink shadow-cartoon p-5 md:p-6'
const inputCls = 'w-full px-4 py-3 rounded-2xl border-2 border-ink text-sm font-semibold text-ink placeholder-gray-300 bg-white shadow-cartoon-sm focus:outline-none'
const btnPrimary = 'w-full py-3 rounded-2xl bg-brand-500 text-white text-sm font-extrabold border-2 border-ink shadow-cartoon-sm disabled:opacity-50'

/** Per-account security: turn two-factor login (authenticator app) on or off. */
export default function AdminSecurity() {
  const qc = useQueryClient()
  const { data: me } = useQuery<{ email: string; two_factor_enabled: boolean }>({
    queryKey: ['me'],
    queryFn: () => api.get('/auth/me').then((r) => r.data),
  })

  const [setup, setSetup]       = useState<{ secret: string; uri: string } | null>(null)
  const [qr, setQr]             = useState('')
  const [code, setCode]         = useState('')
  const [recovery, setRecovery] = useState<string[] | null>(null)
  const [password, setPassword] = useState('')

  useEffect(() => {
    if (setup) QRCode.toDataURL(setup.uri, { width: 220, margin: 1 }).then(setQr)
  }, [setup])

  const err = (e: any) => toast.error(e.response?.data?.message ?? 'Terjadi kesalahan.')

  const start = useMutation({
    mutationFn: () => api.post('/auth/two-factor/setup'),
    onSuccess: (res) => setSetup(res.data),
    onError: err,
  })
  const confirm = useMutation({
    mutationFn: () => api.post('/auth/two-factor/confirm', { code }),
    onSuccess: (res) => {
      setRecovery(res.data.recovery_codes)
      setSetup(null); setCode('')
      qc.invalidateQueries({ queryKey: ['me'] })
      toast.success(res.data.message)
    },
    onError: err,
  })
  const disable = useMutation({
    mutationFn: () => api.delete('/auth/two-factor', { data: { password } }),
    onSuccess: (res) => { setPassword(''); qc.invalidateQueries({ queryKey: ['me'] }); toast.success(res.data.message) },
    onError: err,
  })

  const copyCodes = () => {
    navigator.clipboard?.writeText(recovery!.join('\n')).then(() => toast.success('Kode disalin.'))
  }

  return (
    <div className="max-w-xl space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-ink">Keamanan Akun</h1>
        <p className="text-sm font-semibold text-gray-400 mt-0.5">{me?.email}</p>
      </div>

      {recovery && (
        <div className="bg-amber-50 border-2 border-amber-400 rounded-3xl shadow-[4px_4px_0_#fbbf24] p-5 md:p-6">
          <p className="font-extrabold text-amber-800 mb-1">Simpan kode pemulihan ini</p>
          <p className="text-xs font-semibold text-amber-700 mb-4">
            Pakai salah satu kode ini jika HP hilang. Setiap kode hanya bisa dipakai sekali dan <strong>tidak akan ditampilkan lagi</strong>.
          </p>
          <div className="grid grid-cols-2 gap-2 font-mono text-sm font-bold text-ink mb-4">
            {recovery.map((c) => <span key={c} className="bg-white border-2 border-amber-300 rounded-xl px-3 py-2 text-center">{c}</span>)}
          </div>
          <div className="flex gap-2">
            <button onClick={copyCodes} className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border-2 border-ink bg-white text-sm font-extrabold shadow-cartoon-sm">
              <Copy className="w-4 h-4" /> Salin
            </button>
            <button onClick={() => setRecovery(null)} className="px-4 py-2.5 rounded-2xl border-2 border-ink bg-amber-400 text-sm font-extrabold shadow-cartoon-sm">
              Sudah saya simpan
            </button>
          </div>
        </div>
      )}

      <div className={card}>
        <div className="flex items-start gap-3 mb-4">
          <div className={`w-10 h-10 shrink-0 rounded-2xl border-2 border-ink shadow-cartoon-sm flex items-center justify-center ${me?.two_factor_enabled ? 'bg-green-500' : 'bg-gray-300'}`}>
            {me?.two_factor_enabled ? <ShieldCheck className="w-5 h-5 text-white" /> : <ShieldOff className="w-5 h-5 text-white" />}
          </div>
          <div>
            <p className="font-extrabold text-ink">Verifikasi 2 Langkah</p>
            <p className="text-xs font-semibold text-gray-400">
              {me?.two_factor_enabled
                ? 'Aktif — login butuh kode dari aplikasi authenticator.'
                : 'Lindungi akun dengan kode dari Google Authenticator / Authy saat login.'}
            </p>
          </div>
        </div>

        {me?.two_factor_enabled ? (
          <form onSubmit={(e) => { e.preventDefault(); disable.mutate() }} className="space-y-3">
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password untuk konfirmasi" className={inputCls} autoComplete="current-password" />
            <button type="submit" disabled={disable.isPending} className="w-full py-3 rounded-2xl bg-white text-rose-500 text-sm font-extrabold border-2 border-rose-300">
              Matikan Verifikasi 2 Langkah
            </button>
          </form>
        ) : setup ? (
          <form onSubmit={(e) => { e.preventDefault(); confirm.mutate() }} className="space-y-4">
            <ol className="text-sm font-semibold text-gray-600 list-decimal pl-5 space-y-1">
              <li>Buka Google Authenticator / Authy di HP.</li>
              <li>Scan QR code di bawah (atau ketik kode rahasianya).</li>
              <li>Masukkan 6 angka yang muncul.</li>
            </ol>
            <div className="flex flex-col items-center gap-2">
              {qr && <img src={qr} alt="QR code 2FA" className="w-52 h-52 border-2 border-ink rounded-2xl" />}
              <code className="text-xs font-mono font-bold text-gray-500 break-all text-center">{setup.secret}</code>
            </div>
            <input
              required inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)}
              placeholder="123456" className={`${inputCls} text-center text-lg tracking-[0.3em] font-extrabold`}
            />
            <button type="submit" disabled={confirm.isPending} className={btnPrimary}>Aktifkan</button>
          </form>
        ) : (
          <button onClick={() => start.mutate()} disabled={start.isPending} className={btnPrimary}>
            Aktifkan Verifikasi 2 Langkah
          </button>
        )}
      </div>
    </div>
  )
}
