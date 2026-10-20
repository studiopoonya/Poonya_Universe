import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { Clock, CalendarOff, Lock, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/axios'
import type { Studio } from '@/types'
import DatePicker from '@/components/ui/DatePicker'

interface Hour { weekday: number; is_open: boolean; open_time: string; close_time: string }
interface ClosedDate { id: number; date: string; reason: string | null }
interface AdminSlot { id: number; start_time: string; end_time: string; status: string; customer: string | null; onsite?: boolean }

const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const ORDER = [1, 2, 3, 4, 5, 6, 0] // Monday first

const card = 'bg-white rounded-3xl border-2 border-ink shadow-cartoon p-5 md:p-6'
const inputCls = 'px-3 py-2 rounded-xl border-2 border-ink text-sm font-semibold text-ink bg-white shadow-cartoon-sm focus:outline-none'
const btnPrimary = 'px-5 py-2.5 rounded-2xl bg-brand-500 text-white text-sm font-extrabold border-2 border-ink shadow-cartoon-sm disabled:opacity-50'

function SectionTitle({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="w-10 h-10 shrink-0 rounded-2xl bg-brand-500 border-2 border-ink shadow-cartoon-sm flex items-center justify-center text-white">{icon}</div>
      <div>
        <p className="font-extrabold text-ink">{title}</p>
        <p className="text-xs font-semibold text-gray-400">{desc}</p>
      </div>
    </div>
  )
}

function HoursCard({ initial }: { initial: Hour[] }) {
  const qc = useQueryClient()
  const [hours, setHours] = useState<Hour[]>([])
  useEffect(() => {
    setHours(initial.map((h) => ({ ...h, open_time: h.open_time.slice(0, 5), close_time: h.close_time.slice(0, 5) })))
  }, [initial])

  const set = (weekday: number, patch: Partial<Hour>) =>
    setHours((hs) => hs.map((h) => (h.weekday === weekday ? { ...h, ...patch } : h)))

  const save = useMutation({
    mutationFn: () => api.put('/admin/schedule/hours', { hours }),
    onSuccess: (res) => { toast.success(res.data.message); qc.invalidateQueries({ queryKey: ['admin', 'schedule'] }) },
    onError: (err: any) => toast.error(err.response?.data?.message ?? 'Gagal menyimpan.'),
  })

  return (
    <div className={card}>
      <SectionTitle icon={<Clock className="w-5 h-5" strokeWidth={2.5} />} title="Jam Operasional" desc="Slot 30 menit dibuat otomatis dari jam ini. Perubahan berlaku mulai besok." />
      <div className="space-y-2">
        {ORDER.map((wd) => {
          const h = hours.find((x) => x.weekday === wd)
          if (!h) return null
          return (
            <div key={wd} className="flex flex-wrap items-center gap-2 sm:gap-3 py-1.5">
              <label className="flex items-center gap-2 w-28 shrink-0 text-sm font-extrabold text-ink">
                <input type="checkbox" checked={h.is_open} onChange={(e) => set(wd, { is_open: e.target.checked })} className="w-4 h-4 accent-brand-500" />
                {DAYS[wd]}
              </label>
              {h.is_open ? (
                <div className="flex items-center gap-2">
                  <input type="time" step={1800} value={h.open_time} onChange={(e) => set(wd, { open_time: e.target.value })} className={inputCls} />
                  <span className="text-gray-400 font-bold">–</span>
                  <input type="time" step={1800} value={h.close_time} onChange={(e) => set(wd, { close_time: e.target.value })} className={inputCls} />
                </div>
              ) : (
                <span className="text-xs font-extrabold text-gray-400 uppercase">Tutup</span>
              )}
            </div>
          )
        })}
      </div>
      <button onClick={() => save.mutate()} disabled={save.isPending} className={`${btnPrimary} mt-4`}>
        {save.isPending ? 'Menyimpan…' : 'Simpan Jam'}
      </button>
    </div>
  )
}

function ClosedDatesCard({ dates }: { dates: ClosedDate[] }) {
  const qc = useQueryClient()
  const [date, setDate]     = useState('')
  const [reason, setReason] = useState('')
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin', 'schedule'] })

  const add = useMutation({
    mutationFn: () => api.post('/admin/schedule/closed-dates', { date, reason: reason || null }),
    onSuccess: (res) => { toast.success(res.data.message, { duration: 6000 }); setDate(''); setReason(''); refresh() },
    onError: (err: any) => toast.error(err.response?.data?.message ?? 'Gagal menyimpan.'),
  })
  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/schedule/closed-dates/${id}`),
    onSuccess: (res) => { toast.success(res.data.message); refresh() },
  })

  return (
    <div className={card}>
      <SectionTitle icon={<CalendarOff className="w-5 h-5" strokeWidth={2.5} />} title="Hari Libur" desc="Tanggal tanpa slot sama sekali, misalnya libur nasional atau renovasi." />
      <form onSubmit={(e) => { e.preventDefault(); add.mutate() }} className="flex flex-wrap gap-2 mb-4">
        <DatePicker value={date} onChange={setDate} min={format(new Date(), 'yyyy-MM-dd')} placeholder="Pilih tanggal libur" className="w-full sm:w-60" />
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Keterangan (opsional)" className={`${inputCls} flex-1 min-w-[160px]`} />
        <button type="submit" disabled={add.isPending || !date} className={btnPrimary}>Tambah</button>
      </form>
      {dates.length === 0 ? (
        <p className="text-sm font-bold text-gray-300">Belum ada hari libur ke depan.</p>
      ) : (
        <div className="divide-y-2 divide-surface-subtle">
          {dates.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-ink">{format(parseISO(d.date), 'EEEE, d MMMM yyyy', { locale: idLocale })}</p>
                {d.reason && <p className="text-xs font-semibold text-gray-400 truncate">{d.reason}</p>}
              </div>
              <button
                onClick={() => { if (confirm('Buka kembali tanggal ini?')) remove.mutate(d.id) }}
                className="shrink-0 text-red-500 border-2 border-red-300 bg-red-50 rounded-xl p-1.5"
                aria-label="Hapus"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SlotBlockCard() {
  const qc = useQueryClient()
  const { data: studios = [] } = useQuery<Studio[]>({ queryKey: ['admin', 'studios'], queryFn: () => api.get('/admin/studios').then((r) => r.data) })
  const [studioId, setStudioId] = useState<number | null>(null)
  const [date, setDate]         = useState(format(new Date(), 'yyyy-MM-dd'))
  const activeStudio = studioId ?? studios[0]?.id ?? null

  const { data: slots = [], isLoading } = useQuery<AdminSlot[]>({
    queryKey: ['admin', 'schedule-slots', activeStudio, date],
    queryFn: () => api.get('/admin/schedule/slots', { params: { studio_id: activeStudio, date } }).then((r) => r.data),
    enabled: !!activeStudio && !!date,
  })

  const toggle = useMutation({
    mutationFn: (s: AdminSlot) => api.patch(`/admin/slots/${s.id}/${s.status === 'blocked' ? 'unblock' : 'block'}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'schedule-slots'] }),
    onError: (err: any) => toast.error(err.response?.data?.message ?? 'Gagal.'),
  })

  const style = (s: AdminSlot) =>
    s.status === 'blocked' ? 'bg-gray-200 text-gray-500 border-gray-400 line-through'
      : s.status === 'booked' ? 'bg-green-100 text-green-700 border-green-400 cursor-not-allowed'
      : s.status === 'locked' ? 'bg-amber-100 text-amber-700 border-amber-400 cursor-not-allowed'
      : 'bg-white text-ink border-ink hover:bg-surface-subtle'

  return (
    <div className={card}>
      <SectionTitle icon={<Lock className="w-5 h-5" strokeWidth={2.5} />} title="Blokir Slot" desc="Tutup jam tertentu supaya tidak bisa dibooking customer." />

      {/* What blocking is for — admins asked */}
      <div className="rounded-2xl bg-brand-50 border-2 border-brand-100 p-4 mb-4 text-xs font-semibold text-gray-600 leading-relaxed">
        <p className="font-extrabold text-ink mb-1.5">Kapan dipakai?</p>
        <ul className="space-y-1">
          <li>🎬 <strong>Sesi privat / acara</strong> — studio dipakai sendiri, foto produk, kolaborasi.</li>
          <li>📞 <strong>Booking di luar aplikasi</strong> — sudah dijanjikan lewat WhatsApp / telepon, supaya tidak diambil orang lain.</li>
          <li>☕ <strong>Istirahat staff</strong> — misalnya jam makan siang.</li>
          <li>🔧 <strong>Perawatan</strong> — ganti backdrop, lampu rusak, bersih-bersih.</li>
        </ul>
        <p className="mt-2.5 pt-2.5 border-t border-brand-100">
          Bedanya dengan <strong>Hari Libur</strong>: hari libur menutup <strong>seharian penuh</strong>, blokir slot menutup <strong>jam tertentu saja</strong>.
          Slot yang sudah dibooking tidak bisa diblokir.
        </p>
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        <select value={activeStudio ?? ''} onChange={(e) => setStudioId(Number(e.target.value))} className={inputCls}>
          {studios.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <DatePicker value={date} onChange={setDate} className="w-full sm:w-60" />
      </div>
      {isLoading ? (
        <div className="h-24 rounded-2xl bg-surface-subtle animate-pulse" />
      ) : slots.length === 0 ? (
        <p className="text-sm font-bold text-gray-300">Tidak ada slot (tutup / hari libur).</p>
      ) : (
        <>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {slots.map((s) => (
              <button
                key={s.id}
                disabled={s.status === 'booked' || s.status === 'locked' || toggle.isPending}
                onClick={() => toggle.mutate(s)}
                title={s.customer ? `${s.onsite ? 'Reservasi bayar di tempat' : 'Dibooking'}: ${s.customer}` : undefined}
                className={`py-2.5 rounded-xl border-2 text-sm font-extrabold transition-colors ${style(s)}`}
              >
                {s.start_time}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 mt-3 text-[11px] font-bold text-gray-400">
            {[
              ['bg-white border-ink', 'Tersedia — klik untuk blokir'],
              ['bg-gray-200 border-gray-400', 'Diblokir — klik untuk buka'],
              ['bg-green-100 border-green-400', 'Dibooking'],
              ['bg-amber-100 border-amber-400', 'Sedang dibayar'],
            ].map(([cls, label]) => (
              <span key={label} className="inline-flex items-center gap-1.5">
                <span className={`w-3.5 h-3.5 rounded border-2 ${cls}`} />{label}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default function AdminSchedule() {
  const { data, isLoading } = useQuery<{ hours: Hour[]; closed_dates: ClosedDate[] }>({
    queryKey: ['admin', 'schedule'],
    queryFn: () => api.get('/admin/schedule').then((r) => r.data),
  })

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-extrabold text-ink">Jadwal</h1>
        <p className="text-sm font-semibold text-gray-400 mt-0.5">Atur jam buka, hari libur, dan slot yang diblokir.</p>
      </div>
      {isLoading || !data ? (
        <div className="h-64 rounded-3xl bg-surface-subtle animate-pulse border-2 border-ink" />
      ) : (
        <>
          <HoursCard initial={data.hours} />
          <ClosedDatesCard dates={data.closed_dates} />
        </>
      )}
      <SlotBlockCard />
    </div>
  )
}
