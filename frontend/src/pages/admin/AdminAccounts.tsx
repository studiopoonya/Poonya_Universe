import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Pencil, Trash2, ShieldCheck, User, X, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/axios'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'

// ─── types ────────────────────────────────────────────────────────────────────

interface Account {
  id: number
  name: string
  email: string
  role: 'admin' | 'staff'
  permissions: string[] | null
  two_factor_enabled?: boolean
  created_at: string
}

// ─── constants ────────────────────────────────────────────────────────────────

const PAGE_PERMS = [
  { key: 'bookings', label: 'Bookings' },
  { key: 'studios',  label: 'Studio'   },
  { key: 'payment',  label: 'Payment'  },
  { key: 'promos',   label: 'Promo'    },
  { key: 'settings', label: 'Settings' },
]

// ─── modal ────────────────────────────────────────────────────────────────────

interface FormState {
  name: string
  email: string
  password: string
  role: 'admin' | 'staff'
  permissions: string[]
}

const EMPTY_FORM: FormState = {
  name: '', email: '', password: '', role: 'staff', permissions: ['bookings'],
}

function AccountModal({
  account,
  onClose,
}: {
  account: Account | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const isEdit = !!account

  const [form, setForm]         = useState<FormState>(() =>
    account
      ? { name: account.name, email: account.email, password: '', role: account.role, permissions: account.permissions ?? [] }
      : { ...EMPTY_FORM }
  )
  const [showPass, setShowPass] = useState(false)

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm(f => ({ ...f, [k]: v }))

  const togglePerm = (key: string) =>
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(key)
        ? f.permissions.filter(p => p !== key)
        : [...f.permissions, key],
    }))

  const mutation = useMutation({
    mutationFn: (data: FormState) => {
      const payload = {
        name:        data.name,
        email:       data.email,
        role:        data.role,
        permissions: data.role === 'admin' ? null : data.permissions,
        ...(data.password ? { password: data.password } : {}),
      }
      return isEdit
        ? api.put(`/admin/accounts/${account.id}`, payload)
        : api.post('/admin/accounts', { ...payload, password: data.password })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'accounts'] })
      toast.success(isEdit ? 'Akun diperbarui.' : 'Akun dibuat.')
      onClose()
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message ?? 'Gagal menyimpan akun.'
      toast.error(msg)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isEdit && !form.password) { toast.error('Password wajib diisi.'); return }
    mutation.mutate(form)
  }

  const inputClass =
    'w-full px-4 py-2.5 rounded-2xl border-2 border-ink text-sm font-semibold text-ink placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500/30 shadow-cartoon-sm transition-all'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        className="bg-white rounded-3xl border-2 border-ink shadow-cartoon-xl w-full max-w-md max-h-[92vh] overflow-y-auto"
      >
        {/* header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b-2 border-ink">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-500 border-2 border-ink shadow-cartoon-sm flex items-center justify-center">
              <User className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <p className="font-extrabold text-ink text-base">
              {isEdit ? 'Edit Akun' : 'Tambah Akun'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl border-2 border-ink bg-white shadow-cartoon-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-cartoon active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all duration-100 flex items-center justify-center"
          >
            <X className="w-4 h-4 text-ink" strokeWidth={2.5} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* name */}
          <div>
            <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Nama</label>
            <input
              required value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Nama lengkap" className={inputClass}
            />
          </div>

          {/* email */}
          <div>
            <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Email</label>
            <input
              required type="email" value={form.email}
              onChange={e => set('email', e.target.value)}
              placeholder="email@contoh.com" className={inputClass}
            />
          </div>

          {/* password */}
          <div>
            <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">
              Password {isEdit && <span className="text-gray-300 normal-case font-semibold">(kosongkan jika tidak diubah)</span>}
            </label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={form.password}
                onChange={e => set('password', e.target.value)}
                placeholder={isEdit ? '••••••••' : 'Min. 8 karakter'}
                className={inputClass + ' pr-11'}
              />
              <button
                type="button"
                onClick={() => setShowPass(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* role */}
          <div>
            <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-2">Role</label>
            <div className="grid grid-cols-2 gap-3">
              {(['admin', 'staff'] as const).map(r => (
                <button
                  key={r} type="button"
                  onClick={() => set('role', r)}
                  className={`py-2.5 rounded-2xl border-2 text-sm font-extrabold transition-all duration-100 capitalize ${
                    form.role === r
                      ? 'border-ink bg-brand-500 text-white shadow-cartoon-sm -translate-x-0.5 -translate-y-0.5'
                      : 'border-ink bg-white text-gray-500 shadow-cartoon-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-cartoon'
                  }`}
                >
                  {r === 'admin' ? '👑 Admin' : '👤 Staff'}
                </button>
              ))}
            </div>
          </div>

          {/* permissions (staff only) */}
          <AnimatePresence>
            {form.role === 'staff' && (
              <motion.div
                key="perms"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-2">
                  Akses Halaman
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {PAGE_PERMS.map(p => {
                    const checked = form.permissions.includes(p.key)
                    return (
                      <button
                        key={p.key} type="button"
                        onClick={() => togglePerm(p.key)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-extrabold transition-all duration-100 ${
                          checked
                            ? 'border-brand-500 bg-brand-50 text-brand-500'
                            : 'border-ink bg-white text-gray-400 hover:border-brand-300'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center transition-colors ${
                          checked ? 'border-brand-500 bg-brand-500' : 'border-gray-300'
                        }`}>
                          {checked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>}
                        </div>
                        {p.label}
                      </button>
                    )
                  })}
                </div>
                <p className="text-[10px] font-bold text-gray-300 mt-2">Dashboard selalu bisa diakses oleh staff.</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button" onClick={onClose}
              className="flex-1 py-3 rounded-2xl border-2 border-ink text-sm font-extrabold text-gray-600 bg-white shadow-cartoon-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-cartoon active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all duration-100"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 py-3 rounded-2xl border-2 border-ink text-sm font-extrabold text-white bg-brand-500 shadow-cartoon hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-cartoon-lg disabled:opacity-50 disabled:cursor-not-allowed active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all duration-100"
            >
              {mutation.isPending ? 'Menyimpan…' : isEdit ? 'Simpan' : 'Buat Akun'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ─── delete confirm ───────────────────────────────────────────────────────────

function DeleteConfirm({ account, onClose }: { account: Account; onClose: () => void }) {
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => api.delete(`/admin/accounts/${account.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'accounts'] })
      toast.success('Akun dihapus.')
      onClose()
    },
    onError: (err: any) => toast.error(err.response?.data?.message ?? 'Gagal menghapus.'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.92 }}
        className="bg-white rounded-3xl border-2 border-ink shadow-cartoon-xl w-full max-w-sm p-6 text-center"
      >
        <div className="w-14 h-14 rounded-2xl bg-rose-100 border-2 border-ink shadow-cartoon-sm flex items-center justify-center mx-auto mb-4">
          <Trash2 className="w-6 h-6 text-rose-500" strokeWidth={2.5} />
        </div>
        <p className="font-extrabold text-ink text-lg mb-1">Hapus Akun?</p>
        <p className="text-sm font-semibold text-gray-400 mb-6">
          <span className="text-ink">{account.name}</span> akan dihapus permanen.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-2xl border-2 border-ink text-sm font-extrabold bg-white shadow-cartoon-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-cartoon active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all duration-100">
            Batal
          </button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
            className="flex-1 py-3 rounded-2xl border-2 border-ink text-sm font-extrabold text-white bg-rose-500 shadow-cartoon hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-cartoon-lg disabled:opacity-50 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all duration-100">
            {mutation.isPending ? 'Menghapus…' : 'Ya, Hapus'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── main ─────────────────────────────────────────────────────────────────────

function getCurrentUserId(): number | null {
  try { return JSON.parse(localStorage.getItem('user') || 'null')?.id ?? null } catch { return null }
}

export default function AdminAccounts() {
  const currentUserId = getCurrentUserId()
  const [modalAccount, setModalAccount] = useState<Account | null | 'new'>('new' as any)
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null)
  const [showModal,    setShowModal]    = useState(false)

  const qc = useQueryClient()
  const resetTwoFactor = useMutation({
    mutationFn: (acc: Account) => api.patch(`/admin/accounts/${acc.id}/reset-two-factor`),
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ['admin', 'accounts'] }); toast.success(res.data.message) },
    onError: (err: any) => toast.error(err.response?.data?.message ?? 'Gagal mereset.'),
  })

  const { data: accounts = [], isLoading } = useQuery<Account[]>({
    queryKey: ['admin', 'accounts'],
    queryFn: () => api.get('/admin/accounts').then(r => r.data),
  })

  const openNew  = () => { setModalAccount(null); setShowModal(true) }
  const openEdit = (a: Account) => { setModalAccount(a); setShowModal(true) }
  const closeModal = () => setShowModal(false)

  return (
    <div className="max-w-4xl mx-auto">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">Accounts</h1>
          <p className="text-sm font-semibold text-gray-400 mt-0.5">Kelola akun admin dan staff.</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-5 py-2.5 bg-brand-500 text-white text-sm font-extrabold rounded-2xl border-2 border-ink shadow-cartoon hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-cartoon-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all duration-100"
        >
          <Plus className="w-4 h-4" strokeWidth={3} />
          Tambah Akun
        </button>
      </div>

      {/* list */}
      <div className="space-y-3">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 rounded-3xl bg-white border-2 border-ink shadow-cartoon animate-pulse" />
            ))
          : accounts.map(acc => (
              <motion.div
                key={acc.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl border-2 border-ink shadow-cartoon hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-cartoon-lg transition-all duration-100 px-6 py-5 flex items-center gap-4"
              >
                {/* avatar */}
                <div className={`w-12 h-12 rounded-2xl border-2 border-ink shadow-cartoon-sm flex items-center justify-center text-white font-extrabold text-lg shrink-0 ${
                  acc.role === 'admin' ? 'bg-brand-500' : 'bg-amber-400'
                }`}>
                  {acc.name.charAt(0).toUpperCase()}
                </div>

                {/* info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-extrabold text-ink text-sm">{acc.name}</p>
                    {acc.id === currentUserId && (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-brand-500 text-white border-2 border-ink">
                        Kamu
                      </span>
                    )}
                    <span className={`flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full border-2 ${
                      acc.role === 'admin'
                        ? 'bg-brand-50 text-brand-500 border-brand-300'
                        : 'bg-amber-50 text-amber-600 border-amber-300'
                    }`}>
                      {acc.role === 'admin' ? <ShieldCheck className="w-2.5 h-2.5" strokeWidth={3} /> : <User className="w-2.5 h-2.5" strokeWidth={3} />}
                      {acc.role === 'admin' ? 'Admin' : 'Staff'}
                    </span>
                    {acc.two_factor_enabled && (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-green-50 text-green-600 border-2 border-green-300">2FA</span>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-gray-400 truncate mb-2">{acc.email}</p>

                  {/* permissions */}
                  <div className="flex flex-wrap gap-1">
                    {acc.role === 'admin' ? (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-brand-500 text-white border-2 border-ink">
                        All Pages
                      </span>
                    ) : acc.permissions && acc.permissions.length > 0 ? (
                      acc.permissions.map(p => (
                        <span key={p} className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-surface-subtle text-ink border-2 border-ink capitalize">
                          {PAGE_PERMS.find(x => x.key === p)?.label ?? p}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 border-2 border-gray-200">
                        No Access
                      </span>
                    )}
                  </div>
                </div>

                {/* meta */}
                <div className="text-right shrink-0 mr-2">
                  <p className="text-[10px] font-bold text-gray-300">Dibuat</p>
                  <p className="text-xs font-extrabold text-gray-400">
                    {format(new Date(acc.created_at), 'd MMM yyyy', { locale: idLocale })}
                  </p>
                </div>

                {/* actions */}
                <div className="flex gap-2 shrink-0">
                  {acc.two_factor_enabled && acc.id !== currentUserId && (
                    <button
                      onClick={() => { if (confirm(`Reset verifikasi 2 langkah ${acc.name}? Dia akan logout dan bisa login hanya dengan password.`)) resetTwoFactor.mutate(acc) }}
                      title="Reset 2FA (HP hilang)"
                      className="h-9 px-2.5 rounded-xl border-2 border-ink bg-white shadow-cartoon-sm text-[10px] font-extrabold text-gray-500"
                    >
                      Reset 2FA
                    </button>
                  )}
                  <button
                    onClick={() => openEdit(acc)}
                    className="w-9 h-9 rounded-xl border-2 border-ink bg-white shadow-cartoon-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-cartoon active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all duration-100 flex items-center justify-center"
                  >
                    <Pencil className="w-4 h-4 text-ink" strokeWidth={2.5} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(acc)}
                    className="w-9 h-9 rounded-xl border-2 border-ink bg-white shadow-cartoon-sm hover:bg-rose-50 hover:border-rose-300 hover:shadow-[3px_3px_0_#fca5a5] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all duration-100 flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4 text-rose-400" strokeWidth={2.5} />
                  </button>
                </div>
              </motion.div>
            ))}

        {!isLoading && accounts.length === 0 && (
          <div className="text-center py-16 bg-white rounded-3xl border-2 border-ink shadow-cartoon">
            <p className="text-4xl mb-3">👤</p>
            <p className="font-extrabold text-ink">Belum ada akun.</p>
            <p className="text-sm font-semibold text-gray-400 mt-1">Tambah akun admin atau staff baru.</p>
          </div>
        )}
      </div>

      {/* modals */}
      <AnimatePresence>
        {showModal && (
          <AccountModal
            key="account-modal"
            account={modalAccount as Account | null}
            onClose={closeModal}
          />
        )}
        {deleteTarget && (
          <DeleteConfirm
            key="delete-confirm"
            account={deleteTarget}
            onClose={() => setDeleteTarget(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
