import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Pencil, Trash2, X, Ticket } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/axios'
import DatePicker from '@/components/ui/DatePicker'

interface Promo {
  id: number
  code: string
  type: 'percent' | 'fixed'
  value: number
  max_uses: number | null
  starts_at: string | null
  ends_at: string | null
  is_active: boolean
  used_count: number
  label: string
}

const EMPTY = { code: '', type: 'percent' as 'percent' | 'fixed', value: '', max_uses: '', starts_at: '', ends_at: '', is_active: true }
type Form = typeof EMPTY

const inputCls = 'w-full px-4 py-3 rounded-2xl border-2 border-ink text-sm font-semibold text-ink placeholder-gray-300 bg-white shadow-cartoon-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30'
const labelCls = 'block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1.5'

function PromoModal({ promo, onClose }: { promo: Promo | null; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState<Form>(promo ? {
    code: promo.code, type: promo.type, value: String(promo.value),
    max_uses: promo.max_uses ? String(promo.max_uses) : '',
    starts_at: promo.starts_at ?? '', ends_at: promo.ends_at ?? '', is_active: promo.is_active,
  } : EMPTY)
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }))

  const save = useMutation({
    mutationFn: () => {
      const body = {
        ...form,
        value: Number(form.value),
        max_uses: form.max_uses ? Number(form.max_uses) : null,
        starts_at: form.starts_at || null,
        ends_at: form.ends_at || null,
      }
      return promo ? api.put(`/admin/promo-codes/${promo.id}`, body) : api.post('/admin/promo-codes', body)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'promos'] })
      toast.success(promo ? 'Promo diperbarui!' : 'Promo dibuat!')
      onClose()
    },
    onError: (err: any) => toast.error(err.response?.data?.message ?? 'Gagal menyimpan.'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm">
      <motion.form
        initial={{ opacity: 0, scale: 0.93, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.93, y: 16 }}
        onSubmit={(e) => { e.preventDefault(); save.mutate() }}
        className="bg-white rounded-3xl border-2 border-ink shadow-cartoon-xl w-full max-w-md max-h-[92vh] overflow-y-auto p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-ink">{promo ? 'Edit Promo' : 'Promo Baru'}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-ink"><X className="w-5 h-5" /></button>
        </div>

        <div>
          <label className={labelCls}>Kode</label>
          <input required value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} className={`${inputCls} uppercase font-mono`} placeholder="LEBARAN25" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Jenis</label>
            <select value={form.type} onChange={(e) => set('type', e.target.value as Form['type'])} className={inputCls}>
              <option value="percent">Persen (%)</option>
              <option value="fixed">Potongan (Rp)</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>{form.type === 'percent' ? 'Diskon (%)' : 'Potongan (Rp)'}</label>
            <input required type="number" min={1} max={form.type === 'percent' ? 100 : undefined} value={form.value} onChange={(e) => set('value', e.target.value)} className={inputCls} placeholder={form.type === 'percent' ? '20' : '15000'} />
          </div>
        </div>

        <div>
          <label className={labelCls}>Kuota pemakaian</label>
          <input type="number" min={1} value={form.max_uses} onChange={(e) => set('max_uses', e.target.value)} className={inputCls} placeholder="Kosongkan = tanpa batas" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Mulai</label>
            <DatePicker value={form.starts_at} onChange={(v) => set('starts_at', v)} clearable placeholder="Langsung" />
          </div>
          <div>
            <label className={labelCls}>Berakhir</label>
            <DatePicker value={form.ends_at} onChange={(v) => set('ends_at', v)} min={form.starts_at || undefined} clearable placeholder="Tanpa batas" />
          </div>
        </div>

        <label className="flex items-center gap-3 text-sm font-extrabold text-ink">
          <input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} className="w-4 h-4 accent-brand-500" />
          Aktif
        </label>

        <button
          type="submit" disabled={save.isPending}
          className="w-full py-3.5 bg-brand-500 text-white font-extrabold text-sm rounded-2xl border-2 border-ink shadow-cartoon disabled:opacity-50"
        >
          {save.isPending ? 'Menyimpan…' : 'Simpan'}
        </button>
      </motion.form>
    </div>
  )
}

export default function AdminPromos() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<Promo | null | 'new'>(null)

  const { data: promos = [], isLoading } = useQuery<Promo[]>({
    queryKey: ['admin', 'promos'],
    queryFn: () => api.get('/admin/promo-codes').then((r) => r.data),
  })

  const remove = useMutation({
    mutationFn: (p: Promo) => api.delete(`/admin/promo-codes/${p.id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'promos'] }); toast.success('Promo dihapus.') },
    onError: (err: any) => toast.error(err.response?.data?.message ?? 'Gagal menghapus.'),
  })

  const period = (p: Promo) =>
    p.starts_at || p.ends_at ? `${p.starts_at ?? '…'} s/d ${p.ends_at ?? '…'}` : 'Tanpa batas waktu'

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">Kode Promo</h1>
          <p className="text-sm font-semibold text-gray-400 mt-0.5">Diskon yang bisa dipakai customer saat booking.</p>
        </div>
        <button
          onClick={() => setEditing('new')}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-brand-500 text-white text-sm font-extrabold border-2 border-ink shadow-cartoon-sm"
        >
          <Plus className="w-4 h-4" strokeWidth={3} /> Promo Baru
        </button>
      </div>

      {isLoading ? (
        <div className="h-32 rounded-3xl bg-surface-subtle animate-pulse border-2 border-ink" />
      ) : promos.length === 0 ? (
        <div className="bg-white rounded-3xl border-2 border-ink shadow-cartoon py-16 text-center">
          <Ticket className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-extrabold text-gray-400">Belum ada kode promo.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {promos.map((p) => (
            <div key={p.id} className="bg-white rounded-3xl border-2 border-ink shadow-cartoon p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <p className="font-mono text-lg font-extrabold text-ink truncate">{p.code}</p>
                  <p className="text-sm font-bold text-brand-500">{p.label}</p>
                </div>
                <span className={`shrink-0 text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border-2 border-ink ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                  {p.is_active ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>
              <p className="text-xs font-semibold text-gray-400">{period(p)}</p>
              <p className="text-xs font-semibold text-gray-400">
                Dipakai {p.used_count}{p.max_uses ? ` / ${p.max_uses}` : ''} kali
              </p>
              <div className="flex gap-2 mt-4">
                <button onClick={() => setEditing(p)} className="flex items-center gap-1 text-xs font-extrabold px-3 py-1.5 rounded-xl border-2 border-ink bg-white shadow-cartoon-sm">
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  onClick={() => { if (confirm(`Hapus promo ${p.code}?`)) remove.mutate(p) }}
                  className="flex items-center gap-1 text-xs font-extrabold px-3 py-1.5 rounded-xl border-2 border-red-300 bg-red-50 text-red-500"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Hapus
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {editing && <PromoModal promo={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      </AnimatePresence>
    </div>
  )
}
