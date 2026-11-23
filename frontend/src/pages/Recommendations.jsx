import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { motion } from 'framer-motion'
import { Bookmark, BookmarkCheck, Bot, ChevronDown, GraduationCap, Info, Map, Target, TrendingUp } from 'lucide-react'
import api, { errMsg, useFetch } from '../api.js'
import { useToast } from '../context.jsx'
import { Card, CHART, Empty, ErrorBox, LevelBadge, PageHeader, PageLoader, Progress, ScoreRing } from '../components/ui.jsx'

const COMPONENTS = [['skills', 'Skills', '55%'], ['interests', 'Interests', '20%'], ['education', 'Education', '15%'], ['preferences', 'Preferences', '10%']]

function RecCard({ rec, saved, toggleSave, i }) {
  const [open, setOpen] = useState(i === 0); const nav = useNavigate(); const c = rec.career
  const missing = new Set(rec.missing_skills.map((m) => m.skill))
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center gap-5">
          <ScoreRing value={rec.match_percent} />
          <div className="min-w-0 flex-1">
            <span className="chip border-violet-400/30 bg-violet-500/10 text-violet-300">Rank #{rec.rank}</span>
            <h2 className="mt-1 text-xl font-extrabold">{c.title}</h2>
            <p className="mt-1 text-sm text-muted">{c.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost" onClick={() => toggleSave(c.id)} aria-pressed={saved}>{saved ? <BookmarkCheck className="h-4 w-4 text-cyan-300" /> : <Bookmark className="h-4 w-4" />}{saved ? 'Saved' : 'Save'}</button>
            <button className="btn-ghost" onClick={() => setOpen(!open)} aria-expanded={open}>Details<ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} /></button>
          </div>
        </div>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 border-t border-line/10 pt-4">
            <div className="grid gap-5 lg:grid-cols-2">
              <div>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-bold"><Info className="h-4 w-4 text-cyan-300" />Why this career?</h3>
                <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted">{rec.explanation.map((e) => <li key={e}>{e}</li>)}</ul>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-bold">How the {rec.match_percent}% is calculated</h3>
                <div className="space-y-2.5">{COMPONENTS.map(([k, label, w]) => (
                  <div key={k}><div className="mb-1 flex justify-between text-xs"><span>{label} <span className="text-muted">(weight {w})</span></span><span className="text-muted">{rec.breakdown[k]}%</span></div><Progress value={rec.breakdown[k]} /></div>
                ))}</div>
              </div>
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              <div><h3 className="mb-2 text-sm font-bold">Required technical skills</h3>
                <div className="flex flex-wrap gap-1.5">{c.skills.map((s) => <span key={s.name} className={`chip ${missing.has(s.name) ? 'border-amber-400/40 bg-amber-400/10 text-amber-300' : 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'}`} title={missing.has(s.name) ? 'Missing or below required level' : 'You meet this requirement'}>{s.name} · <LevelBadge level={s.required_level} /></span>)}</div>
                <p className="mt-2 text-xs text-muted">Green = you meet the level. Amber = to improve.</p></div>
              <div><h3 className="mb-2 text-sm font-bold">Required educational background</h3>
                <p className="text-sm capitalize text-muted">{c.education_required.join(', ')}</p>
                <h3 className="mb-2 mt-4 text-sm font-bold">Career opportunities</h3><p className="text-sm text-muted">{c.opportunities}</p></div>
            </div>
            <div><h3 className="mb-2 text-sm font-bold">Suggested learning path</h3>
              <ol className="grid gap-2 sm:grid-cols-3">{c.learning_path.map((s, k) => <li key={s.title} className="rounded-xl border border-line/10 bg-line/5 p-3 text-sm"><div className="text-xs text-violet-300">Stage {k + 1} · {s.duration}</div><div className="font-semibold">{s.title}</div></li>)}</ol></div>
            {rec.missing_skills.length > 0 && <div><h3 className="mb-2 text-sm font-bold">Missing skills to build first</h3>
              <div className="flex flex-wrap gap-1.5">{rec.missing_skills.slice(0, 6).map((m) => <span key={m.skill} className="chip border-amber-400/40 bg-amber-400/10 text-amber-300">{m.skill}: {m.current_level ? 'level up' : 'new'}</span>)}</div></div>}
            <div className="flex flex-wrap gap-2">
              <Link to={`/skill-gap?career=${c.id}`} className="btn-primary"><TrendingUp className="h-4 w-4" />Skill gap</Link>
              <Link to={`/roadmap/${c.id}`} className="btn-ghost"><Map className="h-4 w-4" />Roadmap</Link>
              <Link to={`/courses?career=${c.id}`} className="btn-ghost"><GraduationCap className="h-4 w-4" />Courses</Link>
              <button className="btn-ghost" onClick={() => nav(`/chatbot?q=${encodeURIComponent(`How do I become a ${c.title}?`)}`)}><Bot className="h-4 w-4" />Ask AI</button>
            </div>
          </motion.div>
        )}
      </Card>
    </motion.div>
  )
}

export default function Recommendations() {
  const toast = useToast()
  const recs = useFetch('/recommendations'); const saved = useFetch('/saved-careers')
  if (recs.loading || saved.loading) return <PageLoader label="Loading your matches…" />
  if (recs.error) return <ErrorBox>{recs.error}</ErrorBox>
  const list = recs.data.recommendations
  if (!list.length) return <Empty icon={Target} title="No recommendations yet" text="Complete the career assessment to see your top 5 matches." action={<Link to="/assessment" className="btn-primary">Take the assessment</Link>} />
  const savedIds = new Set(saved.data.saved.map((s) => s.career.id))
  const toggleSave = async (id) => {
    try {
      if (savedIds.has(id)) await api.delete(`/saved-careers/${id}`); else await api.post('/saved-careers', { career_id: id })
      saved.reload(); toast(savedIds.has(id) ? 'Removed from saved careers' : 'Career saved')
    } catch (e) { toast(errMsg(e), 'error') }
  }
  const chart = list.map((r) => ({ name: r.career.title, score: r.match_percent }))
  return (
    <>
      <PageHeader title="AI career recommendations" subtitle="Your top five matches, scored by a transparent formula you can inspect on each card." actions={<Link to="/assessment" className="btn-ghost">Retake assessment</Link>} />
      <Card className="mb-6"><div className="h-56"><ResponsiveContainer><BarChart data={chart} layout="vertical" margin={{ left: 30 }}>
        <CartesianGrid stroke={CHART.grid} horizontal={false} /><XAxis type="number" domain={[0, 100]} tick={{ fill: CHART.axis, fontSize: 11 }} unit="%" /><YAxis type="category" dataKey="name" width={150} tick={{ fill: CHART.axis, fontSize: 12 }} />
        <Tooltip formatter={(v) => [`${v}%`, 'Match']} /><Bar dataKey="score" radius={[0, 8, 8, 0]}>{chart.map((_, i) => <Cell key={i} fill={[CHART.violet, CHART.blue, CHART.cyan, CHART.green, CHART.amber][i]} />)}</Bar></BarChart></ResponsiveContainer></div></Card>
      <div className="space-y-5">{list.map((r, i) => <RecCard key={r.id} rec={r} i={i} saved={savedIds.has(r.career.id)} toggleSave={toggleSave} />)}</div>
      <p className="mt-6 flex gap-2 text-xs text-muted"><Info className="h-4 w-4 shrink-0" />{recs.data.disclaimer}</p>
    </>
  )
}
