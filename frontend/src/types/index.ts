export interface Studio {
  id: number
  name: string
  slug: string
  description: string
  price: number
  capacity: number
  features: string[]
  thumbnail_url?: string
  color: string
  is_active: boolean
  sort_order: number
}

export interface Slot {
  id: number
  start_time: string
  end_time: string
  is_available: boolean
}

export interface BookingPayload {
  studio_id: number
  slot_id: number
  date: string
  customer_name: string
  customer_email: string
  customer_phone: string
  notes?: string
}

export interface BookingResponse {
  booking_id: number
  order_id: string
  expires_at: string
  payment_token: string
}

export interface Booking {
  id: number
  order_id: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'expired'
  customer_name: string
  customer_email: string
  customer_phone: string
  notes?: string
  expires_at: string
  confirmed_at?: string
  studio: Studio
  slot: { date: string; start_time: string; end_time: string }
  payment?: { amount: number; status: string; method?: string }
}

export interface DashboardStats {
  total_revenue: number
  total_bookings: number
  confirmed_bookings: number
  upcoming_today: number
}
