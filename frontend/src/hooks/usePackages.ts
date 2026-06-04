import { useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'
import type { Package } from '@/types'

export function usePackages() {
  return useQuery<Package[]>({
    queryKey: ['packages'],
    queryFn: () => api.get('/packages').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  })
}
