import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import PublicLayout from '@/layouts/PublicLayout'
import AdminLayout  from '@/layouts/AdminLayout'
import HomePage       from '@/pages/HomePage'
import BookingPage    from '@/pages/BookingPage'
import BookingSuccessPage from '@/pages/BookingSuccessPage'
import LoginPage      from '@/pages/LoginPage'
import AdminDashboard from '@/pages/admin/AdminDashboard'
import AdminStudios   from '@/pages/admin/AdminStudios'
import AdminBookings  from '@/pages/admin/AdminBookings'
import AdminPayment   from '@/pages/admin/AdminPayment'
import AdminSettings  from '@/pages/admin/AdminSettings'
import AdminAccounts  from '@/pages/admin/AdminAccounts'
import AdminEmail     from '@/pages/admin/AdminEmail'
import AdminPromos    from '@/pages/admin/AdminPromos'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token')
  if (!token) return <Navigate to="/admin/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route element={<PublicLayout />}>
            <Route path="/"        element={<HomePage />} />
            <Route path="/booking" element={<BookingPage />} />
            <Route path="/booking/success" element={<BookingSuccessPage />} />
          </Route>

          {/* Admin login (no auth required) */}
          <Route path="/admin/login" element={<LoginPage />} />

          {/* Admin (auth required) */}
          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <AdminLayout />
              </RequireAdmin>
            }
          >
            <Route index                element={<AdminDashboard />} />
            <Route path="bookings"      element={<AdminBookings />} />
            <Route path="studios"       element={<AdminStudios />} />
            <Route path="payment"       element={<AdminPayment />} />
            <Route path="settings"      element={<AdminSettings />} />
            <Route path="accounts"      element={<AdminAccounts />} />
            <Route path="email"         element={<AdminEmail />} />
            <Route path="promos"        element={<AdminPromos />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            borderRadius: '12px',
            background: '#fff',
            color: '#1f2937',
            fontSize: '14px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          },
        }}
      />
    </QueryClientProvider>
  )
}
