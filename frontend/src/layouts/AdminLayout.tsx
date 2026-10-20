import { useState, useEffect } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  CalendarCheck,
  Store,
  CreditCard,
  Settings2,
  LogOut,
  Camera,
  Users,
  Mail,
  Menu,
  X,
  ShieldOff,
  Ticket,
  CalendarClock,
} from 'lucide-react'
import api from '@/lib/axios'
import toast from 'react-hot-toast'

const NAV_ITEMS = [
  { to: '/admin',          label: 'Dashboard', icon: LayoutDashboard, end: true,  permission: 'dashboard', adminOnly: false },
  { to: '/admin/bookings', label: 'Bookings',  icon: CalendarCheck,              permission: 'bookings',  adminOnly: false },
  { to: '/admin/studios',  label: 'Studio',    icon: Store,                      permission: 'studios',   adminOnly: false },
  { to: '/admin/schedule', label: 'Jadwal',    icon: CalendarClock,              permission: 'studios',   adminOnly: false },
  { to: '/admin/payment',  label: 'Payment',   icon: CreditCard,                 permission: 'payment',   adminOnly: false },
  { to: '/admin/promos',   label: 'Promo',     icon: Ticket,                     permission: 'promos',    adminOnly: false },
  { to: '/admin/accounts', label: 'Accounts',  icon: Users,                      permission: 'accounts',  adminOnly: true  },
  { to: '/admin/email',    label: 'Email',     icon: Mail,                       permission: 'email',     adminOnly: true  },
  { to: '/admin/settings', label: 'Settings',  icon: Settings2,                  permission: 'settings',  adminOnly: false },
]

function getSavedUser() {
  try { return JSON.parse(localStorage.getItem('user') || 'null') } catch { return null }
}

export default function AdminLayout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [user, setUser] = useState(getSavedUser)
  const [menuOpen, setMenuOpen] = useState(false)

  // Close the phone menu after navigating
  useEffect(() => { setMenuOpen(false) }, [pathname])

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

  // Page reached by URL that this staff account isn't allowed to open (backend blocks the data anyway)
  const currentItem = [...NAV_ITEMS]
    .sort((a, b) => b.to.length - a.to.length)
    .find(item => pathname === item.to || pathname.startsWith(item.to + '/'))
  const blocked = !!user && !!currentItem && !navItems.includes(currentItem)

  const handleLogout = async () => {
    await api.post('/auth/logout').catch(() => {})
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    toast.success('Logged out!')
    navigate('/admin/login')
  }

  const logo = (
    <div className="flex items-center gap-3">
      <div className="w-11 h-11 rounded-2xl bg-brand-500 border-2 border-ink shadow-cartoon flex items-center justify-center">
        <Camera className="w-5 h-5 text-white" strokeWidth={2.5} />
      </div>
      <div>
        <p className="text-[10px] font-extrabold tracking-widest text-brand-500 uppercase">Poonya Studio</p>
        <p className="text-sm font-extrabold text-ink leading-tight">Admin Panel</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen md:flex bg-surface-muted">
      {/* Phone top bar */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-16 bg-white border-b-3 border-ink">
        {logo}
        <button
          onClick={() => setMenuOpen(true)}
          aria-label="Buka menu"
          className="w-11 h-11 rounded-2xl border-2 border-ink shadow-cartoon-sm flex items-center justify-center bg-white"
        >
          <Menu className="w-5 h-5 text-ink" strokeWidth={2.5} />
        </button>
      </header>

      {/* Backdrop behind the phone menu */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
      )}

      {/* Sidebar — fixed column on desktop, slide-in drawer on phones */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 max-w-[85vw] bg-white border-r-3 border-ink flex flex-col
          transition-transform duration-200 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}
          md:sticky md:top-0 md:h-screen md:translate-x-0 md:shrink-0 md:z-auto
        `}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b-3 border-ink flex items-center justify-between">
          {logo}
          <button onClick={() => setMenuOpen(false)} aria-label="Tutup menu" className="md:hidden text-gray-400 hover:text-ink">
            <X className="w-5 h-5" strokeWidth={2.5} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
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
      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto px-4 py-6 md:px-6 md:py-8">
          {blocked ? (
            <div className="max-w-md mx-auto mt-10 bg-white rounded-3xl border-2 border-ink shadow-cartoon p-8 text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-rose-100 border-2 border-ink shadow-cartoon-sm flex items-center justify-center">
                <ShieldOff className="w-6 h-6 text-rose-500" strokeWidth={2.5} />
              </div>
              <h1 className="text-xl font-extrabold text-ink mb-1">Tidak Punya Akses</h1>
              <p className="text-sm font-semibold text-gray-400 mb-6">
                Akun kamu belum diberi akses ke halaman ini. Hubungi admin untuk membukanya.
              </p>
              <NavLink
                to="/admin"
                className="inline-flex items-center justify-center w-full py-3 rounded-2xl bg-brand-500 text-white font-extrabold text-sm border-2 border-ink shadow-cartoon-sm"
              >
                Kembali ke Dashboard
              </NavLink>
            </div>
          ) : (
            <Outlet />
          )}
        </div>
      </main>
    </div>
  )
}
