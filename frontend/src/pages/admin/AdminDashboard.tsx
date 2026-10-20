import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { format, parseISO } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { TrendingUp, CalendarCheck, CheckCircle, Clock, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/axios'
import { formatIDR, downloadFile } from '@/lib/utils'

interface Stats {
  total_revenue: number
  total_bookings: number
  confirmed_bookings: number
  upcoming_today: number
  pending_refunds: number
}

interface RevenueDay { date: string; total: number }
interface RevenueStudio { name: string; color: string; sessions: number; total: number }

const THIS_MONTH = format(new Date(), 'yyyy-MM')

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  confirmed: { bg: 'bg-green-50',  text: 'text-green-600',  label: 'Dikonfirmasi' },
  pending:   { bg: 'bg-amber-50',  text: 'text-amber-600',  label: 'Menunggu'     },
  cancelled: { bg: 'bg-red-50',    text: 'text-red-500',    label: 'Dibatalkan'   },
  expired:   { bg: 'bg-gray-100',  text: 'text-gray-400',   label: 'Expired'      },
}

interface StatCardProps {
  label: string
  value: string
  sub?: string
  icon: React.ReactNode
  accent: string
}

function StatCard({ label, value, sub, icon, accent }: StatCardProps) {
  return (
    <div className="bg-white rounded-3xl border-2 border-ink shadow-cartoon hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-cartoon-lg transition-all duration-100 p-6">
      <div className="flex items-start justify-between mb-4">
        <p className="text-xs font-extrabold text-gray-400 uppercase tracking-widest">{label}</p>
        <div className={`w-9 h-9 rounded-xl border-2 border-ink shadow-cartoon-sm flex items-center justify-center ${accent}`}>
          {icon}
        </div>
      </div>
      <p className="text-3xl font-extrabold text-ink">{value}</p>
      {sub && <p className="text-xs font-bold text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

export default function AdminDashboard() {
  const [month, setMonth]         = useState(THIS_MONTH)
  const [exporting, setExporting] = useState(false)
  const isThisMonth = month === THIS_MONTH

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'dashboard', month],
    queryFn:  () => api.get('/admin/dashboard', { params: { month } }).then((r) => r.data),
    refetchInterval: 30_000,
  })

  const exportMonth = async () => {
    setExporting(true)
    try {
      await downloadFile('/admin/bookings/export', { month }, `booking-${month}.csv`)
    } catch (err: any) {
      toast.error(err.response?.status === 403 ? 'Kamu tidak punya akses ke data booking.' : 'Gagal export.')
    } finally {
      setExporting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-40 bg-surface-subtle rounded-2xl animate-pulse mb-2" />
          <div className="h-4 w-32 bg-surface-subtle rounded-xl animate-pulse" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 bg-white rounded-3xl border-2 border-ink shadow-cartoon animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const stats: Stats              = data?.stats           ?? {}
  const recentBookings: any[]     = data?.recent_bookings ?? []
  const revenueByDay: RevenueDay[] = data?.revenue_by_day ?? []
  const revenueByStudio: RevenueStudio[] = data?.revenue_by_studio ?? []
  const monthLabel = format(parseISO(`${month}-01`), 'MMMM yyyy', { locale: idLocale })
  const periodSub  = isThisMonth ? 'bulan ini' : monthLabel

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">Dashboard</h1>
          <p className="text-sm font-semibold text-gray-400 mt-0.5">Ringkasan {periodSub}</p>
        </div>
        <div className="flex gap-2">
          <input
            type="month" value={month} max={THIS_MONTH}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
            className="px-3 py-2.5 rounded-2xl border-2 border-ink bg-white text-sm font-extrabold text-ink shadow-cartoon-sm"
          />
          <button
            onClick={exportMonth} disabled={exporting}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border-2 border-ink bg-amber-400 text-sm font-extrabold text-ink shadow-cartoon-sm disabled:opacity-50"
          >
            <Download className="w-4 h-4" strokeWidth={2.5} /> {exporting ? 'Menyiapkan…' : 'Export'}
          </button>
        </div>
      </div>

      {/* Money waiting to be returned to customers */}
      {stats.pending_refunds > 0 && (
        <Link
          to="/admin/bookings?status=refund"
          className="flex items-center justify-between gap-3 bg-orange-50 border-2 border-orange-400 rounded-2xl shadow-[3px_3px_0_#fb923c] px-5 py-4"
        >
          <p className="text-sm font-extrabold text-orange-700">
            💸 {stats.pending_refunds} pembayaran perlu di-refund ke customer
          </p>
          <span className="text-xs font-extrabold text-orange-600 shrink-0">Lihat →</span>
        </Link>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Pendapatan"
          value={formatIDR(stats.total_revenue ?? 0)}
          sub={periodSub}
          icon={<TrendingUp className="w-4 h-4 text-white" strokeWidth={2.5} />}
          accent="bg-brand-500"
        />
        <StatCard
          label="Total Booking"
          value={String(stats.total_bookings ?? 0)}
          sub={periodSub}
          icon={<CalendarCheck className="w-4 h-4 text-white" strokeWidth={2.5} />}
          accent="bg-amber-400"
        />
        <StatCard
          label="Dikonfirmasi"
          value={String(stats.confirmed_bookings ?? 0)}
          sub={periodSub}
          icon={<CheckCircle className="w-4 h-4 text-white" strokeWidth={2.5} />}
          accent="bg-green-500"
        />
        <StatCard
          label="Sesi Hari Ini"
          value={String(stats.upcoming_today ?? 0)}
          sub="terjadwal"
          icon={<Clock className="w-4 h-4 text-white" strokeWidth={2.5} />}
          accent="bg-rose-400"
        />
      </div>

      {/* Revenue chart */}
      <div className="bg-white rounded-3xl border-2 border-ink shadow-cartoon p-6">
        <p className="text-sm font-extrabold text-ink mb-4">Pendapatan Harian ({monthLabel})</p>
        {revenueByDay.length === 0 ? (
          <div className="h-48 flex items-center justify-center">
            <p className="text-sm font-bold text-gray-300">Belum ada data pendapatan {periodSub}.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={revenueByDay} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#7C3AED" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#7C3AED" stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f0ff" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 700 }}
                tickFormatter={(v) => format(parseISO(v), 'd MMM', { locale: idLocale })}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 700 }}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(v: number) => [formatIDR(v), 'Pendapatan']}
                labelFormatter={(l) => format(parseISO(l), 'EEEE, d MMMM', { locale: idLocale })}
                contentStyle={{ borderRadius: '16px', border: '2px solid #1A1A2E', boxShadow: '4px 4px 0 #1A1A2E', fontSize: 13 }}
              />
              <Area
                type="monotone" dataKey="total"
                stroke="#7C3AED" strokeWidth={2.5}
                fill="url(#colorRevenue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Revenue per studio */}
      {revenueByStudio.length > 0 && (
        <div className="bg-white rounded-3xl border-2 border-ink shadow-cartoon p-6">
          <p className="text-sm font-extrabold text-ink mb-4">Pendapatan per Studio ({monthLabel})</p>
          <div className="space-y-3">
            {revenueByStudio.map((s) => {
              const pct = Math.round((s.total / Math.max(1, stats.total_revenue)) * 100)
              return (
                <div key={s.name}>
                  <div className="flex items-center justify-between gap-3 text-sm mb-1">
                    <span className="font-extrabold text-ink truncate">{s.name}</span>
                    <span className="font-extrabold text-ink shrink-0">{formatIDR(s.total)}</span>
                  </div>
                  <div className="h-3 rounded-full bg-surface-subtle border-2 border-ink overflow-hidden">
                    <div className="h-full" style={{ width: `${pct}%`, background: s.color || '#7C3AED' }} />
                  </div>
                  <p className="text-[11px] font-bold text-gray-400 mt-1">{s.sessions} sesi · {pct}%</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent bookings */}
      <div className="bg-white rounded-3xl border-2 border-ink shadow-cartoon overflow-hidden">
        <div className="px-6 py-4 border-b-2 border-ink">
          <p className="text-sm font-extrabold text-ink">Booking Terbaru</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-extrabold text-gray-400 uppercase tracking-widest bg-surface-muted">
                <th className="px-6 py-3">Pelanggan</th>
                <th className="px-6 py-3">Studio</th>
                <th className="px-6 py-3">Tanggal</th>
                <th className="px-6 py-3">Total</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-surface-subtle">
              {recentBookings.map((b: any) => {
                const badge = STATUS_BADGE[b.status]
                return (
                  <tr key={b.id} className="hover:bg-surface-muted/60 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-extrabold text-ink text-sm">{b.customer_name}</p>
                      <p className="text-xs font-semibold text-gray-400">{b.customer_email}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-extrabold text-gray-700">{b.studio?.name ?? '—'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-gray-700">
                        {b.slot?.date
                          ? format(parseISO(b.slot.date), 'd MMM yyyy', { locale: idLocale })
                          : '—'}
                      </p>
                      <p className="text-xs font-semibold text-gray-400">{b.slot?.start_time?.slice(0, 5)}</p>
                    </td>
                    <td className="px-6 py-4 font-extrabold text-ink">
                      {formatIDR(b.payment?.amount ?? 0)}
                    </td>
                    <td className="px-6 py-4">
                      {badge ? (
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-extrabold border-2 border-ink ${badge.bg} ${badge.text}`}>
                          {badge.label}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">{b.status}</span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {recentBookings.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <p className="text-sm font-bold text-gray-300">Belum ada booking.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
