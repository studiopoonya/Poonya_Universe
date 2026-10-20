import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, CheckCircle, XCircle, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/axios'
import { formatIDR, downloadFile } from '@/lib/utils'
import type { Booking } from '@/types'
import CollectCashModal from '@/components/admin/CollectCashModal'
import Pagination from '@/components/admin/Pagination'

// ─── types ────────────────────────────────────────────────────────────────────

interface PaginatedBookings {
  data: Booking[]
  current_page: number
  last_page: number
  total: number
  per_page: number
  from: number | null
  to: number | null
}

type ActionType = 'cancel' | 'confirm'

// ─── status badge ─────────────────────────────────────────────────────────────

const STATUS: Record<string, { bg: string; text: string; label: string; border: string }> = {
  pending:   { bg: 'bg-amber-50',  text: 'text-amber-600', border: 'border-amber-300', label: 'Menunggu'     },
  onsite:    { bg: 'bg-sky-50',    text: 'text-sky-600',   border: 'border-sky-300',   label: 'Bayar di Tempat' },
  confirmed: { bg: 'bg-green-50',  text: 'text-green-600', border: 'border-green-300', label: 'Dikonfirmasi' },
  cancelled: { bg: 'bg-red-50',    text: 'text-red-500',   border: 'border-red-300',   label: 'Dibatalkan'   },
  expired:   { bg: 'bg-gray-100',  text: 'text-gray-400',  border: 'border-gray-200',  label: 'Expired'      },
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? STATUS.expired
  return (
    <span className={`text-[11px] font-extrabold px-2.5 py-1 rounded-full border-2 ${s.bg} ${s.text} ${s.border}`}>
      {s.label}
    </span>
  )
}

// ─── action confirm modal ─────────────────────────────────────────────────────

function ActionModal({
  action, booking, onClose,
}: {
  action: ActionType
  booking: Booking
  onClose: () => void
}) {
  const qc        = useQueryClient()
  const isCancel  = action === 'cancel'

  const mutation = useMutation({
    mutationFn: () =>
      isCancel
        ? api.patch(`/admin/bookings/${booking.id}/cancel`)
        : api.patch(`/admin/bookings/${booking.id}/confirm`),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin', 'bookings'] })
      qc.invalidateQueries({ queryKey: ['admin', 'dashboard'] })
      toast.success(res.data?.message ?? (isCancel ? 'Booking dibatalkan.' : 'Booking dikonfirmasi.'))
      onClose()
    },
    onError: (err: any) => toast.error(err.response?.data?.message ?? 'Terjadi kesalahan.'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 16 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        className="bg-white rounded-3xl border-2 border-ink shadow-cartoon-xl w-full max-w-sm p-6 text-center"
      >
        <div className={`w-14 h-14 rounded-2xl border-2 border-ink shadow-cartoon-sm flex items-center justify-center mx-auto mb-4 ${
          isCancel ? 'bg-red-100' : 'bg-green-100'
        }`}>
          {isCancel
            ? <XCircle className="w-7 h-7 text-red-500" strokeWidth={2.5} />
            : <CheckCircle className="w-7 h-7 text-green-500" strokeWidth={2.5} />}
        </div>
        <p className="font-extrabold text-ink text-lg mb-1">
          {isCancel ? 'Batalkan Booking?' : 'Konfirmasi Booking?'}
        </p>
        <p className="text-sm font-semibold text-gray-400 mb-1">
          <span className="text-ink font-extrabold">{booking.customer_name}</span>
        </p>
        <p className="text-xs font-bold text-gray-400 mb-6">{booking.order_id}</p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl border-2 border-ink text-sm font-extrabold bg-white shadow-cartoon-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-cartoon active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all duration-100"
          >
            Batal
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className={`flex-1 py-3 rounded-2xl border-2 border-ink text-sm font-extrabold text-white shadow-cartoon hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-cartoon-lg disabled:opacity-50 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all duration-100 ${
              isCancel ? 'bg-rose-500' : 'bg-green-500'
            }`}
          >
            {mutation.isPending ? 'Memproses…' : isCancel ? 'Ya, Batalkan' : 'Ya, Konfirmasi'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── main page ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: '',          label: 'Semua Status'  },
  { value: 'pending',   label: 'Menunggu'      },
  { value: 'onsite',    label: 'Bayar di Tempat' },
  { value: 'confirmed', label: 'Dikonfirmasi'  },
  { value: 'cancelled', label: 'Dibatalkan'    },
  { value: 'expired',   label: 'Expired'       },
  { value: 'refund',    label: '💸 Perlu Refund' },
]

export default function AdminBookings() {
  const qc = useQueryClient()

  const markRefunded = useMutation({
    mutationFn: (b: Booking) => api.patch(`/admin/bookings/${b.id}/refunded`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'bookings'] })
      qc.invalidateQueries({ queryKey: ['admin', 'dashboard'] })
      toast.success('Refund dicatat.')
    },
    onError: (err: any) => toast.error(err.response?.data?.message ?? 'Terjadi kesalahan.'),
  })

  const [search,       setSearch]       = useState('')
  const [searchInput,  setSearchInput]  = useState('')
  const [params] = useSearchParams()
  const [statusFilter, setStatusFilter] = useState(params.get('status') ?? '') // e.g. ?status=refund from the dashboard
  const [exporting,    setExporting]    = useState(false)
  const [dateFilter,   setDateFilter]   = useState('')
  const [page,         setPage]         = useState(1)
  const [perPage,      setPerPage]      = useState(20)
  const [actionTarget, setActionTarget] = useState<{ action: ActionType; booking: Booking } | null>(null)

  const { data, isLoading } = useQuery<PaginatedBookings>({
    queryKey: ['admin', 'bookings', search, statusFilter, dateFilter, page, perPage],
    queryFn: () =>
      api.get('/admin/bookings', {
        params: {
          search: search   || undefined,
          status: statusFilter || undefined,
          date:   dateFilter   || undefined,
          page,
          per_page: perPage,
        },
      }).then((r) => r.data),
    placeholderData: keepPreviousData, // keep the current page on screen while the next loads
  })

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  const clearFilters = () => {
    setSearch(''); setSearchInput('')
    setStatusFilter(''); setDateFilter('')
    setPage(1)
  }

  const hasFilters = search || statusFilter || dateFilter
  const bookings   = data?.data ?? []

  const selectCls = 'px-3.5 py-2.5 rounded-2xl border-2 border-ink text-sm font-extrabold text-ink bg-white shadow-cartoon-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-all'

  return (
    <div>
      {/* header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">Bookings</h1>
          <p className="text-sm font-semibold text-gray-400 mt-0.5">
            {data ? `${data.total} total booking` : 'Memuat…'}
          </p>
        </div>
        <button
          disabled={exporting}
          onClick={async () => {
            setExporting(true)
            try {
              await downloadFile('/admin/bookings/export', { search: search || undefined, status: statusFilter || undefined, date: dateFilter || undefined }, 'booking.csv')
            } catch { toast.error('Gagal export.') } finally { setExporting(false) }
          }}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border-2 border-ink bg-amber-400 text-sm font-extrabold text-ink shadow-cartoon-sm disabled:opacity-50"
        >
          <Download className="w-4 h-4" strokeWidth={2.5} /> {exporting ? 'Menyiapkan…' : 'Export Excel'}
        </button>
      </div>

      {/* filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        {/* search */}
        <form onSubmit={handleSearch} className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" strokeWidth={2.5} />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Nama / No. HP / Order ID"
              className="pl-9 pr-4 py-2.5 rounded-2xl border-2 border-ink text-sm font-semibold text-ink placeholder-gray-300 bg-white shadow-cartoon-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 w-full sm:w-56 transition-all"
            />
          </div>
          <button type="submit"
            className="px-4 py-2.5 rounded-2xl border-2 border-ink bg-brand-500 text-white text-sm font-extrabold shadow-cartoon-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-cartoon active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all duration-100">
            Cari
          </button>
        </form>

        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }} className={selectCls}>
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <input
          type="date" value={dateFilter}
          onChange={(e) => { setDateFilter(e.target.value); setPage(1) }}
          className={selectCls}
        />

        {hasFilters && (
          <button onClick={clearFilters}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border-2 border-ink bg-white text-sm font-extrabold text-gray-500 shadow-cartoon-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-cartoon active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all duration-100">
            <X className="w-3.5 h-3.5" strokeWidth={3} /> Reset
          </button>
        )}
      </div>

      {/* table */}
      <div className="bg-white rounded-3xl border-2 border-ink shadow-cartoon overflow-hidden">
        {isLoading ? (
          <div className="divide-y-2 divide-surface-subtle">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="px-6 py-4 flex items-center gap-4">
                <div className="h-4 w-24 bg-surface-subtle rounded-xl animate-pulse" />
                <div className="h-4 flex-1 bg-surface-subtle rounded-xl animate-pulse" />
                <div className="h-4 w-20 bg-surface-subtle rounded-xl animate-pulse" />
              </div>
            ))}
          </div>
        ) : bookings.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-3xl mb-3">📭</p>
            <p className="text-sm font-extrabold text-gray-400">Tidak ada booking yang cocok.</p>
          </div>
        ) : (
          <div className="divide-y-2 divide-surface-subtle">
            {bookings.map((b) => (
              <motion.div
                key={b.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="px-4 sm:px-5 py-4 flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-2 sm:gap-4 hover:bg-surface-muted/50 transition-colors"
              >
                {/* studio color dot */}
                <div className="w-3 h-3 rounded-full shrink-0 border-2 border-ink"
                  style={{ background: (b as any).studio?.color ?? '#d1d5db' }} />

                {/* date & time */}
                <div className="shrink-0 w-24 sm:w-28">
                  <p className="text-xs font-extrabold text-ink">
                    {b.slot?.date ? format(parseISO(b.slot.date), 'd MMM yyyy', { locale: idLocale }) : '—'}
                  </p>
                  <p className="text-xs font-bold text-gray-400 mt-0.5">
                    {b.slot?.start_time?.slice(0, 5)} – {b.end_time ?? b.slot?.end_time?.slice(0, 5)}
                    {(b.sessions ?? 1) > 1 && <span className="text-brand-500"> · {b.sessions} sesi</span>}
                  </p>
                </div>

                {/* customer */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-extrabold text-ink truncate">{b.customer_name}</p>
                  <p className="text-xs font-bold text-gray-400 truncate">{b.customer_phone}</p>
                </div>

                {/* studio */}
                <div className="hidden sm:block shrink-0 w-44">
                  <p className="text-xs font-extrabold text-gray-700 truncate">
                    {(b as any).studio?.name ?? '—'}
                  </p>
                  <p className="text-xs font-bold text-gray-400 mt-0.5">
                    {formatIDR(b.payment?.amount ?? (b as any).studio?.price ?? 0)}
                  </p>
                </div>

                {/* status */}
                <div className="shrink-0 sm:w-40 flex flex-col items-end gap-1">
                  <StatusBadge status={b.status} />
                  {b.payment?.status === 'refund_pending' && (
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full border-2 bg-orange-50 text-orange-600 border-orange-300">
                      💸 Perlu refund {formatIDR(b.payment.amount)}
                    </span>
                  )}
                  {b.payment?.status === 'refunded' && (
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full border-2 bg-gray-50 text-gray-400 border-gray-200">Sudah refund</span>
                  )}
                  {b.payment?.cash_received != null && (
                    <span className="text-[10px] font-bold text-gray-500 text-right">
                      💵 Tunai {formatIDR(b.payment.cash_received)} · Kembali {formatIDR(b.payment.cash_change ?? 0)}
                    </span>
                  )}
                </div>

                {/* actions */}
                <div className="shrink-0 flex gap-2 w-full sm:w-[216px] justify-end empty:hidden sm:empty:flex">
                  {b.payment?.status === 'refund_pending' && (
                    <button
                      onClick={() => { if (confirm(`Uang ${formatIDR(b.payment!.amount)} untuk ${b.customer_name} sudah dikembalikan?`)) markRefunded.mutate(b) }}
                      className="text-xs font-extrabold text-orange-600 border-2 border-orange-300 bg-orange-50 px-2.5 py-1.5 rounded-xl"
                    >
                      Sudah Refund
                    </button>
                  )}
                  {(b.status === 'pending' || b.status === 'onsite') && (
                    <button
                      onClick={() => setActionTarget({ action: 'confirm', booking: b })}
                      className="flex items-center gap-1 text-xs font-extrabold text-green-600 border-2 border-green-400 bg-green-50 px-2.5 py-1.5 rounded-xl hover:bg-green-100 shadow-[2px_2px_0_#4ade80] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[3px_3px_0_#4ade80] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all duration-100"
                    >
                      <CheckCircle className="w-3.5 h-3.5" strokeWidth={2.5} /> {b.status === 'onsite' ? 'Sudah Bayar' : 'OK'}
                    </button>
                  )}
                  {(b.status === 'pending' || b.status === 'onsite' || b.status === 'confirmed') && (
                    <button
                      onClick={() => setActionTarget({ action: 'cancel', booking: b })}
                      className="flex items-center gap-1 text-xs font-extrabold text-red-500 border-2 border-red-300 bg-red-50 px-2.5 py-1.5 rounded-xl hover:bg-red-100 shadow-[2px_2px_0_#fca5a5] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[3px_3px_0_#fca5a5] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all duration-100"
                    >
                      <XCircle className="w-3.5 h-3.5" strokeWidth={2.5} /> Batal
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* pagination */}
      {data && (
        <Pagination
          page={data.current_page}
          lastPage={data.last_page}
          total={data.total}
          from={data.from}
          to={data.to}
          perPage={perPage}
          onPage={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
          onPerPage={(n) => { setPerPage(n); setPage(1) }}
        />
      )}

      {/* action modal — an onsite customer paying cash gets the change calculator */}
      <AnimatePresence>
        {actionTarget?.action === 'confirm' && actionTarget.booking.status === 'onsite' && (
          <CollectCashModal key="cash-modal" booking={actionTarget.booking} onClose={() => setActionTarget(null)} />
        )}
        {actionTarget && !(actionTarget.action === 'confirm' && actionTarget.booking.status === 'onsite') && (
          <ActionModal
            key="action-modal"
            action={actionTarget.action}
            booking={actionTarget.booking}
            onClose={() => setActionTarget(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
