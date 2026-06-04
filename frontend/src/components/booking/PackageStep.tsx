import { useState } from 'react'
import { motion } from 'framer-motion'
import { usePackages } from '@/hooks/usePackages'
import PrimaryButton from '@/components/ui/PrimaryButton'
import SkeletonCard from '@/components/ui/SkeletonCard'
import { formatIDR } from '@/lib/utils'

interface Props {
  onNext: (data: { package_id: number }) => void
  initialValue?: number
}

const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } }
const item = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 28 } },
}

export default function PackageStep({ onNext, initialValue }: Props) {
  const { data: packages = [], isLoading } = usePackages()
  const [selected, setSelected] = useState<number | null>(initialValue ?? null)

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">Pilih Paket</h2>
      <p className="text-sm text-gray-400 mb-6">Pilih sesi yang sesuai dengan kebutuhanmu.</p>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} className="h-28" />)}
        </div>
      ) : (
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-3">
          {packages.map((pkg) => (
            <motion.button
              key={pkg.id}
              variants={item}
              onClick={() => setSelected(pkg.id)}
              className={`
                w-full text-left p-5 rounded-2xl border-2 transition-all duration-200
                ${selected === pkg.id
                  ? 'border-brand-500 bg-brand-50 shadow-card-hover'
                  : 'border-transparent bg-surface-subtle hover:border-gray-200'}
              `}
            >
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{pkg.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{pkg.duration_min} menit</p>
                  <ul className="mt-2 space-y-0.5">
                    {pkg.features?.map((f, fi) => (
                      <li key={fi} className="text-xs text-gray-500 flex items-center gap-1.5">
                        <span className="text-brand-500 shrink-0">✦</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold text-gray-900">{formatIDR(pkg.price)}</p>
                  {selected === pkg.id && (
                    <motion.span
                      initial={{ scale: 0 }} animate={{ scale: 1 }}
                      className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wide text-brand-500 bg-white border border-brand-500/30 px-2 py-0.5 rounded-full"
                    >
                      Dipilih
                    </motion.span>
                  )}
                </div>
              </div>
            </motion.button>
          ))}
        </motion.div>
      )}

      <div className="mt-8">
        <PrimaryButton
          disabled={!selected}
          onClick={() => selected && onNext({ package_id: selected })}
        >
          Lanjut →
        </PrimaryButton>
      </div>
    </div>
  )
}
