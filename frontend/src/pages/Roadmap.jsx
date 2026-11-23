import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { motion } from 'framer-motion'
import { Check, ChevronDown, ExternalLink, FolderGit2, Hammer, BookOpenCheck } from 'lucide-react'
import api, { errMsg, useFetch } from '../api.js'
import { useToast } from '../context.jsx'
import CareerSelect, { useDefaultCareer } from '../components/CareerSelect.jsx'
import { Card, CHART, ErrorBox, PageHeader, PageLoader, Progress, ScoreRing } from '../components/ui.jsx'

const SECTIONS = [['topics', 'Topics to study', BookOpenCheck], ['practice', 'Practice activities', Hammer], ['projects', 'Project suggestions', FolderGit2]]
const STATUS = { completed: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300', in_progress: 'border-violet-400/40 bg-violet-400/10 text-violet-300', not_started: '' }
const STATUS_LABEL = { completed: 'Completed', in_progress: 'In progress', not_started: 'Not started' }

export default function Roadmap() {
  const { careerId } = useParams(); const nav = useNavigate(); const toast = useToast()
  const def = useDefaultCareer(careerId); const id = careerId ? Number(careerId) : def.id
  const { data, loading, error, setData } = useFetch(id ? `/roadmaps/${id}` : null)
  const [open, setOpen] = useState(0)
  useEffect(() => { setOpen(0) }, [id])

  const toggle = async (key, completed) => {
    const prev = data
    setData({ ...data, stages: data.stages.map((s) => ({ ...s, ...Object.fromEntries(['topics', 'practice', 'projects'].map((sec) => [sec, s[sec].map((i) => (i.key === key ? { ...i, completed } : i))])) })) })
    try { const r = await api.put(`/roadmaps/${id}/progress`, { item_key: key, completed }); setData(r.data) }
    catch (e) { setData(prev); toast(errMsg(e), 'error') }
  }
  return (
    <>
      <PageHeader title="Personalised learning roadmap" subtitle="Work through each stage and tick items off. Your progress is saved." />
      <Card className="mb-6 max-w-md"><CareerSelect value={id} onChange={(c) => nav(c ? `/roadmap/${c}` : '/roadmap')} label="Career" /></Card>
      {(loading || def.loading) && <PageLoader label="Building your roadmap…" />}
      {error && <ErrorBox>{error}</ErrorBox>}
      {data && !loading && (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="flex items-center gap-5"><ScoreRing value={data.percent} /><div><h2 className="font-bold">{data.career.title}</h2><p className="text-sm text-muted">{data.completed} of {data.total} items done</p></div></Card>
            <Card className="lg:col-span-2"><h2 className="mb-2 text-sm font-bold">Progress by stage</h2><div className="h-28"><ResponsiveContainer><BarChart data={data.stages.map((s) => ({ name: `Stage ${s.index + 1}`, percent: s.percent }))} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid stroke={CHART.grid} horizontal={false} /><XAxis type="number" domain={[0, 100]} hide /><YAxis type="category" dataKey="name" width={60} tick={{ fill: CHART.axis, fontSize: 11 }} /><Tooltip formatter={(v) => [`${v}%`, 'Done']} /><Bar dataKey="percent" fill={CHART.violet} radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer></div></Card>
          </div>
          {data.stages.map((s) => (
            <Card key={s.index} className="!p-0">
              <button className="flex w-full items-center gap-4 p-5 text-left" onClick={() => setOpen(open === s.index ? -1 : s.index)} aria-expanded={open === s.index}>
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full font-bold ${s.status === 'completed' ? 'bg-emerald-500 text-white' : 'bg-gradient-to-br from-violet-500 to-cyan-400 text-white'}`}>{s.status === 'completed' ? <Check className="h-5 w-5" /> : s.index + 1}</span>
                <span className="min-w-0 flex-1"><span className="block font-bold">{s.title}</span><span className="text-xs text-muted">{s.duration} · {s.done}/{s.total} items</span><Progress value={s.percent} className="mt-2 max-w-xs" /></span>
                <span className={`chip hidden sm:inline-flex ${STATUS[s.status]}`}>{STATUS_LABEL[s.status]}</span><ChevronDown className={`h-5 w-5 transition ${open === s.index ? 'rotate-180' : ''}`} />
              </button>
              {open === s.index && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 border-t border-line/10 p-5">
                  <div><h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Recommended technologies</h3><div className="flex flex-wrap gap-1.5">{s.technologies.map((t) => <span key={t} className="chip border-cyan-400/30 bg-cyan-400/10 text-cyan-300">{t}</span>)}</div></div>
                  <div className="grid gap-6 lg:grid-cols-3">{SECTIONS.map(([k, label, Icon]) => (
                    <div key={k}><h3 className="mb-2 flex items-center gap-2 text-sm font-bold"><Icon className="h-4 w-4 text-violet-300" />{label}</h3>
                      <ul className="space-y-2">{s[k].map((i) => (
                        <li key={i.key}><label className="flex cursor-pointer items-start gap-2.5 text-sm"><input type="checkbox" className="mt-1 h-4 w-4 accent-violet-500" checked={i.completed} onChange={(e) => toggle(i.key, e.target.checked)} />
                          <span className={i.completed ? 'text-muted line-through' : ''}>{i.text}</span></label></li>))}</ul></div>))}</div>
                  {s.resources.length > 0 && <div><h3 className="mb-2 text-sm font-bold">Learning resources</h3><ul className="grid gap-2 sm:grid-cols-2">{s.resources.map((r) => (
                    <li key={r.url}><a href={r.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-2 rounded-xl border border-line/10 bg-line/5 px-3 py-2.5 text-sm transition hover:border-violet-400/40">
                      <span><span className="block font-semibold">{r.title}</span><span className="text-xs capitalize text-muted">{r.platform} · {r.level} · {r.resource_type}</span></span><ExternalLink className="h-4 w-4 shrink-0 text-cyan-300" /></a></li>))}</ul></div>}
                </motion.div>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
