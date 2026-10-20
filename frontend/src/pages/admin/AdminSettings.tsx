import { useEffect, useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Settings2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/axios'

interface MidtransSettings {
  midtrans_snap_url: string
  midtrans_client_key: string
  midtrans_is_production: string
}

const DEFAULTS: MidtransSettings = {
  midtrans_snap_url:      'https://app.sandbox.midtrans.com/snap/snap.js',
  midtrans_client_key:    '',
  midtrans_is_production: '0',
}

type ServerKeyStatus = 'missing' | 'invalid' | 'sandbox' | 'production'

const PROD_SNAP = 'https://app.midtrans.com/snap/snap.js'
const SBX_SNAP  = 'https://app.sandbox.midtrans.com/snap/snap.js'

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs font-semibold text-gray-400 mt-1.5">{hint}</p>}
    </div>
  )
}

export default function AdminSettings() {
  const { data: saved, isLoading } = useQuery<Partial<MidtransSettings> & { server_key_status?: ServerKeyStatus }>({
    queryKey: ['admin', 'settings'],
    queryFn: () => api.get('/admin/settings').then((r) => r.data),
  })

  const [form, setForm] = useState<MidtransSettings>(DEFAULTS)
  const set = (k: keyof MidtransSettings, v: string) => setForm((f) => ({ ...f, [k]: v }))

  useEffect(() => {
    if (saved) setForm({ ...DEFAULTS, ...saved })
  }, [saved])

  const isProd = form.midtrans_is_production === '1'

  const toggleEnv = () => {
    const next = isProd ? '0' : '1'
    setForm((f) => ({
      ...f,
      midtrans_is_production: next,
      midtrans_snap_url: next === '1' ? PROD_SNAP : SBX_SNAP,
    }))
  }

  const mutation = useMutation({
    mutationFn: () => api.put('/admin/settings', {
      midtrans_snap_url:      form.midtrans_snap_url,
      midtrans_client_key:    form.midtrans_client_key,
      midtrans_is_production: form.midtrans_is_production === '1',
    }),
    onSuccess: () => toast.success('Pengaturan disimpan.'),
    onError:   () => toast.error('Gagal menyimpan.'),
  })

  const inputCls =
    'w-full px-4 py-3 rounded-2xl border-2 border-ink text-sm font-semibold text-ink placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500/30 shadow-cartoon-sm transition-all font-mono'

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-ink">Pengaturan</h1>
        <p className="text-sm font-semibold text-gray-400 mt-0.5">Konfigurasi integrasi payment gateway.</p>
      </div>

      {/* Midtrans card */}
      <div className="bg-white rounded-3xl border-2 border-ink shadow-cartoon p-6 mb-5">
        <div className="flex items-center gap-3 mb-5 pb-4 border-b-2 border-ink">
          <div className="w-11 h-11 rounded-2xl bg-[#003d79] border-2 border-ink shadow-cartoon-sm flex items-center justify-center shrink-0">
            <span className="text-white font-extrabold text-xs">MT</span>
          </div>
          <div>
            <p className="font-extrabold text-ink">Midtrans</p>
            <p className="text-xs font-semibold text-gray-400">Payment gateway untuk QRIS & online payment</p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded-2xl bg-surface-subtle animate-pulse border-2 border-ink" />
            ))}
          </div>
        ) : (
          <div className="space-y-5">
            {/* Environment toggle */}
            <Field label="Environment">
              <div className="flex items-center gap-4 mt-1">
                <button
                  type="button" onClick={toggleEnv}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full border-2 border-ink shadow-cartoon-sm transition-colors ${isProd ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white border-2 border-ink shadow transition-transform ${isProd ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
                <div>
                  <span className={`text-sm font-extrabold ${isProd ? 'text-green-600' : 'text-amber-600'}`}>
                    {isProd ? 'Production' : 'Sandbox'}
                  </span>
                  <p className="text-xs font-semibold text-gray-400">
                    {isProd ? 'Transaksi nyata — gunakan key production' : 'Mode testing — gunakan key sandbox'}
                  </p>
                </div>
              </div>
            </Field>

            {/* Snap URL */}
            <Field label="Snap URL" hint="URL script Midtrans Snap (otomatis berubah saat ganti environment)">
              <input
                value={form.midtrans_snap_url}
                onChange={(e) => set('midtrans_snap_url', e.target.value)}
                className={inputCls} placeholder={SBX_SNAP}
              />
            </Field>

            {/* Client Key */}
            <Field label="Client Key" hint="Dipakai di frontend untuk membuka Snap popup. Aman untuk di-expose.">
              <input
                value={form.midtrans_client_key}
                onChange={(e) => set('midtrans_client_key', e.target.value)}
                className={inputCls}
                placeholder={isProd ? 'Mid-client-xxxx' : 'SB-Mid-client-xxxx'}
              />
            </Field>

            {/* Server key problems block every payment — make them impossible to miss */}
            {saved?.server_key_status && (() => {
              const st = saved.server_key_status
              const problem =
                st === 'missing' || st === 'invalid'
                  ? 'Server key belum diisi atau masih contoh. Semua pembayaran akan gagal ("Pembayaran sedang tidak bisa diproses").'
                  : st === 'sandbox' && isProd
                    ? 'Environment Production, tapi server key di .env adalah key Sandbox. Pembayaran akan gagal.'
                    : st === 'production' && !isProd
                      ? 'Environment Sandbox, tapi server key di .env adalah key Production. Pembayaran akan gagal.'
                      : null
              return problem ? (
                <div className="bg-rose-50 border-2 border-rose-400 rounded-2xl shadow-[3px_3px_0_#fb7185] px-4 py-3">
                  <p className="text-xs font-extrabold text-rose-700">⚠️ Pembayaran tidak akan berjalan</p>
                  <p className="text-xs font-semibold text-rose-600 mt-0.5">{problem}</p>
                </div>
              ) : (
                <div className="bg-green-50 border-2 border-green-400 rounded-2xl px-4 py-3">
                  <p className="text-xs font-extrabold text-green-700">✓ Server key {st === 'sandbox' ? 'Sandbox' : 'Production'} terpasang</p>
                </div>
              )
            })()}

            {/* Server Key info */}
            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl shadow-[3px_3px_0_#fbbf24] px-4 py-3">
              <p className="text-xs font-extrabold text-amber-700">Server Key</p>
              <p className="text-xs font-semibold text-amber-600 mt-0.5">
                Server key <strong>tidak</strong> disimpan di sini karena bersifat rahasia.
                Set <code className="bg-amber-100 px-1 rounded font-mono">MIDTRANS_SERVER_KEY</code> di file{' '}
                <code className="bg-amber-100 px-1 rounded font-mono">.env</code> backend.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Save button */}
      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending || isLoading}
        className="w-full flex items-center justify-center gap-2 py-3.5 bg-brand-500 text-white font-extrabold text-sm rounded-2xl border-2 border-ink shadow-cartoon hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-cartoon-lg disabled:opacity-50 disabled:cursor-not-allowed active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all duration-100"
      >
        <Settings2 className="w-4 h-4" strokeWidth={2.5} />
        {mutation.isPending ? 'Menyimpan…' : 'Simpan Pengaturan'}
      </button>
    </div>
  )
}
