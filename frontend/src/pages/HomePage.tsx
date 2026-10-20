import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'

export default function HomePage() {
  return (
    <div className="h-full bg-surface-muted overflow-hidden">
      {/* Hero */}
      <section className="h-full flex flex-col items-center justify-center text-center px-4 py-8 md:py-16 relative">
        {/* floating deco blobs */}
        <div className="absolute top-10 left-[5%] w-32 h-32 rounded-full bg-brand-100 border-2 border-brand-200 opacity-60 -z-0 blur-sm" />
        <div className="absolute top-24 right-[8%] w-20 h-20 rounded-full bg-amber-100 border-2 border-amber-200 opacity-70 -z-0 blur-sm" />
        <div className="absolute bottom-8 left-[12%] w-16 h-16 rounded-full bg-pink-100 border-2 border-pink-200 opacity-60 -z-0 blur-sm" />

        {/* badge */}
        <motion.div
          initial={{ opacity: 0, y: -12, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border-2 border-ink shadow-cartoon-sm text-xs font-extrabold text-brand-500 uppercase tracking-wider mb-6 z-10"
        >
          ✨ Poonya Studio · Booking Online
        </motion.div>

        {/* heading */}
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, type: 'spring', stiffness: 260, damping: 22 }}
          className="text-5xl md:text-7xl font-extrabold text-ink tracking-tight leading-[1.05] max-w-2xl z-10"
        >
          Foto yang{' '}
          <span className="relative inline-block">
            <span className="relative z-10 text-brand-500">Bercerita</span>
            <span className="absolute inset-x-0 bottom-1 h-4 bg-amber-300 border-b-2 border-ink -z-0 rounded" />
          </span>
          .
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.18 }}
          className="text-gray-500 text-base md:text-lg mt-5 max-w-sm font-semibold z-10"
        >
          Sewa booth foto per sesi, bayar online, langsung masuk tanpa ribet!
        </motion.p>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.26, type: 'spring', stiffness: 280, damping: 22 }}
          className="mt-8 z-10"
        >
          <Link
            to="/booking"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-brand-500 text-white font-extrabold text-base border-2 border-ink shadow-cartoon-lg hover:-translate-x-1 hover:-translate-y-1 hover:shadow-cartoon-xl active:translate-x-1.5 active:translate-y-1.5 active:shadow-none transition-all duration-100"
          >
            📸 Booking Sekarang
          </Link>
        </motion.div>

        {/* social proof */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.36 }}
          className="mt-4 text-xs font-bold text-gray-400 z-10"
        >
          🌟 Sudah 200+ sesi foto minggu ini
        </motion.p>
      </section>

    </div>
  )
}
