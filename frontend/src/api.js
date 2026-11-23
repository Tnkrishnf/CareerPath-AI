import axios from 'axios'
import { useCallback, useEffect, useState } from 'react'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cp_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
api.interceptors.response.use(
  (r) => r,
  (e) => {
    const url = e.config?.url || ''
    if (e.response?.status === 401 && !url.includes('/auth/login') && !url.includes('/auth/register')) {
      localStorage.removeItem('cp_token')
      if (!window.location.pathname.startsWith('/login')) window.location.href = '/login'
    }
    return Promise.reject(e)
  },
)

export const errMsg = (e) => e?.response?.data?.error || (e?.code === 'ERR_NETWORK' ? 'Cannot reach the server. Is the backend running?' : e?.message) || 'Something went wrong'

/** GET helper: const { data, loading, error, reload, setData } = useFetch('/dashboard') — pass null to skip. */
export function useFetch(url) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(!!url)
  const [error, setError] = useState(null)
  const load = useCallback(() => {
    if (!url) { setLoading(false); return }
    setLoading(true); setError(null)
    api.get(url).then((r) => setData(r.data)).catch((e) => setError(errMsg(e))).finally(() => setLoading(false))
  }, [url])
  useEffect(() => { load() }, [load])
  return { data, loading, error, reload: load, setData }
}

export const LEVELS = { 0: 'Not started', 1: 'Beginner', 2: 'Intermediate', 3: 'Advanced' }
export default api
