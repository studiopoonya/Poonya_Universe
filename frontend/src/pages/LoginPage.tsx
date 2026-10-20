import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/axios'
import PrimaryButton from '@/components/ui/PrimaryButton'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await api.post('/auth/login', { email, password })
      const { token, user } = res.data
      if (user.role !== 'admin' && user.role !== 'staff') {
        toast.error('Akses ditolak. Hanya admin/staff yang bisa masuk.')
        return
      }
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))
      navigate('/admin', { replace: true })
    } catch (err: any) {
      toast.error(err.response?.status === 429
        ? 'Terlalu banyak percobaan login. Tunggu 1 menit lalu coba lagi.'
        : err.response?.data?.message ?? 'Login gagal. Periksa email dan password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-muted flex items-center justify-center px-4">
      {/* bg deco */}
      <div className="absolute top-16 left-[10%] w-40 h-40 rounded-full bg-brand-100 border-2 border-brand-200 opacity-50 blur-sm" />
      <div className="absolute bottom-20 right-[8%] w-28 h-28 rounded-full bg-amber-100 border-2 border-amber-200 opacity-60 blur-sm" />

      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 280, damping: 26 }}
        className="w-full max-w-sm z-10"
      >
        <div className="text-center mb-6">
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.1 }}
            className="w-16 h-16 bg-brand-500 rounded-3xl border-2 border-ink shadow-cartoon-lg flex items-center justify-center mx-auto mb-4"
          >
            <ShieldCheck className="w-8 h-8 text-white" strokeWidth={2.5} />
          </motion.div>
          <h1 className="text-3xl font-extrabold text-ink">Admin Login</h1>
          <p className="text-sm font-semibold text-gray-400 mt-1">Poonya Studio</p>
        </div>

        <div className="bg-white rounded-3xl border-2 border-ink shadow-cartoon-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@selfstudio.id"
                className="w-full px-4 py-3 rounded-2xl border-2 border-ink text-sm font-semibold text-ink placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500/30 shadow-cartoon-sm transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-2xl border-2 border-ink text-sm font-semibold text-ink placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500/30 shadow-cartoon-sm transition-all"
              />
            </div>
            <div className="pt-2">
              <PrimaryButton type="submit" loading={loading}>
                Masuk 🚀
              </PrimaryButton>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  )
}
