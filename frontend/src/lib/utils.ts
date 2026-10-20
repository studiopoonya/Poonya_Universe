export function formatIDR(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

/** Download an authenticated API file (e.g. CSV export) — a plain link can't send the Bearer token. */
export async function downloadFile(url: string, params: Record<string, string | undefined>, fallbackName: string) {
  const { default: api } = await import('@/lib/axios')
  const res = await api.get(url, { params, responseType: 'blob' })
  const name = /filename="?([^"]+)"?/.exec(res.headers['content-disposition'] ?? '')?.[1] ?? fallbackName
  const href = URL.createObjectURL(res.data)
  const a = Object.assign(document.createElement('a'), { href, download: name })
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(href)
}
