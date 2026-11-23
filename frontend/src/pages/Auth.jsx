import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'
import api, { errMsg } from '../api.js'
import { useAuth, useToast } from '../context.jsx'
import { Button, ErrorBox, Input } from '../components/ui.jsx'
import { Logo, ThemeToggle } from '../components/Layout.jsx'

function Shell({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="absolute right-4 top-4"><ThemeToggle /></div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <Link to="/" className="mb-8 flex justify-center"><Logo /></Link>
        <div className="glass p-7 shadow-glow"><h1 className="text-2xl font-extrabold">{title}</h1><p className="mb-6 mt-1 text-sm text-muted">{subtitle}</p>{children}</div>
        <p className="mt-5 text-center text-sm text-muted">{footer}</p>
      </motion.div>
    </div>
  )
}

export function Login() {
  const { login } = useAuth(); const nav = useNavigate(); const loc = useLocation()
  const [f, setF] = useState({ email: '', password: '' }); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true)
    try { const u = await login(f.email, f.password); nav(loc.state?.from || (u.role === 'admin' ? '/admin' : '/dashboard'), { replace: true }) }
    catch (x) { setErr(errMsg(x)) } finally { setBusy(false) }
  }
  return (
    <Shell title="Welcome back" subtitle="Log in to continue your career journey." footer={<>New here? <Link className="font-semibold text-violet-400" to="/register">Create an account</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        {err && <ErrorBox>{err}</ErrorBox>}
        <Input label="Email" type="email" required autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <Input label="Password" type="password" required autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        <div className="text-right text-sm"><Link className="text-cyan-300 hover:underline" to="/forgot-password">Forgot password?</Link></div>
        <Button loading={busy} className="w-full">Log in</Button>
      </form>
    </Shell>
  )
}

export function Register() {
  const { register } = useAuth(); const nav = useNavigate()
  const [f, setF] = useState({ full_name: '', email: '', password: '', confirm: '' }); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault(); setErr('')
    if (f.password !== f.confirm) return setErr('Passwords do not match.')
    setBusy(true)
    try { await register({ full_name: f.full_name, email: f.email, password: f.password }); nav('/assessment', { replace: true }) }
    catch (x) { setErr(errMsg(x)) } finally { setBusy(false) }
  }
  return (
    <Shell title="Create your account" subtitle="Free for students. Takes less than a minute." footer={<>Already registered? <Link className="font-semibold text-violet-400" to="/login">Log in</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        {err && <ErrorBox>{err}</ErrorBox>}
        <Input label="Full name" required value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
        <Input label="Email" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <Input label="Password" type="password" required minLength={8} hint="At least 8 characters with a letter and a number." value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        <Input label="Confirm password" type="password" required value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} />
        <Button loading={busy} className="w-full">Create account</Button>
      </form>
    </Shell>
  )
}

export function ForgotPassword() {
  const toast = useToast(); const nav = useNavigate()
  const [step, setStep] = useState(1); const [email, setEmail] = useState(''); const [token, setToken] = useState(''); const [pw, setPw] = useState('')
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [devToken, setDevToken] = useState(null)
  const run = async (fn) => { setErr(''); setBusy(true); try { await fn() } catch (x) { setErr(errMsg(x)) } finally { setBusy(false) } }
  const request = (e) => { e.preventDefault(); run(async () => { const { data } = await api.post('/auth/forgot-password', { email }); setDevToken(data.reset_token || null); if (data.reset_token) setToken(data.reset_token); setStep(2) }) }
  const reset = (e) => { e.preventDefault(); run(async () => { await api.post('/auth/reset-password', { token, password: pw }); toast('Password updated. Please log in.'); nav('/login') }) }
  return (
    <Shell title="Reset your password" subtitle={step === 1 ? 'Enter your email to receive a reset token.' : 'Enter the token and choose a new password.'} footer={<Link className="font-semibold text-violet-400" to="/login">Back to login</Link>}>
      {err && <div className="mb-4"><ErrorBox>{err}</ErrorBox></div>}
      {step === 1 ? (
        <form onSubmit={request} className="space-y-4"><Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /><Button loading={busy} className="w-full">Send reset token</Button></form>
      ) : (
        <form onSubmit={reset} className="space-y-4">
          <div className="flex gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-xs text-emerald-300"><CheckCircle2 className="h-4 w-4 shrink-0" />
            {devToken ? 'Development mode: no email server is configured, so the token was filled in for you.' : 'If that email is registered, a token has been generated. Paste it below.'}</div>
          <Input label="Reset token" required value={token} onChange={(e) => setToken(e.target.value)} />
          <Input label="New password" type="password" required minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} />
          <Button loading={busy} className="w-full">Update password</Button>
        </form>
      )}
    </Shell>
  )
}
