import { useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'

export function useBookingStatus(bookingId: number | null) {
  return useQuery<{ status: string; confirmed_at?: string }>({
    queryKey: ['booking-status', bookingId],
    queryFn: () => api.get(`/bookings/${bookingId}/status`).then((r) => r.data),
    enabled: !!bookingId,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status === 'confirmed' || status === 'cancelled' || status === 'expired') return false
      return 2000
    },
  })
}
