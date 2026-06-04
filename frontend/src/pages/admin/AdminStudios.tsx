import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Pencil, Trash2, ImagePlus, X, Users, BadgeCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/axios'
import { formatIDR } from '@/lib/utils'
import type { Studio } from '@/types'

// ─── api ──────────────────────────────────────────────────────────────────────

function useAdminStudios() {
  return useQuery<Studio[]>({
    queryKey: ['admin', 'studios'],
    queryFn: () => api.get('/admin/studios').then((r) => r.data),
  })
}

// ─── form helpers ─────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  name: '', description: '', price: '', capacity: '',
  features: '', color: '#7C3AED', is_active: true,
}
type FormState = typeof EMPTY_FORM

function fromStudio(s: Studio): FormState {
  return {
    name:        s.name,
    description: s.description,
    price:       String(s.price),
    capacity:    String(s.capacity),
    features:    (s.features ?? []).join(', '),
    color:       s.color,
    is_active:   s.is_active,
  }
}

function buildFormData(form: FormState, thumbFile: File | null): FormData {
  const fd = new FormData()
  fd.append('name',        form.name)
  fd.append('description', form.description)
  fd.append('price',       form.price)
  fd.append('capacity',    form.capacity)
  fd.append('color',       form.color)
  fd.append('is_active',   form.is_active ? '1' : '0')
  form.features.split(',').map(s => s.trim()).filter(Boolean)
    .forEach(f => fd.append('features[]', f))
  if (thumbFile) fd.append('thumbnail', thumbFile)
  return fd
}

// ─── image placeholder ────────────────────────────────────────────────────────

function StudioImage({ studio, className = '' }: { studio: Studio; className?: string }) {
  if (studio.thumbnail_url) {
    return (
      <img
        src={studio.thumbnail_url}
        alt={studio.name}
        className={`w-full h-full object-cover ${className}`}
      />
    )
  }
  return (
    <div
      className={`w-full h-full flex items-center justify-center ${className}`}
      style={{ background: `linear-gradient(135deg, ${studio.color}55 0%, ${studio.color} 100%)` }}
    >
      <span className="text-white font-extrabold text-5xl opacity-60 select-none">
        {studio.name.charAt(0)}
      </span>
    </div>
  )
}

// ─── modal ────────────────────────────────────────────────────────────────────

function StudioModal({ studio, onClose }: { studio: Studio | null; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm]       = useState<FormState>(studio ? fromStudio(studio) : EMPTY_FORM)
  const [thumbFile, setThumb] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(studio?.thumbnail_url ?? null)
  const fileRef               = useRef<HTMLInputElement>(null)

  const set = (k: keyof FormState, v: string | boolean) => setForm(f => ({ ...f, [k]: v }))

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setThumb(file)
    setPreview(URL.createObjectURL(file))
  }

  const mutation = useMutation({
    mutationFn: () => {
      const fd = buildFormData(form, thumbFile)
      if (studio) {
        fd.append('_method', 'PUT')
        return api.post(`/admin/studios/${studio.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      }
      return api.post('/admin/studios', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'studios'] })
      qc.invalidateQueries({ queryKey: ['studios'] })
      toast.success(studio ? 'Studio diperbarui!' : 'Studio ditambahkan!')
      onClose()
    },
    onError: (err: any) => toast.error(err.response?.data?.message ?? 'Gagal menyimpan.'),
  })

  const inputCls = 'w-full px-4 py-3 rounded-2xl border-2 border-ink text-sm font-semibold text-ink placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500/30 shadow-cartoon-sm transition-all'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.93, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.93, y: 16 }}
        transition={{ type: 'spring', stiffness: 360, damping: 28 }}
        className="bg-white rounded-3xl border-2 border-ink shadow-cartoon-xl w-full max-w-lg max-h-[92vh] overflow-y-auto"
      >
        {/* header */}
        <div className="px-6 py-5 border-b-2 border-ink flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-3xl">
          <h2 className="text-lg font-extrabold text-ink">
            {studio ? 'Edit Studio' : 'Tambah Studio'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl border-2 border-ink flex items-center justify-center text-gray-400 hover:bg-rose-50 hover:text-rose-500 hover:border-rose-300 transition-all shadow-cartoon-sm">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={e => { e.preventDefault(); mutation.mutate() }} className="p-6 space-y-5">

          {/* Image upload */}
          <div>
            <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-2">Foto Studio</label>
            <div
              onClick={() => fileRef.current?.click()}
              className="relative w-full h-44 rounded-2xl border-2 border-dashed border-ink cursor-pointer overflow-hidden group hover:border-brand-500 transition-colors"
              style={!preview ? { background: form.color + '15' } : undefined}
            >
              {preview ? (
                <>
                  <img src={preview} alt="preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-ink/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <p className="text-white font-extrabold text-sm">Ganti Foto</p>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400 group-hover:text-brand-500 transition-colors">
                  <ImagePlus className="w-8 h-8" strokeWidth={1.5} />
                  <p className="text-xs font-bold">Klik untuk upload foto studio</p>
                  <p className="text-[10px]">JPG, PNG, WebP · max 5MB</p>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileChange} />
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Nama Studio</label>
            <input required value={form.name} onChange={e => set('name', e.target.value)} placeholder="Studio A — Minimalist" className={inputCls} />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Deskripsi</label>
            <textarea required rows={2} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Nuansa bersih, putih, dan minimalis..." className={inputCls + ' resize-none'} />
          </div>

          {/* Price + Capacity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Harga / sesi (Rp)</label>
              <input required type="number" min={0} value={form.price} onChange={e => set('price', e.target.value)} placeholder="75000" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Kapasitas (orang)</label>
              <input required type="number" min={1} value={form.capacity} onChange={e => set('capacity', e.target.value)} placeholder="4" className={inputCls} />
            </div>
          </div>

          {/* Features */}
          <div>
            <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Fitur (pisahkan koma)</label>
            <input value={form.features} onChange={e => set('features', e.target.value)} placeholder="Ring light, Bluetooth speaker, Props box" className={inputCls} />
          </div>

          {/* Color */}
          <div>
            <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Warna Aksen</label>
            <div className="flex items-center gap-3">
              <input type="color" value={form.color} onChange={e => set('color', e.target.value)}
                className="w-12 h-12 rounded-2xl border-2 border-ink cursor-pointer p-1 shadow-cartoon-sm" />
              <input value={form.color} onChange={e => set('color', e.target.value)} className={inputCls + ' flex-1 font-mono'} placeholder="#7C3AED" />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Status</label>
            <button type="button" onClick={() => set('is_active', !form.is_active)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl border-2 border-ink shadow-cartoon-sm transition-colors w-full ${form.is_active ? 'bg-green-50' : 'bg-gray-50'}`}>
              <div className={`relative inline-flex h-6 w-11 items-center rounded-full border-2 border-ink transition-colors ${form.is_active ? 'bg-brand-500' : 'bg-gray-300'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
              <span className={`text-sm font-extrabold ${form.is_active ? 'text-green-600' : 'text-gray-400'}`}>
                {form.is_active ? 'Aktif' : 'Nonaktif'}
              </span>
            </button>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-3 rounded-2xl border-2 border-ink text-sm font-extrabold text-gray-600 bg-white shadow-cartoon-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-cartoon active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all duration-100">
              Batal
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 py-3 rounded-2xl border-2 border-ink text-sm font-extrabold text-white bg-brand-500 shadow-cartoon hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-cartoon-lg disabled:opacity-50 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all duration-100">
              {mutation.isPending ? 'Menyimpan…' : 'Simpan Studio'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ─── studio card ──────────────────────────────────────────────────────────────

function StudioCard({
  studio,
  onEdit,
  onDelete,
}: {
  studio: Studio
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.18 }}
      className="bg-white rounded-3xl border-2 border-ink shadow-cartoon overflow-hidden hover:shadow-cartoon-lg transition-shadow"
    >
      {/* image banner */}
      <div className="relative h-48 w-full overflow-hidden">
        <StudioImage studio={studio} />
        {/* status badge */}
        <div className="absolute top-3 left-3">
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold border-2 border-ink shadow-cartoon-sm ${studio.is_active ? 'bg-green-400 text-white' : 'bg-gray-200 text-gray-600'}`}>
            <BadgeCheck className="w-3 h-3" strokeWidth={3} />
            {studio.is_active ? 'Aktif' : 'Nonaktif'}
          </span>
        </div>
        {/* action buttons */}
        <div className="absolute top-3 right-3 flex gap-1.5">
          <button onClick={onEdit}
            className="w-8 h-8 rounded-xl bg-white border-2 border-ink shadow-cartoon-sm flex items-center justify-center text-gray-600 hover:text-brand-500 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-cartoon transition-all duration-100">
            <Pencil className="w-3.5 h-3.5" strokeWidth={2.5} />
          </button>
          <button onClick={onDelete}
            className="w-8 h-8 rounded-xl bg-white border-2 border-ink shadow-cartoon-sm flex items-center justify-center text-gray-600 hover:text-rose-500 hover:bg-rose-50 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-cartoon transition-all duration-100">
            <Trash2 className="w-3.5 h-3.5" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* content */}
      <div className="p-5">
        {/* name + color dot */}
        <div className="flex items-center gap-2 mb-1">
          <span className="w-3 h-3 rounded-full border-2 border-ink shrink-0" style={{ background: studio.color }} />
          <h3 className="font-extrabold text-ink text-base leading-tight">{studio.name}</h3>
        </div>

        <p className="text-xs font-semibold text-gray-400 leading-relaxed mb-3 line-clamp-2">
          {studio.description}
        </p>

        {/* features */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {studio.features?.slice(0, 3).map((f, i) => (
            <span key={i} className="text-[10px] font-extrabold px-2.5 py-1 rounded-full border-2"
              style={{ background: studio.color + '20', color: studio.color, borderColor: studio.color }}>
              {f}
            </span>
          ))}
          {(studio.features?.length ?? 0) > 3 && (
            <span className="text-[10px] font-bold text-gray-400 py-1">+{studio.features.length - 3} lagi</span>
          )}
        </div>

        {/* price + capacity */}
        <div className="flex items-end justify-between border-t-2 border-ink pt-3">
          <div>
            <p className="text-2xl font-extrabold text-ink">{formatIDR(studio.price)}</p>
            <p className="text-[11px] font-bold text-gray-400">per sesi</p>
          </div>
          <div className="flex items-center gap-1.5 text-gray-500 bg-surface-subtle border-2 border-ink rounded-xl px-3 py-1.5 shadow-cartoon-sm">
            <Users className="w-3.5 h-3.5" strokeWidth={2.5} />
            <span className="text-xs font-extrabold">Max {studio.capacity}</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function AdminStudios() {
  const { data: studios = [], isLoading } = useAdminStudios()
  const qc = useQueryClient()
  const [modalStudio, setModalStudio] = useState<Studio | null | undefined>(undefined)

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/studios/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'studios'] })
      qc.invalidateQueries({ queryKey: ['studios'] })
      toast.success('Studio dihapus.')
    },
    onError: (err: any) => toast.error(err.response?.data?.message ?? 'Gagal menghapus studio.'),
  })

  const handleDelete = (studio: Studio) => {
    if (!confirm(`Hapus "${studio.name}"? Tindakan ini tidak bisa dibatalkan.`)) return
    deleteMutation.mutate(studio.id)
  }

  return (
    <div>
      {/* header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-ink">Studio</h1>
          <p className="text-sm font-semibold text-gray-400 mt-1">Kelola booth dan ruang foto kamu.</p>
        </div>
        <button
          onClick={() => setModalStudio(null)}
          className="flex items-center gap-2 px-5 py-3 bg-brand-500 text-white text-sm font-extrabold rounded-2xl border-2 border-ink shadow-cartoon hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-cartoon-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all duration-100"
        >
          <Plus className="w-4 h-4" strokeWidth={3} />
          Tambah Studio
        </button>
      </div>

      {/* grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-3xl border-2 border-ink shadow-cartoon overflow-hidden animate-pulse">
              <div className="h-48 bg-surface-subtle" />
              <div className="p-5 space-y-3">
                <div className="h-5 bg-surface-subtle rounded-xl w-2/3" />
                <div className="h-4 bg-surface-subtle rounded-xl" />
                <div className="h-4 bg-surface-subtle rounded-xl w-4/5" />
              </div>
            </div>
          ))}
        </div>
      ) : studios.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border-2 border-ink shadow-cartoon">
          <div className="text-5xl mb-4">🏠</div>
          <p className="font-extrabold text-ink text-lg">Belum ada studio</p>
          <p className="text-sm font-semibold text-gray-400 mt-1 mb-5">Tambahkan studio pertama kamu!</p>
          <button onClick={() => setModalStudio(null)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-500 text-white text-sm font-extrabold rounded-2xl border-2 border-ink shadow-cartoon hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all duration-100">
            <Plus className="w-4 h-4" strokeWidth={3} /> Tambah Studio
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {studios.map(studio => (
            <StudioCard
              key={studio.id}
              studio={studio}
              onEdit={() => setModalStudio(studio)}
              onDelete={() => handleDelete(studio)}
            />
          ))}
        </div>
      )}

      <AnimatePresence>
        {modalStudio !== undefined && (
          <StudioModal studio={modalStudio} onClose={() => setModalStudio(undefined)} />
        )}
      </AnimatePresence>
    </div>
  )
}
