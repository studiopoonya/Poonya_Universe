import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import StudioStep    from '@/components/booking/StudioStep'
import DateTimeStep  from '@/components/booking/DateTimeStep'
import DetailsStep   from '@/components/booking/DetailsStep'
import PaymentStep   from '@/components/booking/PaymentStep'
import StepIndicator from '@/components/ui/StepIndicator'
import type { BookingPayload } from '@/types'

const STEPS = ['Studio', 'Jadwal', 'Data Diri', 'Pembayaran']

const variants = {
  enter:  (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:   (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
}

export default function BookingPage() {
  const [step, setStep]       = useState(0)
  const [dir, setDir]         = useState(1)
  const [booking, setBooking] = useState<Partial<BookingPayload> & { time?: string }>({})

  const go = (next: number) => { setDir(next > step ? 1 : -1); setStep(next) }
  const merge = (data: object) => setBooking((b) => ({ ...b, ...data }))

  // Each step starts at the top — on phones the previous step may have been scrolled far down
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }) }, [step])

  const stepComponents = [
    <StudioStep
      key="studio"
      initialValue={booking.studio_id}
      onNext={(d) => {
        // A slot belongs to one studio — switching studio drops the earlier pick
        merge(d.studio_id === booking.studio_id ? d : { ...d, slot_id: undefined, date: undefined, time: undefined })
        go(1)
      }}
    />,
    <DateTimeStep
      key="dt"
      studioId={booking.studio_id!}
      initialSlotId={booking.slot_id}
      initialDate={booking.date}
      onNext={(d) => { merge(d); go(2) }}
      onBack={() => go(0)}
    />,
    <DetailsStep
      key="det"
      initialValues={booking as any}
      onNext={(d) => { merge(d); go(3) }}
      onBack={() => go(1)}
    />,
    <PaymentStep
      key="pay"
      booking={booking}
      onBack={() => go(2)}
      onRestart={() => go(1)}
    />,
  ]

  return (
    <div className="bg-surface-muted flex flex-col items-center px-4 pt-6 pb-10 md:py-20">
      {/* Hero text */}
      <div className="mb-6 md:mb-10 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="hidden md:inline-block text-5xl mb-3"
        >
          📸
        </motion.div>
        <motion.p
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="text-xs font-extrabold tracking-widest text-brand-500 uppercase mb-2"
        >
          Poonya Studio
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
          className="text-2xl md:text-4xl font-extrabold text-ink tracking-tight"
        >
          Booking Sesi Foto
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.16 }}
          className="hidden md:block text-sm text-gray-400 font-semibold mt-2"
        >
          Booth pribadi · Pencahayaan pro · Hasil instan ✨
        </motion.p>
      </div>

      <StepIndicator steps={STEPS} current={step} />

      <div className="relative w-full max-w-2xl mt-6 md:mt-8 overflow-x-clip pr-1.5 pb-1.5">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            className="bg-white rounded-3xl border-2 border-ink shadow-cartoon-lg p-5 md:p-10"
          >
            {stepComponents[step]}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
