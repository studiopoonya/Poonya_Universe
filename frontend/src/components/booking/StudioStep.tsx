import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
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

/**
 * Card size and where each neighbour sits, by screen size. The active card stays at z=0
 * (pushing it toward the viewer makes Chrome upscale it and blurs the text); depth
 * comes from sending the neighbours back instead.
 */
function useGeometry() {
  const get = () => (window.innerWidth < 480
    ? { w: 210, h: 280, stage: 320, x: [0, 112, 190], z: [0, -180, -340], rot: [0, 40, 46], scale: [1, 0.8, 0.62], op: [1, 0.75, 0] }
    : window.innerWidth < 860
      ? { w: 240, h: 320, stage: 360, x: [0, 150, 260], z: [0, -170, -330], rot: [0, 42, 46], scale: [1, 0.84, 0.68], op: [1, 0.9, 0.5] }
      : { w: 260, h: 346, stage: 390, x: [0, 175, 310], z: [0, -180, -340], rot: [0, 42, 46], scale: [1, 0.86, 0.7], op: [1, 0.92, 0.55] })
  const [g, setG] = useState(get)
  useEffect(() => {
    const onResize = () => setG(get())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return g
}

function StudioPhoto({ studio }: { studio: Studio }) {
  if (studio.thumbnail_url) {
    return <img src={studio.thumbnail_url} alt={studio.name} draggable={false} className="absolute inset-0 w-full h-full object-cover" />
  }
  // No photo yet: studio colour as a placeholder
  return (
    <div
      className="absolute inset-0 flex items-center justify-center text-6xl"
      style={{ background: `linear-gradient(150deg, ${studio.color}55 0%, ${studio.color} 60%, #1A1A2E 120%)` }}
    >
      <span className="-mt-16 drop-shadow-lg">📸</span>
    </div>
  )
}

/**
 * Studios as a 3D coverflow: the centred card faces front and is the selection,
 * neighbours rotate away and recede. Swipe, tap a side card, arrows, dots or ←/→.
 */
export default function StudioStep({ onNext, initialValue }: Props) {
  const { data: studios = [], isLoading } = useStudios()
  const g = useGeometry()
  const [active, setActive] = useState(0)
  const ready = useRef(false)
  const touchX = useRef<number | null>(null)

  // Start on the studio picked earlier, otherwise the middle one so both sides show
  useEffect(() => {
    if (ready.current || !studios.length) return
    ready.current = true
    const i = studios.findIndex((s) => s.id === initialValue)
    setActive(i >= 0 ? i : Math.floor((studios.length - 1) / 2))
  }, [studios, initialValue])

  const go = (i: number) => setActive(Math.max(0, Math.min(studios.length - 1, i)))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea, select')) return
      if (e.key === 'ArrowLeft') setActive((a) => Math.max(0, a - 1))
      if (e.key === 'ArrowRight') setActive((a) => Math.min(studios.length - 1, a + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [studios.length])

  const cardStyle = (d: number): React.CSSProperties => {
    const k = Math.min(Math.abs(d), 2)
    const side = Math.sign(d)
    const far = Math.abs(d) > 2
    return {
      width: g.w,
      height: g.h,
      marginLeft: -g.w / 2,
      marginTop: -g.h / 2,
      transform: far
        ? `translate3d(${side * g.x[2]}px,0,-520px) scale(.4)`
        : `translate3d(${side * g.x[k]}px,0,${g.z[k]}px) rotateY(${-side * g.rot[k]}deg) scale(${g.scale[k]})`,
      opacity: far ? 0 : g.op[k],
      zIndex: 50 - Math.abs(d) * 10,
      pointerEvents: far || g.op[k] === 0 ? 'none' : 'auto',
      boxShadow: d === 0
        ? '0 30px 60px -22px rgba(124,58,237,.55), 6px 6px 0 #1A1A2E'
        : '4px 4px 0 #1A1A2E',
    }
  }

  const current = studios[active]

  return (
    <div>
      <h2 className="text-xl md:text-2xl font-extrabold text-ink mb-1">Pilih Studio 🏠</h2>
      <p className="text-sm text-gray-400 font-semibold mb-2">Geser untuk lihat studio lain.</p>

      {isLoading ? (
        <SkeletonCard className="h-80 w-56 mx-auto my-6" />
      ) : (
        <>
          {/* 3D stage — bleeds to the card edges so side cards have room */}
          <div
            className="relative -mx-5 md:-mx-10 overflow-hidden select-none touch-pan-y"
            style={{ height: g.stage + 24 }}
            onTouchStart={(e) => { touchX.current = e.touches[0].clientX }}
            onTouchEnd={(e) => {
              if (touchX.current === null) return
              const dx = e.changedTouches[0].clientX - touchX.current
              if (Math.abs(dx) > 40) go(active + (dx < 0 ? 1 : -1))
              touchX.current = null
            }}
          >
            {/* soft glow under the active card */}
            <div className="pointer-events-none absolute inset-x-0 bottom-4 mx-auto h-16 max-w-xs rounded-[100%] bg-brand-500/20 blur-2xl" />

            <div className="absolute inset-0" style={{ perspective: 1600, transformStyle: 'preserve-3d' }}>
              {studios.map((studio, i) => {
                const d = i - active
                return (
                  <button
                    key={studio.id}
                    type="button"
                    aria-label={studio.name}
                    aria-current={d === 0}
                    onClick={() => go(i)}
                    className="absolute top-1/2 left-1/2 rounded-[22px] border-2 border-ink overflow-hidden bg-ink text-left will-change-transform"
                    style={{ ...cardStyle(d), transition: 'transform .55s cubic-bezier(.22,.61,.36,1), opacity .55s ease, box-shadow .55s ease' }}
                  >
                    <StudioPhoto studio={studio} />
                    {/* sheen */}
                    <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 80% at 30% 20%, rgba(255,255,255,.22), transparent 60%)' }} />
                    <span className="absolute top-3 left-3 text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-white border-2 border-ink">
                      👥 Max {studio.capacity}
                    </span>
                    {/* label */}
                    <div
                      className="absolute inset-x-0 bottom-0 px-4 pb-4 pt-12"
                      style={{ background: 'linear-gradient(to top, rgba(26,26,46,.95), rgba(26,26,46,.5) 55%, transparent)' }}
                    >
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/70">
                        {studio.name.split(' — ')[1] ?? 'Studio'}
                      </p>
                      <p className="text-lg font-extrabold text-white leading-tight">{studio.name.split(' — ')[0]}</p>
                      <p className="text-sm font-extrabold text-amber-300 mt-0.5">
                        {formatIDR(studio.price)}<span className="text-white/60 font-bold text-xs"> / sesi</span>
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* controls */}
          {studios.length > 1 && (
            <div className="flex items-center justify-center gap-5 mt-1">
              <button
                type="button" aria-label="Studio sebelumnya" onClick={() => go(active - 1)} disabled={active === 0}
                className="w-10 h-10 rounded-full bg-white border-2 border-ink shadow-cartoon-sm grid place-items-center text-lg font-extrabold text-ink hover:scale-110 transition disabled:opacity-30 disabled:hover:scale-100"
              >‹</button>
              <div className="flex items-center gap-2">
                {studios.map((s, i) => (
                  <button
                    key={s.id} type="button" aria-label={`Lihat ${s.name}`} onClick={() => go(i)}
                    className="h-2.5 rounded-full border border-ink transition-all duration-300"
                    style={i === active
                      ? { width: 28, background: 'linear-gradient(90deg,#7C3AED,#F472B6)', boxShadow: '0 0 12px rgba(124,58,237,.55)' }
                      : { width: 10, background: '#fff' }}
                  />
                ))}
              </div>
              <button
                type="button" aria-label="Studio berikutnya" onClick={() => go(active + 1)} disabled={active === studios.length - 1}
                className="w-10 h-10 rounded-full bg-white border-2 border-ink shadow-cartoon-sm grid place-items-center text-lg font-extrabold text-ink hover:scale-110 transition disabled:opacity-30 disabled:hover:scale-100"
              >›</button>
            </div>
          )}

          {/* details of the centred studio */}
          <AnimatePresence mode="wait">
            {current && (
              <motion.div
                key={current.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="mt-5 rounded-2xl bg-surface-subtle border-2 border-ink/10 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-3 h-3 rounded-full border-2 border-ink shrink-0" style={{ background: current.color }} />
                    <p className="font-extrabold text-ink truncate">{current.name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-extrabold text-ink">{formatIDR(current.price)}</p>
                    {current.weekend_price && current.weekend_price !== current.price && (
                      <p className="text-[11px] font-bold text-amber-600">Weekend {formatIDR(current.weekend_price)}</p>
                    )}
                  </div>
                </div>
                {current.description && <p className="text-xs text-gray-500 font-semibold mt-2 leading-relaxed">{current.description}</p>}
                {!!current.features?.length && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {current.features.map((f) => (
                      <span
                        key={f}
                        className="text-[10px] font-extrabold px-2.5 py-1 rounded-full border-2"
                        style={{ background: current.color + '20', color: current.color, borderColor: current.color }}
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      <StepActions>
        <PrimaryButton disabled={!current} onClick={() => current && onNext({ studio_id: current.id })}>
          {current ? `Lanjut dengan ${current.name.split(' — ')[0]} →` : 'Lanjut →'}
        </PrimaryButton>
      </StepActions>
    </div>
  )
}
