import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings2, Copy, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/axios'

type Gateway = 'midtrans' | 'xendit'

interface Saved {
  payment_gateway: Gateway
  midtrans_client_key: string
  midtrans_is_production: string
  server_key_status: 'missing' | 'invalid' | 'sandbox' | 'production'
  xendit_key_status: 'missing' | 'invalid' | 'test' | 'live'
  xendit_callback_token: boolean
  xendit_webhook_url: string
  midtrans_webhook_url: string
}

const card = 'bg-white rounded-3xl border-2 border-ink shadow-cartoon p-5 md:p-6'
const inputCls = 'w-full px-4 py-3 rounded-2xl border-2 border-ink text-sm font-semibold text-ink placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500/30 shadow-cartoon-sm font-mono'

function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs font-semibold text-gray-400 mt-1.5">{hint}</p>}
    </div>
  )
}

function Status({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return ok ? (
    <div className="bg-green-50 border-2 border-green-400 rounded-2xl px-4 py-3 text-xs font-extrabold text-green-700">✓ {children}</div>
  ) : (
    <div className="bg-rose-50 border-2 border-rose-400 rounded-2xl shadow-[3px_3px_0_#fb7185] px-4 py-3">
      <p className="text-xs font-extrabold text-rose-700">⚠️ Pembayaran tidak akan berjalan</p>
      <p className="text-xs font-semibold text-rose-600 mt-0.5">{children}</p>
    </div>
  )
}

function CopyUrl({ url }: { url: string }) {
  const [done, setDone] = useState(false)
  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 min-w-0 truncate text-xs font-mono bg-surface-subtle border-2 border-ink/10 rounded-xl px-3 py-2">{url}</code>
      <button
        type="button" aria-label="Salin URL"
        onClick={() => navigator.clipboard?.writeText(url).then(() => { setDone(true); setTimeout(() => setDone(false), 1500) })}
        className="shrink-0 w-9 h-9 rounded-xl border-2 border-ink bg-white grid place-items-center shadow-cartoon-sm"
      >
        {done ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  )
}

const envNote = <>File <code className="bg-amber-100 px-1 rounded font-mono">.env</code> backend</>

export default function AdminSettings() {
  const qc = useQueryClient()
  const { data: saved, isLoading } = useQuery<Saved>({
    queryKey: ['admin', 'settings'],
    queryFn: () => api.get('/admin/settings').then((r) => r.data),
  })

  const [gateway, setGateway]     = useState<Gateway>('midtrans')
  const [clientKey, setClientKey] = useState('')
  const [isProd, setIsProd]       = useState(false)

  useEffect(() => {
    if (!saved) return
    setGateway(saved.payment_gateway)
    setClientKey(saved.midtrans_client_key ?? '')
    setIsProd(saved.midtrans_is_production === '1')
  }, [saved])

  const looksLikeServerKey = /server/i.test(clientKey)

  const save = useMutation({
    mutationFn: () => api.put('/admin/settings', {
      payment_gateway: gateway,
      midtrans_client_key: clientKey.trim(),
      midtrans_is_production: isProd,
    }),
    onSuccess: () => { toast.success('Pengaturan disimpan.'); qc.invalidateQueries({ queryKey: ['admin', 'settings'] }) },
    onError: (err: any) => toast.error(err.response?.data?.message ?? 'Gagal menyimpan.', { duration: 7000 }),
  })

  // Status of the chosen gateway's secret keys (they live in .env, never here)
  const midtransProblem = !saved ? null
    : saved.server_key_status === 'missing' || saved.server_key_status === 'invalid'
      ? <>Server Key belum diisi atau masih contoh. Isi <code className="font-mono">MIDTRANS_SERVER_KEY</code> di .env backend.</>
      : saved.server_key_status === 'sandbox' && isProd ? 'Mode Production, tapi Server Key di .env adalah key Sandbox.'
      : saved.server_key_status === 'production' && !isProd ? 'Mode Sandbox, tapi Server Key di .env adalah key Production.'
      : !clientKey ? 'Client Key belum diisi — popup pembayaran tidak bisa dibuka.'
      : null

  const xenditProblem = !saved ? null
    : saved.xendit_key_status === 'missing' || saved.xendit_key_status === 'invalid'
      ? <>Secret Key belum diisi. Isi <code className="font-mono">XENDIT_SECRET_KEY</code> di .env backend.</>
      : !saved.xendit_callback_token
        ? <>Callback token belum diisi. Isi <code className="font-mono">XENDIT_CALLBACK_TOKEN</code> di .env — tanpa ini pembayaran tidak terkonfirmasi otomatis.</>
        : null

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-ink">Pengaturan</h1>
        <p className="text-sm font-semibold text-gray-400 mt-0.5">Payment gateway untuk pembayaran online customer.</p>
      </div>

      {isLoading || !saved ? (
        <div className="h-64 rounded-3xl bg-surface-subtle animate-pulse border-2 border-ink" />
      ) : (
        <>
          {/* Which gateway customers pay through */}
          <div className={card}>
            <p className="text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-3">Payment Gateway Aktif</p>
            <div className="grid grid-cols-2 gap-3">
              {([
                { id: 'midtrans', name: 'Midtrans', logo: 'MT', bg: 'bg-[#003d79]', desc: 'Popup di halaman (Snap)' },
                { id: 'xendit', name: 'Xendit', logo: 'X', bg: 'bg-[#4573ff]', desc: 'Halaman checkout Xendit' },
              ] as const).map((g) => (
                <button
                  key={g.id} type="button" onClick={() => setGateway(g.id)}
                  className={`text-left rounded-2xl border-2 p-4 transition-all ${
                    gateway === g.id ? 'border-ink bg-brand-50 shadow-cartoon-sm -translate-x-0.5 -translate-y-0.5' : 'border-ink/15 bg-white hover:border-ink'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 shrink-0 rounded-xl ${g.bg} border-2 border-ink grid place-items-center text-white text-xs font-extrabold`}>{g.logo}</div>
                    <div className="min-w-0">
                      <p className="font-extrabold text-ink">{g.name}</p>
                      <p className="text-[11px] font-semibold text-gray-400">{g.desc}</p>
                    </div>
                  </div>
                  {gateway === g.id && <p className="text-[10px] font-extrabold uppercase tracking-wider text-brand-500 mt-2">✓ Dipakai customer</p>}
                </button>
              ))}
            </div>
            <p className="text-xs font-semibold text-gray-400 mt-3">Keduanya mendukung QRIS, e-wallet (GoPay, OVO, DANA, ShopeePay), transfer bank / VA, dan kartu.</p>
          </div>

          {gateway === 'midtrans' ? (
            <div className={`${card} space-y-5`}>
              <p className="font-extrabold text-ink">Midtrans</p>

              <Field label="Environment">
                <div className="flex items-center gap-4 mt-1">
                  <button
                    type="button" onClick={() => setIsProd((p) => !p)} aria-label="Ganti environment"
                    className={`relative inline-flex h-7 w-12 items-center rounded-full border-2 border-ink shadow-cartoon-sm transition-colors ${isProd ? 'bg-green-500' : 'bg-gray-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white border-2 border-ink transition-transform ${isProd ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                  <div>
                    <span className={`text-sm font-extrabold ${isProd ? 'text-green-600' : 'text-amber-600'}`}>{isProd ? 'Production' : 'Sandbox'}</span>
                    <p className="text-xs font-semibold text-gray-400">{isProd ? 'Transaksi nyata — pakai key Production' : 'Mode testing — pakai key Sandbox'}</p>
                  </div>
                </div>
              </Field>

              <Field
                label="Client Key"
                hint={looksLikeServerKey
                  ? <span className="text-rose-600 font-bold">Ini Server Key (rahasia)! Jangan diisi di sini — Client Key diawali "Mid-client-" / "SB-Mid-client-".</span>
                  : 'Diawali Mid-client- (Production) atau SB-Mid-client- (Sandbox). Aman untuk browser.'}
              >
                <input value={clientKey} onChange={(e) => setClientKey(e.target.value)} className={`${inputCls} ${looksLikeServerKey ? 'border-rose-500' : ''}`} placeholder={isProd ? 'Mid-client-xxxx' : 'SB-Mid-client-xxxx'} autoComplete="off" />
              </Field>

              {midtransProblem ? <Status ok={false}>{midtransProblem}</Status> : <Status ok>Midtrans {isProd ? 'Production' : 'Sandbox'} siap dipakai</Status>}

              <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl px-4 py-3 text-xs font-semibold text-amber-700 space-y-2">
                <p><strong className="text-amber-800">Server Key</strong> tidak disimpan di sini karena rahasia — isi <code className="bg-amber-100 px-1 rounded font-mono">MIDTRANS_SERVER_KEY</code> di {envNote}.</p>
                <div>
                  <p className="mb-1"><strong className="text-amber-800">Notification URL</strong> — tempel di Midtrans Dashboard → Settings → Payment:</p>
                  <CopyUrl url={saved.midtrans_webhook_url} />
                </div>
              </div>
            </div>
          ) : (
            <div className={`${card} space-y-5`}>
              <p className="font-extrabold text-ink">Xendit</p>

              {xenditProblem ? <Status ok={false}>{xenditProblem}</Status>
                : <Status ok>Xendit {saved.xendit_key_status === 'live' ? 'Live' : 'Test mode'} siap dipakai</Status>}

              <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl px-4 py-3 text-xs font-semibold text-amber-700 space-y-3">
                <p className="text-amber-800 font-extrabold">Cara menyambungkan Xendit</p>
                <ol className="list-decimal pl-4 space-y-1.5">
                  <li>Di Xendit Dashboard → <strong>Settings → API Keys</strong>, buat Secret Key dengan izin <strong>Money-in: Write</strong>. Isi di {envNote}: <code className="bg-amber-100 px-1 rounded font-mono">XENDIT_SECRET_KEY=xnd_…</code></li>
                  <li>Di <strong>Settings → Webhooks</strong>, salin <strong>Verification Token</strong> ke <code className="bg-amber-100 px-1 rounded font-mono">XENDIT_CALLBACK_TOKEN=…</code></li>
                  <li>Masih di Webhooks, isi URL <strong>Invoices paid</strong> dengan:</li>
                </ol>
                <CopyUrl url={saved.xendit_webhook_url} />
                <p>Key test (<code className="font-mono">xnd_development_…</code>) untuk mencoba, key live (<code className="font-mono">xnd_production_…</code>) untuk transaksi nyata.</p>
              </div>
            </div>
          )}

          <button
            onClick={() => save.mutate()}
            disabled={save.isPending || (gateway === 'midtrans' && looksLikeServerKey)}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-brand-500 text-white font-extrabold text-sm rounded-2xl border-2 border-ink shadow-cartoon hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-cartoon-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-100"
          >
            <Settings2 className="w-4 h-4" strokeWidth={2.5} />
            {save.isPending ? 'Menyimpan…' : 'Simpan Pengaturan'}
          </button>
        </>
      )}
    </div>
  )
}
