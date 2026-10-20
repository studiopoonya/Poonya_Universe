import { useState } from 'react'
import { motion } from 'framer-motion'
import { useStudios } from '@/hooks/useStudios'
import PrimaryButton from '@/components/ui/PrimaryButton'
import StepActions from '@/components/ui/StepActions'
import SkeletonCard from '@/components/ui/SkeletonCard'
import { formatIDR } from '@/lib/utils'
import type { Studio } from '@/types'

interface Props {
  onNext: (data: { studio_id: number }) => void
  initialValue?: number
}

const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } }
const item = {
  hidden: { opacity: 0, y: 20 },
  show:   { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 320, damping: 26 } },
}

export default function StudioStep({ onNext, initialValue }: Props) {
  const { data: studios = [], isLoading } = useStudios()
  const [selected, setSelected] = useState<number | null>(initialValue ?? null)

  return (
    <div>
      <h2 className="text-xl md:text-2xl font-extrabold text-ink mb-1">Pilih Studio 🏠</h2>
      <p className="text-sm text-gray-400 font-semibold mb-6">Setiap studio punya vibe dan fasilitas berbeda.</p>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} className="h-36" />)}
        </div>
      ) : (
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-3">
          {studios.map((studio: Studio) => {
            const isSelected = selected === studio.id
            return (
              <motion.button
                key={studio.id}
                variants={item}
                onClick={() => setSelected(studio.id)}
                className={`
                  w-full text-left rounded-3xl border-2 border-ink overflow-hidden transition-all duration-100
                  ${isSelected
                    ? 'shadow-cartoon-lg -translate-x-0.5 -translate-y-0.5'
                    : 'shadow-cartoon hover:shadow-cartoon-lg hover:-translate-x-0.5 hover:-translate-y-0.5'}
                `}
              >
                <div className="h-2 w-full" style={{ background: studio.color }} />

                <div className={`p-4 md:p-5 transition-colors ${isSelected ? 'bg-brand-50' : 'bg-white'}`}>
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-3 h-3 rounded-full border-2 border-ink shrink-0" style={{ background: studio.color }} />
                        <p className="font-extrabold text-ink text-[15px] leading-tight">{studio.name}</p>
                      </div>
                      <p className="text-xs text-gray-400 font-semibold mb-3 leading-relaxed">{studio.description}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {studio.features?.map((f, fi) => (
                          <span
                            key={fi}
                            className="text-[10px] font-extrabold px-2.5 py-1 rounded-full border-2"
                            style={{ background: studio.color + '20', color: studio.color, borderColor: studio.color }}
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-lg md:text-xl font-extrabold text-ink">{formatIDR(studio.price)}</p>
                      <p className="text-[10px] font-bold text-gray-400 mt-0.5">per sesi</p>
                      {studio.weekend_price && studio.weekend_price !== studio.price && (
                        <p className="text-[10px] font-bold text-amber-600 mt-0.5">Weekend {formatIDR(studio.weekend_price)}</p>
                      )}
                      <p className="text-[10px] font-bold text-gray-400 mt-1">Max {studio.capacity} orang</p>
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }} animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                          className="mt-2 w-7 h-7 rounded-full border-2 border-ink flex items-center justify-center ml-auto shadow-cartoon-sm"
                          style={{ background: studio.color }}
                        >
                          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </motion.div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.button>
            )
          })}
        </motion.div>
      )}

      <StepActions>
        <PrimaryButton disabled={!selected} onClick={() => selected && onNext({ studio_id: selected })}>
          Lanjut →
        </PrimaryButton>
      </StepActions>
    </div>
  )
}
