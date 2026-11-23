import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, XCircle } from 'lucide-react'
import api from './api.js'

/* ---------- theme ---------- */
const ThemeCtx = createContext(null)
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => (document.documentElement.classList.contains('light') ? 'light' : 'dark'))
  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light')
    try { localStorage.setItem('cp_theme', theme) } catch { /* private mode */ }
  }, [theme])
  return <ThemeCtx.Provider value={{ theme, toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) }}>{children}</ThemeCtx.Provider>
}
export const useTheme = () => useContext(ThemeCtx)

/* ---------- toasts ---------- */
const ToastCtx = createContext(null)
export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const toast = useCallback((message, type = 'success') => {
    const id = Math.random().toString(36).slice(2)
    setItems((i) => [...i, { id, message, type }])
    setTimeout(() => setItems((i) => i.filter((x) => x.id !== id)), 4000)
  }, [])
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2" aria-live="polite">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div key={t.id} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }}
              className="glass flex max-w-sm items-center gap-2 px-4 py-3 text-sm">
              {t.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" /> : <XCircle className="h-4 w-4 shrink-0 text-red-400" />}
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  )
}
export const useToast = () => useContext(ToastCtx)

/* ---------- auth ---------- */
const AuthCtx = createContext(null)
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(!!localStorage.getItem('cp_token'))

  useEffect(() => {
    if (!localStorage.getItem('cp_token')) return
    api.get('/auth/me').then((r) => setUser(r.data.user)).catch(() => localStorage.removeItem('cp_token')).finally(() => setLoading(false))
  }, [])

  const finish = (data) => { localStorage.setItem('cp_token', data.token); setUser(data.user); return data.user }
  const login = async (email, password) => finish((await api.post('/auth/login', { email, password })).data)
  const register = async (payload) => finish((await api.post('/auth/register', payload)).data)
  const logout = async () => {
    try { await api.post('/auth/logout') } catch { /* token may already be invalid */ }
    localStorage.removeItem('cp_token'); setUser(null)
  }
  return <AuthCtx.Provider value={{ user, setUser, loading, login, register, logout }}>{children}</AuthCtx.Provider>
}
export const useAuth = () => useContext(AuthCtx)
