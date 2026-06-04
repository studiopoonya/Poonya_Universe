import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  CalendarCheck,
  Store,
  CreditCard,
  Settings2,
  LogOut,
  Camera,
  Users,
} from 'lucide-react'
import api from '@/lib/axios'
import toast from 'react-hot-toast'

const NAV_ITEMS = [
  { to: '/admin',          label: 'Dashboard', icon: LayoutDashboard, end: true,  permission: 'dashboard', adminOnly: false },
  { to: '/admin/bookings', label: 'Bookings',  icon: CalendarCheck,              permission: 'bookings',  adminOnly: false },
  { to: '/admin/studios',  label: 'Studio',    icon: Store,                      permission: 'studios',   adminOnly: false },
  { to: '/admin/payment',  label: 'Payment',   icon: CreditCard,                 permission: 'payment',   adminOnly: false },
  { to: '/admin/accounts', label: 'Accounts',  icon: Users,                      permission: 'accounts',  adminOnly: true  },
  { to: '/admin/settings', label: 'Settings',  icon: Settings2,                  permission: 'settings',  adminOnly: false },
]

function getSavedUser() {
  try { return JSON.parse(localStorage.getItem('user') || 'null') } catch { return null }
}

export default function AdminLayout() {
  const navigate = useNavigate()
  const [user, setUser] = useState(getSavedUser)

  useEffect(() => {
    api.get('/auth/me').then(res => {
      const u = res.data
      localStorage.setItem('user', JSON.stringify(u))
      setUser(u)
    }).catch(() => {})
  }, [])

  const isAdmin = user?.role === 'admin'
  const perms: string[] = user?.permissions ?? []

  const navItems = NAV_ITEMS.filter(item => {
    if (!user) return item.permission === 'dashboard'
    if (item.adminOnly) return isAdmin
    if (isAdmin) return true
    return item.permission === 'dashboard' || perms.includes(item.permission)
  })

  const handleLogout = async () => {
    await api.post('/auth/logout').catch(() => {})
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    toast.success('Logged out!')
    navigate('/admin/login')
  }

  return (
    <div className="min-h-screen flex bg-surface-muted">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-white border-r-3 border-ink flex flex-col">

        {/* Logo */}
        <div className="px-5 py-5 border-b-3 border-ink">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-brand-500 border-2 border-ink shadow-cartoon flex items-center justify-center">
              <Camera className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-[10px] font-extrabold tracking-widest text-brand-500 uppercase">Self Studio</p>
              <p className="text-sm font-extrabold text-ink leading-tight">Admin Panel</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-extrabold transition-all duration-100 border-2
                   ${isActive
                     ? 'bg-brand-500 text-white border-ink shadow-cartoon-sm -translate-x-0.5 -translate-y-0.5'
                     : 'text-gray-400 border-transparent hover:bg-surface-subtle hover:text-ink hover:border-ink hover:shadow-cartoon-sm'}`
                }
              >
                <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={2.5} />
                {item.label}
              </NavLink>
            )
          })}
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t-3 border-ink">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-extrabold text-gray-400 border-2 border-transparent hover:bg-rose-50 hover:text-rose-500 hover:border-rose-300 hover:shadow-[3px_3px_0_#fca5a5] transition-all duration-100"
          >
            <LogOut className="w-[18px] h-[18px] shrink-0" strokeWidth={2.5} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
