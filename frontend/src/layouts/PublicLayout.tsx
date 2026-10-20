import { Link, Outlet, useLocation } from 'react-router-dom'
import { Camera } from 'lucide-react'

export default function PublicLayout() {
  // Homepage is a single fixed screen; other pages scroll normally
  const { pathname } = useLocation()
  const isHome = pathname === '/'

  return (
    <div className={`${isHome ? 'h-dvh overflow-hidden' : 'min-h-screen'} flex flex-col bg-surface-muted`}>
      <header className="sticky top-0 z-40 bg-white border-b-3 border-ink">
        <div className="max-w-5xl mx-auto px-4 h-14 md:h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-500 border-2 border-ink shadow-cartoon-sm flex items-center justify-center">
              <Camera className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-extrabold text-ink text-lg tracking-tight">Poonya Studio</span>
          </Link>
          <nav className="flex items-center gap-3">
            {pathname !== '/cek-booking' && (
              <Link to="/cek-booking" className="text-sm font-extrabold text-gray-500 hover:text-ink px-1">
                Cek Booking
              </Link>
            )}
            {/* On phones the homepage already has a big booking button */}
            {isHome && (
            <Link
              to="/booking"
              className="hidden sm:inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-brand-500 text-white text-sm font-extrabold border-2 border-ink shadow-cartoon-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-cartoon active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all duration-100"
            >
              Book Sekarang ✨
            </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1 min-h-0">
        <Outlet />
      </main>

      <footer className="border-t-3 border-ink bg-white py-6 text-center">
        <p className="text-sm font-bold text-gray-400">© 2026 Poonya Studio 📸</p>
      </footer>
    </div>
  )
}
