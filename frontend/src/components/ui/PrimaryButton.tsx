import { motion } from 'framer-motion'

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean
  variant?: 'primary' | 'ghost' | 'danger'
}

export default function PrimaryButton({
  children, loading, disabled, variant = 'primary', className = '', ...props
}: Props) {
  const base = `
    inline-flex items-center justify-center gap-2 font-extrabold text-sm
    transition-all duration-100 py-3.5 px-6 rounded-2xl border-2 border-ink
    disabled:opacity-40 disabled:cursor-not-allowed select-none
  `
  const styles = {
    primary: 'w-full text-white bg-brand-500 shadow-cartoon hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-cartoon-lg active:translate-x-1 active:translate-y-1 active:shadow-none',
    ghost:   'text-ink bg-white shadow-cartoon-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-cartoon active:translate-x-0.5 active:translate-y-0.5 active:shadow-none',
    danger:  'w-full text-white bg-rose-500 shadow-cartoon hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-cartoon-lg active:translate-x-1 active:translate-y-1 active:shadow-none',
  }

  return (
    <motion.button
      whileTap={!disabled && !loading ? { scale: 0.98 } : {}}
      {...(props as any)}
      disabled={disabled || loading}
      className={`${base} ${styles[variant]} ${className}`}
    >
      {loading ? (
        <>
          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Memproses…
        </>
      ) : children}
    </motion.button>
  )
}
