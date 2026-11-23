import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Bot, ExternalLink, Plus, Send, User } from 'lucide-react'
import api, { errMsg } from '../api.js'
import { Markdown, PageHeader, Spinner } from '../components/ui.jsx'

const SUGGESTIONS = ['How do I start learning Python?', 'What is the difference between a data analyst and a data scientist?', 'How should I prepare for a technical interview?', 'Which certifications are good for beginners?', 'What should I study after a B.Sc in Computer Science?']

export default function Chatbot() {
  const [params, setParams] = useSearchParams()
  const [sid, setSid] = useState(params.get('session')); const [msgs, setMsgs] = useState([]); const [text, setText] = useState('')
  const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(!!params.get('session')); const [error, setError] = useState('')
  const end = useRef(null); const started = useRef(false)

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, busy])
  useEffect(() => {
    const s = params.get('session')
    if (s) api.get(`/chat/sessions/${s}`).then((r) => setMsgs(r.data.messages)).catch((e) => setError(errMsg(e))).finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const send = async (message, sessionId = sid) => {
    if (!message.trim() || busy) return
    setError(''); setText(''); setMsgs((m) => [...m, { role: 'user', content: message }]); setBusy(true)
    try {
      const { data } = await api.post('/chat', { message, session_id: sessionId || undefined })
      setSid(data.session_id); setMsgs((m) => [...m, { role: 'assistant', content: data.reply, sources: data.sources, mode: data.mode }])
    } catch (e) { setError(errMsg(e)) } finally { setBusy(false) }
  }
  useEffect(() => { const q = params.get('q'); if (q && !started.current) { started.current = true; setParams({}, { replace: true }); send(q, null) } }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const reset = () => { setSid(null); setMsgs([]); setError(''); setParams({}) }

  return (
    <div className="flex h-[calc(100vh-7.5rem)] flex-col">
      <PageHeader title="AI career chatbot" subtitle="Personalised to your profile. Links come only from the verified knowledge base." actions={<button className="btn-ghost" onClick={reset}><Plus className="h-4 w-4" />New chat</button>} />
      <div className="glass flex min-h-0 flex-1 flex-col">
        <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6" aria-live="polite">
          {loading ? <div className="grid h-full place-items-center"><Spinner /></div> : msgs.length === 0 ? (
            <div className="grid h-full place-items-center text-center"><div>
              <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 shadow-glow"><Bot className="h-8 w-8 text-white" /></div>
              <h2 className="text-xl font-bold">How can I help with your career?</h2><p className="mb-5 mt-1 text-sm text-muted">Try one of these:</p>
              <div className="flex max-w-2xl flex-wrap justify-center gap-2">{SUGGESTIONS.map((s) => <button key={s} onClick={() => send(s)} className="chip !px-3 !py-2 text-sm transition hover:border-violet-400/50 hover:bg-violet-500/10">{s}</button>)}</div></div></div>
          ) : msgs.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${m.role === 'user' ? 'bg-blue-500' : 'bg-gradient-to-br from-violet-500 to-cyan-400'}`}>{m.role === 'user' ? <User className="h-4 w-4 text-white" /> : <Bot className="h-4 w-4 text-white" />}</div>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${m.role === 'user' ? 'bg-blue-500/20' : 'border border-line/10 bg-line/5'}`}>
                {m.role === 'user' ? m.content : <Markdown text={m.content} />}
                {m.sources?.length > 0 && <div className="mt-3 border-t border-line/10 pt-2"><div className="mb-1 text-xs font-semibold text-muted">Verified resources</div>
                  <ul className="space-y-1">{m.sources.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-cyan-300 hover:underline">{s.title}<ExternalLink className="h-3 w-3" /></a></li>)}</ul></div>}
              </div>
            </motion.div>
          ))}
          {busy && <div className="flex gap-3"><div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-400"><Bot className="h-4 w-4 text-white" /></div>
            <div className="flex items-center gap-1 rounded-2xl border border-line/10 bg-line/5 px-4 py-4">{[0, 1, 2].map((d) => <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-violet-400" style={{ animationDelay: `${d * 0.15}s` }} />)}</div></div>}
          {error && <p className="text-center text-sm text-red-400" role="alert">{error}</p>}
          <div ref={end} />
        </div>
        <form onSubmit={(e) => { e.preventDefault(); send(text) }} className="flex gap-2 border-t border-line/10 p-3">
          <input className="input" placeholder="Ask about careers, skills, certifications, interviews…" value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} aria-label="Message" />
          <button className="btn-primary" disabled={busy || !text.trim()} aria-label="Send"><Send className="h-4 w-4" /></button>
        </form>
      </div>
    </div>
  )
}
