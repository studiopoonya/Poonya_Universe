import Select from '@/components/ui/Select'

interface Props {
  page: number
  lastPage: number
  total: number
  from: number | null
  to: number | null
  perPage: number
  onPage: (page: number) => void
  onPerPage?: (perPage: number) => void
}

/** Page numbers to show: always first/last, the current one ±1, gaps as '…'. */
function pageList(page: number, last: number): (number | '…')[] {
  const keep = new Set([1, last, page - 1, page, page + 1].filter((p) => p >= 1 && p <= last))
  const sorted = [...keep].sort((a, b) => a - b)
  const out: (number | '…')[] = []
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('…')
    out.push(p)
  })
  return out
}

const btn = 'min-w-9 h-9 px-2 rounded-xl border-2 text-sm font-extrabold transition-all duration-100 disabled:opacity-30 disabled:cursor-not-allowed'

/** Pagination bar for Laravel paginated lists. Always visible, so the total is too. */
export default function Pagination({ page, lastPage, total, from, to, perPage, onPage, onPerPage }: Props) {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-5">
      <p className="text-xs font-bold text-gray-400 order-2 sm:order-1">
        {total === 0 ? 'Tidak ada data' : <>Menampilkan <span className="text-ink">{from}–{to}</span> dari <span className="text-ink">{total}</span> booking</>}
      </p>

      <div className="flex items-center gap-1.5 order-1 sm:order-2">
        <button
          type="button" aria-label="Halaman sebelumnya" disabled={page <= 1} onClick={() => onPage(page - 1)}
          className={`${btn} border-ink bg-white text-ink shadow-cartoon-sm`}
        >‹</button>
        {pageList(page, Math.max(1, lastPage)).map((p, i) =>
          p === '…' ? (
            <span key={`gap-${i}`} className="px-1 text-sm font-extrabold text-gray-300">…</span>
          ) : (
            <button
              key={p} type="button" aria-current={p === page ? 'page' : undefined} onClick={() => onPage(p)}
              className={`${btn} ${p === page ? 'border-ink bg-brand-500 text-white shadow-cartoon-sm' : 'border-transparent bg-transparent text-gray-500 hover:border-ink hover:bg-white'}`}
            >{p}</button>
          ),
        )}
        <button
          type="button" aria-label="Halaman berikutnya" disabled={page >= lastPage} onClick={() => onPage(page + 1)}
          className={`${btn} border-ink bg-white text-ink shadow-cartoon-sm`}
        >›</button>
      </div>

      {onPerPage && (
        <label className="flex items-center gap-2 text-xs font-bold text-gray-400 order-3">
          Per halaman
          <Select
            size="sm" className="w-20" ariaLabel="Jumlah per halaman"
            value={perPage} onChange={onPerPage}
            options={[10, 20, 50].map((n) => ({ value: n, label: String(n) }))}
          />
        </label>
      )}
    </div>
  )
}
