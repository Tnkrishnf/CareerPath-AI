import { Link } from 'react-router-dom'
import { Bookmark, Bot, MessageSquare, Trash2 } from 'lucide-react'
import api, { errMsg, useFetch } from '../api.js'
import { useToast } from '../context.jsx'
import { Card, Empty, ErrorBox, fmtDate, PageHeader, PageLoader } from '../components/ui.jsx'

export function SavedCareers() {
  const toast = useToast(); const { data, loading, error, reload } = useFetch('/saved-careers')
  const remove = async (id) => { try { await api.delete(`/saved-careers/${id}`); toast('Removed'); reload() } catch (e) { toast(errMsg(e), 'error') } }
  if (loading) return <PageLoader />
  if (error) return <ErrorBox>{error}</ErrorBox>
  return (
    <>
      <PageHeader title="Saved careers" subtitle="Careers you bookmarked from your recommendations." />
      {data.saved.length === 0 ? <Empty icon={Bookmark} title="Nothing saved yet" text="Save careers from the recommendations page to compare them later." action={<Link to="/recommendations" className="btn-primary">See recommendations</Link>} /> : (
        <div className="grid gap-4 md:grid-cols-2">{data.saved.map(({ id, career: c, saved_at }) => (
          <Card key={id} hover className="flex flex-col"><div className="flex items-start justify-between gap-2"><h2 className="text-lg font-bold">{c.title}</h2>
            <button onClick={() => remove(c.id)} className="rounded-lg p-1.5 text-muted hover:bg-red-500/10 hover:text-red-400" aria-label={`Remove ${c.title}`}><Trash2 className="h-4 w-4" /></button></div>
            <p className="mt-1 flex-1 text-sm text-muted">{c.description}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">{c.skills.slice(0, 6).map((s) => <span key={s.name} className="chip">{s.name}</span>)}</div>
            <p className="mt-2 text-xs text-muted">Saved {fmtDate(saved_at)}</p>
            <div className="mt-4 flex flex-wrap gap-2"><Link to={`/skill-gap?career=${c.id}`} className="btn-primary text-xs">Skill gap</Link><Link to={`/roadmap/${c.id}`} className="btn-ghost text-xs">Roadmap</Link><Link to={`/courses?career=${c.id}`} className="btn-ghost text-xs">Courses</Link></div></Card>))}</div>)}
    </>
  )
}

export function ChatHistory() {
  const toast = useToast(); const { data, loading, error, reload } = useFetch('/chat/sessions')
  const remove = async (sid) => { if (!window.confirm('Delete this conversation?')) return; try { await api.delete(`/chat/sessions/${sid}`); toast('Conversation deleted'); reload() } catch (e) { toast(errMsg(e), 'error') } }
  if (loading) return <PageLoader />
  if (error) return <ErrorBox>{error}</ErrorBox>
  return (
    <>
      <PageHeader title="Chat history" subtitle="Continue or delete earlier conversations with the AI guide." actions={<Link to="/chatbot" className="btn-primary"><Bot className="h-4 w-4" />New chat</Link>} />
      {data.sessions.length === 0 ? <Empty icon={MessageSquare} title="No conversations yet" text="Ask the AI guide a question to start." action={<Link to="/chatbot" className="btn-primary">Open chatbot</Link>} /> : (
        <ul className="space-y-3">{data.sessions.map((s) => (
          <li key={s.session_id}><Card hover className="flex items-center gap-4"><div className="rounded-xl bg-violet-500/15 p-3"><MessageSquare className="h-5 w-5 text-violet-300" /></div>
            <Link to={`/chatbot?session=${s.session_id}`} className="min-w-0 flex-1"><div className="truncate font-semibold">{s.title || 'Conversation'}</div><div className="text-xs text-muted">{s.messages} messages · last activity {fmtDate(s.updated)}</div></Link>
            <button onClick={() => remove(s.session_id)} className="rounded-lg p-2 text-muted hover:bg-red-500/10 hover:text-red-400" aria-label="Delete conversation"><Trash2 className="h-4 w-4" /></button></Card></li>))}</ul>)}
    </>
  )
}
