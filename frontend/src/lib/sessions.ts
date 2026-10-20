import type { Slot } from '@/types'

/** Max 30-minute sessions per booking — keep in sync with Booking::MAX_SESSIONS. */
export const MAX_SESSIONS = 4

export const SESSION_OPTIONS = [1, 2, 3, 4].map((n) => ({
  sessions: n,
  label: n === 1 ? '30 menit' : n % 2 === 0 ? `${n / 2} jam` : `${(n / 2).toString().replace('.', ',')} jam`,
}))

/**
 * The `sessions` slots starting at `slots[i]`, if they are all free and back to back
 * (same rule the backend enforces), otherwise null. `slots` must be sorted by time.
 */
export function runFrom(slots: Slot[], i: number, sessions: number): Slot[] | null {
  const run = slots.slice(i, i + sessions)
  if (run.length !== sessions) return null
  const ok = run.every((s, k) => s.is_available && (k === 0 || s.start_time.slice(0, 5) === run[k - 1].end_time.slice(0, 5)))
  return ok ? run : null
}

export const durationLabel = (sessions: number) =>
  SESSION_OPTIONS.find((o) => o.sessions === sessions)?.label ?? `${sessions * 30} menit`
