import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ExternalLink, GraduationCap, Search } from 'lucide-react'
import { useFetch } from '../api.js'
import CareerSelect from '../components/CareerSelect.jsx'
import { Card, Empty, ErrorBox, PageHeader, PageLoader, Select } from '../components/ui.jsx'

const LEVELS = ['all', 'beginner', 'intermediate', 'advanced']
const LVL_STYLE = { beginner: 'border-sky-400/40 bg-sky-400/10 text-sky-300', intermediate: 'border-violet-400/40 bg-violet-400/10 text-violet-300', advanced: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300' }

export default function Courses() {
  const [params, setParams] = useSearchParams()
  const [level, setLevel] = useState('all'); const [category, setCategory] = useState(''); const [type, setType] = useState(''); const [q, setQ] = useState('')
  const career = params.get('career')
  const url = useMemo(() => { const p = new URLSearchParams(); if (level !== 'all') p.set('level', level); if (category) p.set('category', category); if (type) p.set('type', type); if (q.trim()) p.set('q', q.trim()); if (career) p.set('career_id', career); return `/courses?${p}` }, [level, category, type, q, career])
  const { data, loading, error } = useFetch(url)
  return (
    <>
      <PageHeader title="Course recommendations" subtitle="Curated courses, certifications and resources. Pick a career to rank them by your missing skills." />
      <Card className="mb-6 grid gap-4 md:grid-cols-4">
        <CareerSelect value={career} onChange={(id) => setParams(id ? { career: id } : {})} label="Recommended for career" placeholder="All courses" />
        <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)} options={data?.categories || []} placeholder="All categories" />
        <Select label="Type" value={type} onChange={(e) => setType(e.target.value)} options={[{ value: 'course', label: 'Courses' }, { value: 'certification', label: 'Certifications' }, { value: 'resource', label: 'Docs & resources' }]} placeholder="All types" />
        <label><span className="label">Search</span><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted" /><input className="input !pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Python, SQL…" /></div></label>
        <div className="flex flex-wrap gap-2 md:col-span-4" role="tablist" aria-label="Difficulty">{LEVELS.map((l) => (
          <button key={l} role="tab" aria-selected={level === l} onClick={() => setLevel(l)} className={`rounded-full border px-4 py-1.5 text-sm font-medium capitalize transition ${level === l ? 'border-transparent bg-gradient-to-r from-violet-500 to-cyan-400 text-white' : 'border-line/15 bg-line/5 text-muted hover:text-fg'}`}>{l}</button>))}</div>
      </Card>
      {data?.career && <p className="mb-4 text-sm text-muted">Showing the best matches for <strong className="text-fg">{data.career}</strong>{data.gap_skills.length > 0 && <> · your missing skills: {data.gap_skills.join(', ')}</>}</p>}
      {loading && <PageLoader />}
      {error && <ErrorBox>{error}</ErrorBox>}
      {data && !loading && (data.courses.length === 0 ? <Empty icon={GraduationCap} title="No courses match" text="Try clearing a filter." /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.courses.map((c) => (
          <Card key={c.id} hover className="flex flex-col">
            <div className="mb-2 flex flex-wrap items-center gap-2"><span className={`chip capitalize ${LVL_STYLE[c.level]}`}>{c.level}</span><span className="chip capitalize">{c.resource_type}</span><span className="chip">{c.skill_category}</span></div>
            <h3 className="font-bold leading-snug">{c.title}</h3><p className="text-xs text-violet-300">{c.platform}</p>
            <p className="mt-2 flex-1 text-sm text-muted">{c.description}</p>
            {c.matches_gap?.length > 0 && <p className="mt-2 text-xs text-amber-300">Fills gap: {c.matches_gap.join(', ')}</p>}
            <a href={c.url} target="_blank" rel="noopener noreferrer" className="btn-ghost mt-4">Open course <ExternalLink className="h-4 w-4" /></a>
          </Card>))}</div>))}
    </>
  )
}
