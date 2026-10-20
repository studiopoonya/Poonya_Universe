import { useMutation, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import toast from 'react-hot-toast'
import api from '@/lib/axios'
import { formatIDR } from '@/lib/utils'
import CashModal from '@/components/admin/CashModal'
import type { Booking } from '@/types'

/**
 * A pay-at-studio customer has arrived: take the cash, confirm the booking and
 * record what was handed over (the change is saved with the payment).
 */
export default function CollectCashModal({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const qc = useQueryClient()
  const amount = booking.payment?.amount ?? 0

  const collect = useMutation({
    mutationFn: (cash: number) => api.patch(`/admin/bookings/${booking.id}/confirm`, { cash_received: cash }),
    onSuccess: (_, cash) => {
      qc.invalidateQueries({ queryKey: ['admin', 'bookings'] })
      qc.invalidateQueries({ queryKey: ['admin', 'dashboard'] })
      toast.success(`Lunas! Kembalian ${formatIDR(cash - amount)}`, { duration: 6000 })
      onClose()
    },
    onError: (err: any) => toast.error(err.response?.data?.message ?? 'Gagal mengonfirmasi.', { duration: 7000 }),
  })

  const when = booking.slot?.date
    ? `${format(parseISO(booking.slot.date), 'EEE, d MMM', { locale: idLocale })} · ${booking.slot.start_time.slice(0, 5)}–${booking.end_time ?? booking.slot.end_time.slice(0, 5)}`
    : ''

  return (
    <CashModal
      price={amount}
      subtitle={`${booking.customer_name}${when ? ` · ${when}` : ''}`}
      loading={collect.isPending}
      onCancel={onClose}
      onConfirm={(cash) => collect.mutate(cash)}
    />
  )
}
