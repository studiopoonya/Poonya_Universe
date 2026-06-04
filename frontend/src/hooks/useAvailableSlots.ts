import { useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'
import type { Slot } from '@/types'

export function useAvailableSlots(studioId: number | null, date: string) {
  return useQuery<Slot[]>({
    queryKey: ['slots', studioId, date],
    queryFn: () =>
      api.get('/slots/available', { params: { studio_id: studioId, date } }).then((r) => r.data),
    enabled: !!studioId && !!date,
    refetchInterval: 10_000,
  })
}
