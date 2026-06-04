import { useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'
import type { Studio } from '@/types'

export function useStudios() {
  return useQuery<Studio[]>({
    queryKey: ['studios'],
    queryFn: () => api.get('/studios').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  })
}
