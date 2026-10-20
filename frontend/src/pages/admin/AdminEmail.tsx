import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Mail, Send, Eye, EyeOff, BellRing } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/axios'
import Select from '@/components/ui/Select'

interface MailForm {
  mail_host: string
  mail_port: string
  mail_encryption: 'tls' | 'ssl'
  mail_username: string
  mail_password: string
  mail_from_address: string
  mail_from_name: string
  admin_notify_email: string
}

interface SavedMail extends Partial<Omit<MailForm, 'mail_password'>> {
  has_password: boolean
}

const DEFAULTS: MailForm = {
  mail_host: '', mail_port: '587', mail_encryption: 'tls',
  mail_username: '', mail_password: '', mail_from_address: '', mail_from_name: 'Poonya Studio',
  admin_notify_email: '',
}

const PRESETS = [
  { label: 'Gmail',   host: 'smtp.gmail.com',      port: '587', enc: 'tls' as const },
  { label: 'Outlook', host: 'smtp.office365.com',  port: '587', enc: 'tls' as const },
  { label: 'Zoho',    host: 'smtp.zoho.com',       port: '465', enc: 'ssl' as const },
]

function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs font-semibold text-gray-400 mt-1.5">{hint}</p>}
    </div>
  )
}

const inputCls =
  'w-full px-4 py-3 rounded-2xl border-2 border-ink text-sm font-semibold text-ink placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500/30 shadow-cartoon-sm transition-all'

export default function AdminEmail() {
  const qc = useQueryClient()
  const { data: saved, isLoading } = useQuery<SavedMail>({
    queryKey: ['admin', 'mail-settings'],
    queryFn: () => api.get('/admin/mail-settings').then((r) => r.data),
  })

  const [form, setForm]         = useState<MailForm>(DEFAULTS)
  const [showPass, setShowPass] = useState(false)
  const [testTo, setTestTo]     = useState('')
  const set = (k: keyof MailForm, v: string) => setForm((f) => ({ ...f, [k]: v }))

  useEffect(() => {
    if (!saved) return
    const { has_password, ...rest } = saved
    const filled = Object.fromEntries(Object.entries(rest).filter(([, v]) => v != null && v !== ''))
    setForm({ ...DEFAULTS, ...filled, mail_port: String(rest.mail_port ?? DEFAULTS.mail_port), mail_password: '' })
  }, [saved])

  // Username is usually the same address as the sender — fill it in to save typing
  const setFrom = (v: string) =>
    setForm((f) => ({ ...f, mail_from_address: v, mail_username: f.mail_username === f.mail_from_address ? v : f.mail_username }))

  const save = useMutation({
    mutationFn: () => api.put('/admin/mail-settings', { ...form, mail_port: Number(form.mail_port) }),
    onSuccess: () => {
      toast.success('Email pengirim disimpan.')
      qc.invalidateQueries({ queryKey: ['admin', 'mail-settings'] })
    },
    onError: (err: any) => toast.error(err.response?.data?.message ?? 'Gagal menyimpan.'),
  })

  const test = useMutation({
    mutationFn: () => api.post('/admin/mail-settings/test', { to: testTo }),
    onSuccess: (res) => toast.success(res.data.message),
    onError: (err: any) => toast.error(err.response?.data?.message ?? 'Gagal mengirim email tes.', { duration: 8000 }),
  })

  const configured = !!saved?.mail_host && !!saved?.mail_from_address

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-ink">Email Pengirim</h1>
        <p className="text-sm font-semibold text-gray-400 mt-0.5">
          Semua email ke customer (konfirmasi booking, dll.) dikirim dari akun ini.
        </p>
      </div>

      <div className="bg-white rounded-3xl border-2 border-ink shadow-cartoon p-6 mb-5">
        <div className="flex items-center gap-3 mb-5 pb-4 border-b-2 border-ink">
          <div className="w-11 h-11 rounded-2xl bg-brand-500 border-2 border-ink shadow-cartoon-sm flex items-center justify-center shrink-0">
            <Mail className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-extrabold text-ink">Akun SMTP</p>
            <p className="text-xs font-semibold text-gray-400 truncate">
              {configured ? `Aktif: ${saved?.mail_from_address}` : 'Belum diatur — email belum terkirim ke customer'}
            </p>
          </div>
          <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border-2 border-ink ${configured ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
            {configured ? 'Aktif' : 'Belum'}
          </span>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 rounded-2xl bg-surface-subtle animate-pulse border-2 border-ink" />
            ))}
          </div>
        ) : (
          <div className="space-y-5">
            <Field label="Nama Pengirim" hint="Nama yang muncul di inbox customer.">
              <input value={form.mail_from_name} onChange={(e) => set('mail_from_name', e.target.value)} className={inputCls} placeholder="Poonya Studio" />
            </Field>

            <Field label="Email Pengirim">
              <input type="email" value={form.mail_from_address} onChange={(e) => setFrom(e.target.value)} className={inputCls} placeholder="studio@gmail.com" />
            </Field>

            <Field label="Provider">
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.label} type="button"
                    onClick={() => setForm((f) => ({ ...f, mail_host: p.host, mail_port: p.port, mail_encryption: p.enc }))}
                    className={`px-4 py-2 rounded-xl text-xs font-extrabold border-2 border-ink shadow-cartoon-sm transition-all duration-100 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-cartoon
                      ${form.mail_host === p.host ? 'bg-brand-500 text-white' : 'bg-white text-ink'}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </Field>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-3 sm:col-span-2">
                <Field label="SMTP Host">
                  <input value={form.mail_host} onChange={(e) => set('mail_host', e.target.value)} className={`${inputCls} font-mono`} placeholder="smtp.gmail.com" />
                </Field>
              </div>
              <div className="col-span-1">
                <Field label="Port">
                  <input inputMode="numeric" value={form.mail_port} onChange={(e) => set('mail_port', e.target.value.replace(/\D/g, ''))} className={`${inputCls} font-mono`} placeholder="587" />
                </Field>
              </div>
              <div className="col-span-2 sm:col-span-3">
                <Field label="Keamanan">
                  <Select
                    value={form.mail_encryption} onChange={(v) => set('mail_encryption', v)}
                    options={[
                      { value: 'tls', label: 'TLS', hint: 'Port 587 — Gmail, Outlook' },
                      { value: 'ssl', label: 'SSL', hint: 'Port 465 — Zoho, dll.' },
                    ]}
                  />
                </Field>
              </div>
            </div>

            <Field label="Username">
              <input value={form.mail_username} onChange={(e) => set('mail_username', e.target.value)} className={`${inputCls} font-mono`} placeholder="studio@gmail.com" autoComplete="off" />
            </Field>

            <Field
              label="Password"
              hint={form.mail_host === 'smtp.gmail.com'
                ? <>Gmail wajib pakai <strong>App Password</strong> (bukan password login). Buat di myaccount.google.com → Keamanan → Sandi Aplikasi. Verifikasi 2 langkah harus aktif.</>
                : saved?.has_password ? 'Kosongkan jika tidak ingin mengganti password.' : undefined}
            >
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.mail_password}
                  onChange={(e) => set('mail_password', e.target.value)}
                  className={`${inputCls} font-mono pr-12`}
                  placeholder={saved?.has_password ? '•••••••• (tersimpan)' : 'Password / App Password'}
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowPass((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-ink">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </Field>
          </div>
        )}
      </div>

      <div className="bg-white rounded-3xl border-2 border-ink shadow-cartoon p-6 mb-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-amber-400 border-2 border-ink shadow-cartoon-sm flex items-center justify-center shrink-0">
            <BellRing className="w-5 h-5 text-ink" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <p className="font-extrabold text-ink">Notifikasi Booking Masuk</p>
            <p className="text-xs font-semibold text-gray-400">Email ke studio setiap ada booking baru, reservasi bayar di studio, atau jadwal diubah.</p>
          </div>
        </div>
        <Field label="Kirim ke" hint="Pisahkan dengan koma untuk lebih dari satu. Kosongkan = dikirim ke semua akun admin.">
          <input
            value={form.admin_notify_email} onChange={(e) => set('admin_notify_email', e.target.value)}
            className={inputCls} placeholder="studiopoonya@gmail.com" inputMode="email" autoComplete="off"
          />
        </Field>
        <p className="text-xs font-semibold text-gray-400 mt-3">
          Customer juga otomatis dapat email pengingat <strong>H-1</strong> (jam 09.00) sebelum jadwal fotonya.
        </p>
      </div>

      <button
        onClick={() => save.mutate()}
        disabled={save.isPending || isLoading}
        className="w-full flex items-center justify-center gap-2 py-3.5 mb-5 bg-brand-500 text-white font-extrabold text-sm rounded-2xl border-2 border-ink shadow-cartoon hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-cartoon-lg disabled:opacity-50 disabled:cursor-not-allowed active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all duration-100"
      >
        <Mail className="w-4 h-4" strokeWidth={2.5} />
        {save.isPending ? 'Menyimpan…' : 'Simpan Pengaturan Email'}
      </button>

      {/* Test */}
      <div className="bg-white rounded-3xl border-2 border-ink shadow-cartoon p-6">
        <p className="font-extrabold text-ink mb-1">Kirim Email Tes</p>
        <p className="text-xs font-semibold text-gray-400 mb-4">Simpan dulu, lalu kirim tes untuk memastikan email bisa terkirim.</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} className={inputCls} placeholder="email-kamu@gmail.com" />
          <button
            onClick={() => test.mutate()}
            disabled={!testTo || !configured || test.isPending}
            className="shrink-0 flex items-center justify-center gap-2 px-5 py-3 bg-amber-400 text-ink font-extrabold text-sm rounded-2xl border-2 border-ink shadow-cartoon-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-cartoon disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-100"
          >
            <Send className="w-4 h-4" strokeWidth={2.5} />
            {test.isPending ? 'Mengirim…' : 'Kirim Tes'}
          </button>
        </div>
      </div>
    </div>
  )
}
