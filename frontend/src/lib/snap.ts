import api from '@/lib/axios'

const SANDBOX_SNAP = 'https://app.sandbox.midtrans.com/snap/snap.js'

export interface SnapCallbacks {
  onSuccess?: () => void
  onPending?: () => void
  onError?: () => void
  onClose?: () => void
}

let loading: Promise<void> | null = null

/**
 * Load Midtrans snap.js once, using the Sandbox/Production URL and client key
 * saved in admin Settings (falls back to sandbox + VITE_MIDTRANS_CLIENT_KEY).
 */
function loadSnap(): Promise<void> {
  if ((window as any).snap) return Promise.resolve()
  if (loading) return loading

  loading = api.get('/settings')
    .then((r) => r.data)
    .catch(() => ({}))
    .then((settings: Record<string, string>) => new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = settings.midtrans_snap_url || SANDBOX_SNAP
      script.setAttribute('data-client-key', settings.midtrans_client_key || (import.meta.env.VITE_MIDTRANS_CLIENT_KEY ?? ''))
      script.onload  = () => resolve()
      script.onerror = () => { script.remove(); reject(new Error('Gagal memuat Midtrans')) }
      document.head.appendChild(script)
    }))
    .finally(() => { loading = null })

  return loading
}

export async function openSnap(token: string, callbacks: SnapCallbacks = {}): Promise<void> {
  await loadSnap()
  ;(window as any).snap.pay(token, callbacks)
}
