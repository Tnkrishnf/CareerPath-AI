import { useEffect, useState } from 'react'
import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { BarChart3, BookOpen, Bookmark, Bot, Briefcase, ChevronLeft, ClipboardList, FileText, GraduationCap, History, LayoutDashboard, LogOut, Map, Menu, Moon, Sparkles, Sun, Target, User, Users } from 'lucide-react'
import { useAuth, useTheme } from '../context.jsx'
import { PageLoader } from './ui.jsx'

export const Logo = ({ small }) => (
  <span className="flex items-center gap-2.5 font-extrabold tracking-tight">
    <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-500 via-blue-500 to-cyan-400 shadow-lg shadow-violet-500/30"><Sparkles className="h-5 w-5 text-white" /></span>
    {!small && <span className="text-lg">CareerPath <span className="grad-text">AI</span></span>}
  </span>
)

export const ThemeToggle = () => {
  const { theme, toggle } = useTheme()
  return <button onClick={toggle} className="btn-ghost !p-2.5" aria-label="Toggle light/dark mode">{theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>
}

const STUDENT_NAV = [
  ['/dashboard', 'Dashboard', LayoutDashboard], ['/assessment', 'Career Assessment', ClipboardList], ['/recommendations', 'Recommendations', Target],
  ['/chatbot', 'AI Chatbot', Bot], ['/skill-gap', 'Skill Gap Analyzer', BarChart3], ['/roadmap', 'Learning Roadmap', Map],
  ['/courses', 'Courses', GraduationCap], ['/resume', 'Resume Analyzer', FileText], ['/saved', 'Saved Careers', Bookmark],
  ['/history', 'Chat History', History], ['/profile', 'Profile', User],
]
const ADMIN_NAV = [['/admin', 'Admin Dashboard', LayoutDashboard], ['/admin/careers', 'Careers & Skills', Briefcase], ['/admin/courses', 'Courses & Resources', BookOpen]]

export function ProtectedRoute({ role }) {
  const { user, loading } = useAuth()
  const loc = useLocation()
  if (loading) return <PageLoader />
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />
  if (role && user.role !== role) return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />
  return <Layout />
}

function Layout() {
  const { user, logout } = useAuth()
  const loc = useLocation()
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem('cp_sidebar') === '1' } catch { return false } })
  const [open, setOpen] = useState(false)
  useEffect(() => { setOpen(false) }, [loc.pathname])
  useEffect(() => { try { localStorage.setItem('cp_sidebar', collapsed ? '1' : '0') } catch { /* ignore */ } }, [collapsed])
  const nav = user.role === 'admin' ? ADMIN_NAV : STUDENT_NAV

  const sidebar = (
    <aside className={`glass flex h-full flex-col rounded-none border-y-0 border-l-0 p-3 transition-all duration-300 ${collapsed ? 'md:w-[76px]' : 'md:w-64'} w-64`}>
      <div className={`flex items-center justify-between px-2 py-3 ${collapsed ? 'md:justify-center' : ''}`}><Logo small={collapsed} />
        <button className="hidden rounded-lg p-1.5 text-muted hover:bg-line/10 md:block" onClick={() => setCollapsed(!collapsed)} aria-label="Collapse sidebar" hidden={collapsed}><ChevronLeft className="h-4 w-4" /></button></div>
      {collapsed && <button className="mx-auto mb-2 hidden rounded-lg p-1.5 text-muted hover:bg-line/10 md:block" onClick={() => setCollapsed(false)} aria-label="Expand sidebar"><Menu className="h-4 w-4" /></button>}
      <nav className="mt-2 flex-1 space-y-1 overflow-y-auto">
        {nav.map(([to, label, Icon]) => (
          <NavLink key={to} to={to} end={to === '/admin'} title={label} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''} ${collapsed ? 'md:justify-center' : ''}`}>
            <Icon className="h-[18px] w-[18px] shrink-0" /><span className={collapsed ? 'md:hidden' : ''}>{label}</span>
          </NavLink>
        ))}
      </nav>
      <button onClick={logout} className={`nav-link mt-2 hover:!text-red-400 ${collapsed ? 'md:justify-center' : ''}`}><LogOut className="h-[18px] w-[18px]" /><span className={collapsed ? 'md:hidden' : ''}>Log out</span></button>
    </aside>
  )

  return (
    <div className="flex min-h-screen">
      <div className="sticky top-0 hidden h-screen md:block">{sidebar}</div>
      <AnimatePresence>
        {open && (<>
          <motion.div className="fixed inset-0 z-40 bg-black/60 md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
          <motion.div className="fixed inset-y-0 left-0 z-50 md:hidden" initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}>{sidebar}</motion.div>
        </>)}
      </AnimatePresence>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line/10 bg-bg/70 px-4 py-3 backdrop-blur-xl sm:px-6">
          <button className="btn-ghost !p-2.5 md:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-4 w-4" /></button>
          <div className="hidden text-sm text-muted md:block">{user.role === 'admin' ? 'Administrator console' : 'Student workspace'}</div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="flex items-center gap-2.5"><div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 text-sm font-bold text-white">{user.full_name[0]}</div>
              <div className="hidden text-sm leading-tight sm:block"><div className="font-semibold">{user.full_name}</div><div className="text-xs capitalize text-muted">{user.role}</div></div></div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl p-4 sm:p-6"><AnimatePresence mode="wait"><motion.div key={loc.pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}><Outlet /></motion.div></AnimatePresence></main>
      </div>
    </div>
  )
}
