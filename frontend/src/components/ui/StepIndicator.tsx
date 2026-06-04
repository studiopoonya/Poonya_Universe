import { motion } from 'framer-motion'

interface Props {
  steps: string[]
  current: number
}

export default function StepIndicator({ steps, current }: Props) {
  return (
    <div className="flex items-center gap-1">
      {steps.map((label, i) => {
        const done   = i < current
        const active = i === current
        return (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <motion.div
                initial={false}
                animate={{ scale: active ? 1.1 : 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                className={`
                  w-9 h-9 rounded-full flex items-center justify-center text-sm font-extrabold
                  border-2 border-ink transition-colors duration-200
                  ${active ? 'bg-brand-500 text-white shadow-cartoon-sm' : ''}
                  ${done   ? 'bg-amber-400 text-ink shadow-cartoon-sm' : ''}
                  ${!active && !done ? 'bg-white text-gray-400' : ''}
                `}
              >
                {done ? (
                  <motion.svg
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                    className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </motion.svg>
                ) : i + 1}
              </motion.div>
              <span className={`text-[10px] font-bold hidden sm:block whitespace-nowrap
                ${active ? 'text-brand-500' : done ? 'text-amber-500' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className="w-8 md:w-14 h-0.5 mx-2 bg-gray-200 relative overflow-hidden mb-4">
                {done && (
                  <motion.div
                    className="absolute inset-y-0 left-0 bg-amber-400"
                    initial={{ width: 0 }} animate={{ width: '100%' }}
                    transition={{ duration: 0.35 }}
                  />
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
