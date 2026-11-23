import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, Loader2, X } from 'lucide-react'
import { LEVELS } from '../api.js'

export const Card = ({ className = '', hover, children, ...p }) => (
  <div className={`glass p-5 ${hover ? 'glass-hover' : ''} ${className}`} {...p}>{children}</div>
)

export const Button = ({ variant = 'primary', loading, children, className = '', ...p }) => (
  <button className={`btn-${variant} ${className}`} disabled={loading || p.disabled} {...p}>
    {loading && <Loader2 className="h-4 w-4 animate-spin" />}{children}
  </button>
)

export const Field = ({ label, error, hint, children }) => (
  <label className="block">
    {label && <span className="label">{label}</span>}
    {children}
    {hint && !error && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    {error && <span className="mt-1 block text-xs text-red-400">{error}</span>}
  </label>
)
export const Input = ({ label, error, hint, ...p }) => <Field label={label} error={error} hint={hint}><input className="input" {...p} /></Field>
export const Textarea = ({ label, error, hint, ...p }) => <Field label={label} error={error} hint={hint}><textarea rows={3} className="input" {...p} /></Field>
export const Select = ({ label, error, options, placeholder, ...p }) => (
  <Field label={label} error={error}>
    <select className="input" {...p}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}
    </select>
  </Field>
)

export const Spinner = ({ className = 'h-6 w-6' }) => <Loader2 className={`animate-spin text-violet-400 ${className}`} />
export const PageLoader = ({ label = 'Loading…' }) => (
  <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted" role="status">
    <div className="relative h-14 w-14">
      <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-violet-400 border-r-cyan-300" />
      <div className="absolute inset-2 animate-spin rounded-full border-2 border-transparent border-b-blue-400" style={{ animationDirection: 'reverse', animationDuration: '1.4s' }} />
    </div>
    <span className="text-sm">{label}</span>
  </div>
)
export const ErrorBox = ({ children }) => (
  <div className="flex items-start gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-400" role="alert">
    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{children}</span>
  </div>
)
export const Empty = ({ icon: Icon, title, text, action }) => (
  <Card className="flex flex-col items-center gap-3 py-12 text-center">
    {Icon && <div className="rounded-2xl bg-violet-500/15 p-4"><Icon className="h-8 w-8 text-violet-300" /></div>}
    <h3 className="text-lg font-bold">{title}</h3>
    {text && <p className="max-w-md text-sm text-muted">{text}</p>}
    {action}
  </Card>
)

export const PageHeader = ({ title, subtitle, actions }) => (
  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex flex-wrap items-end justify-between gap-3">
    <div><h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>{subtitle && <p className="mt-1 max-w-2xl text-sm text-muted">{subtitle}</p>}</div>
    {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
  </motion.div>
)

export const Stat = ({ icon: Icon, label, value, hint }) => (
  <Card hover className="flex items-center gap-4">
    <div className="rounded-xl bg-gradient-to-br from-violet-500/30 to-cyan-400/20 p-3"><Icon className="h-5 w-5 text-cyan-300" /></div>
    <div><div className="text-2xl font-extrabold leading-none">{value}</div><div className="mt-1 text-xs text-muted">{label}</div>{hint && <div className="text-[11px] text-muted/80">{hint}</div>}</div>
  </Card>
)

export const Progress = ({ value, className = '' }) => (
  <div className={`h-2 w-full overflow-hidden rounded-full bg-line/10 ${className}`} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
    <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, Math.max(0, value))}%` }} transition={{ duration: 0.7 }} className="h-full rounded-full bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-400" />
  </div>
)

export const ScoreRing = ({ value, size = 96 }) => {
  const r = size / 2 - 8, c = 2 * Math.PI * r
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs><linearGradient id="ring" x1="0" x2="1"><stop offset="0" stopColor="#8b5cf6" /><stop offset="1" stopColor="#22d3ee" /></linearGradient></defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="currentColor" strokeOpacity=".12" strokeWidth="8" fill="none" />
        <motion.circle cx={size / 2} cy={size / 2} r={r} stroke="url(#ring)" strokeWidth="8" strokeLinecap="round" fill="none" strokeDasharray={c}
          initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - value / 100) }} transition={{ duration: 1 }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-lg font-extrabold">{Math.round(value)}%</div>
    </div>
  )
}

const LEVEL_STYLE = { 0: 'text-muted', 1: 'text-sky-300 border-sky-400/30 bg-sky-400/10', 2: 'text-violet-300 border-violet-400/30 bg-violet-400/10', 3: 'text-emerald-300 border-emerald-400/30 bg-emerald-400/10' }
export const LevelBadge = ({ level }) => <span className={`chip ${LEVEL_STYLE[level]}`}>{LEVELS[level]}</span>

export function Modal({ open, onClose, title, children, wide }) {
  useEffect(() => {
    if (!open) return
    const h = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}>
          <motion.div role="dialog" aria-modal="true" aria-label={title} initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }}
            className={`glass my-8 w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} bg-surface p-6`} onMouseDown={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">{title}</h2>
              <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-line/10" aria-label="Close"><X className="h-5 w-5" /></button></div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Tiny safe renderer for **bold**, _italic_ and line breaks (no HTML injection). */
export function Markdown({ text }) {
  const inline = (line, k) => line.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).map((part, i) =>
    part.startsWith('**') ? <strong key={`${k}${i}`}>{part.slice(2, -2)}</strong>
      : part.startsWith('_') && part.endsWith('_') && part.length > 2 ? <em key={`${k}${i}`} className="text-muted">{part.slice(1, -1)}</em> : part)
  return <div className="space-y-2 leading-relaxed">{text.split('\n').map((l, i) => (l.trim() ? <p key={i}>{inline(l, i)}</p> : null))}</div>
}

export const CHART = { violet: '#8b5cf6', blue: '#3b82f6', cyan: '#22d3ee', green: '#34d399', amber: '#fbbf24', grid: 'rgba(148,163,184,.18)', axis: '#94a3b8' }
export const fmtDate = (s) => new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
