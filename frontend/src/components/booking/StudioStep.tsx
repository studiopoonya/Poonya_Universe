import { useEffect, useRef, useState } from 'react'
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

function StudioPhoto({ studio }: { studio: Studio }) {
  if (studio.thumbnail_url) {
    return <img src={studio.thumbnail_url} alt={studio.name} loading="lazy" draggable={false} className="w-full h-full object-cover" />
  }
  // No photo yet: studio colour as a placeholder
  return (
    <div
      className="w-full h-full flex items-center justify-center text-5xl"
      style={{ background: `linear-gradient(135deg, ${studio.color}33, ${studio.color}88)` }}
    >
      📸
    </div>
  )
}

/** Studios as a horizontal, swipeable carousel — big photos read better than a stacked list. */
export default function StudioStep({ onNext, initialValue }: Props) {
  const { data: studios = [], isLoading } = useStudios()
  const [selected, setSelected] = useState<number | null>(initialValue ?? null)
  const [active, setActive]     = useState(0) // card in view, for the dots
  const trackRef = useRef<HTMLDivElement>(null)

  const cardAt = (i: number) => trackRef.current?.children[i] as HTMLElement | undefined

  const scrollTo = (i: number, smooth = true) => {
    const track = trackRef.current
    const card  = cardAt(i)
    if (!track || !card) return
    track.scrollTo({ left: card.offsetLeft - (track.clientWidth - card.clientWidth) / 2, behavior: smooth ? 'smooth' : 'auto' })
  }

  // Coming back to this step: show the studio picked earlier
  useEffect(() => {
    const i = studios.findIndex((s) => s.id === initialValue)
    if (i > 0) scrollTo(i, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studios.length])

  const onScroll = () => {
    const track = trackRef.current
    if (!track) return
    const center = track.scrollLeft + track.clientWidth / 2
    let best = 0
    studios.forEach((_, i) => {
      const c = cardAt(i)
      const prev = cardAt(best)
      if (c && prev && Math.abs(c.offsetLeft + c.clientWidth / 2 - center) < Math.abs(prev.offsetLeft + prev.clientWidth / 2 - center)) best = i
    })
    setActive(best)
  }

  const pick = (i: number) => {
    setSelected(studios[i].id)
    scrollTo(i)
  }

  return (
    <div>
      <h2 className="text-xl md:text-2xl font-extrabold text-ink mb-1">Pilih Studio 🏠</h2>
      <p className="text-sm text-gray-400 font-semibold mb-5">Geser untuk lihat semua studio, lalu ketuk untuk memilih.</p>

      {isLoading ? (
        <div className="flex gap-4 overflow-hidden">
          {[1, 2].map((i) => <SkeletonCard key={i} className="h-80 w-[82%] shrink-0" />)}
        </div>
      ) : (
        <>
          <div className="relative">
            <div
              ref={trackRef}
              onScroll={onScroll}
              className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-none -mx-5 px-5 md:-mx-10 md:px-10 pt-1 pb-4"
            >
              {studios.map((studio, i) => {
                const isSelected = selected === studio.id
                return (
                  <motion.button
                    key={studio.id}
                    type="button"
                    onClick={() => pick(i)}
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06, type: 'spring', stiffness: 320, damping: 28 }}
                    className={`
                      snap-center shrink-0 w-[82%] sm:w-[62%] md:w-[46%] text-left rounded-3xl border-2 border-ink overflow-hidden bg-white transition-all duration-100
                      ${isSelected ? 'shadow-cartoon-lg ring-4 ring-brand-500/30' : 'shadow-cartoon'}
                    `}
                  >
                    {/* photo */}
                    <div className="relative aspect-[4/3] border-b-2 border-ink overflow-hidden">
                      <StudioPhoto studio={studio} />
                      <span className="absolute top-3 left-3 text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-white border-2 border-ink shadow-cartoon-sm">
                        👥 Max {studio.capacity} orang
                      </span>
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }} animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-brand-500 border-2 border-ink flex items-center justify-center shadow-cartoon-sm"
                        >
                          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </motion.div>
                      )}
                    </div>

                    {/* details */}
                    <div className={`p-4 transition-colors ${isSelected ? 'bg-brand-50' : 'bg-white'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-3 h-3 rounded-full border-2 border-ink shrink-0" style={{ background: studio.color }} />
                        <p className="font-extrabold text-ink text-base leading-tight truncate">{studio.name}</p>
                      </div>
                      <p className="text-xl font-extrabold text-ink">
                        {formatIDR(studio.price)}<span className="text-xs font-bold text-gray-400"> / sesi</span>
                      </p>
                      {studio.weekend_price && studio.weekend_price !== studio.price && (
                        <p className="text-[11px] font-bold text-amber-600">Weekend {formatIDR(studio.weekend_price)}</p>
                      )}
                      <p className="text-xs text-gray-400 font-semibold mt-2 leading-relaxed line-clamp-2">{studio.description}</p>
                      {!!studio.features?.length && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {studio.features.slice(0, 4).map((f) => (
                            <span
                              key={f}
                              className="text-[10px] font-extrabold px-2 py-0.5 rounded-full border-2"
                              style={{ background: studio.color + '20', color: studio.color, borderColor: studio.color }}
                            >
                              {f}
                            </span>
                          ))}
                          {studio.features.length > 4 && (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 text-gray-400">+{studio.features.length - 4}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.button>
                )
              })}
            </div>

            {/* arrows for mouse users (phones just swipe) */}
            {studios.length > 1 && (
              <>
                <button
                  type="button" aria-label="Studio sebelumnya"
                  onClick={() => scrollTo(Math.max(0, active - 1))}
                  disabled={active === 0}
                  className="hidden md:flex absolute -left-5 top-1/3 w-10 h-10 rounded-full bg-white border-2 border-ink shadow-cartoon-sm items-center justify-center text-lg font-extrabold disabled:opacity-0 transition-opacity"
                >‹</button>
                <button
                  type="button" aria-label="Studio berikutnya"
                  onClick={() => scrollTo(Math.min(studios.length - 1, active + 1))}
                  disabled={active === studios.length - 1}
                  className="hidden md:flex absolute -right-5 top-1/3 w-10 h-10 rounded-full bg-white border-2 border-ink shadow-cartoon-sm items-center justify-center text-lg font-extrabold disabled:opacity-0 transition-opacity"
                >›</button>
              </>
            )}
          </div>

          {/* dots */}
          {studios.length > 1 && (
            <div className="flex justify-center gap-1.5 mt-1">
              {studios.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  aria-label={`Lihat ${s.name}`}
                  onClick={() => scrollTo(i)}
                  className={`h-2 rounded-full border border-ink transition-all ${i === active ? 'w-6 bg-brand-500' : 'w-2 bg-white'}`}
                />
              ))}
            </div>
          )}
        </>
      )}

      <StepActions>
        <PrimaryButton disabled={!selected} onClick={() => selected && onNext({ studio_id: selected })}>
          {selected ? `Lanjut dengan ${studios.find((s) => s.id === selected)?.name.split(' — ')[0] ?? 'studio ini'} →` : 'Pilih studio dulu'}
        </PrimaryButton>
      </StepActions>
    </div>
  )
}
