import axios from 'axios'

// Production: the API lives on its own domain (VITE_API_URL, set at build time).
// Dev: empty, so requests go to /api and Vite proxies them to Laravel.
const API_ORIGIN = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')

const api = axios.create({
  baseURL: `${API_ORIGIN}/api`,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  withCredentials: true,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/admin/login'
    }
    return Promise.reject(err)
  }
)

export default api
