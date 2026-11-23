import { useSearchParams, Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Legend, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CheckCircle2, GraduationCap, Lightbulb } from 'lucide-react'
import { LEVELS, useFetch } from '../api.js'
import CareerSelect, { useDefaultCareer } from '../components/CareerSelect.jsx'
import { Card, CHART, ErrorBox, LevelBadge, PageHeader, PageLoader, ScoreRing } from '../components/ui.jsx'

const PRIORITY = { High: 'border-red-400/40 bg-red-400/10 text-red-300', Medium: 'border-amber-400/40 bg-amber-400/10 text-amber-300', Low: 'border-sky-400/40 bg-sky-400/10 text-sky-300' }

export default function SkillGap() {
  const [params, setParams] = useSearchParams()
  const def = useDefaultCareer(params.get('career'))
  const careerId = params.get('career') ? Number(params.get('career')) : def.id
  const { data: g, loading, error } = useFetch(careerId ? `/skill-gap/${careerId}` : null)
  const tick = { fill: CHART.axis, fontSize: 11 }
  return (
    <>
      <PageHeader title="Skill gap analyzer" subtitle="Compare your skills with what a career requires, then see what to learn first." />
      <Card className="mb-6 max-w-md"><CareerSelect value={careerId} onChange={(id) => setParams(id ? { career: id } : {})} label="Target career" /></Card>
      {(loading || def.loading) && <PageLoader label="Analysing your skills…" />}
      {error && <ErrorBox>{error}</ErrorBox>}
      {g && !loading && (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="flex flex-col items-center text-center"><h2 className="mb-3 self-start font-bold">Readiness</h2><ScoreRing value={g.readiness_percent} size={130} />
              <p className="mt-3 text-sm text-muted">{g.existing.length} of {g.comparison.length} required skills at the needed level</p></Card>
            <Card className="lg:col-span-2"><h2 className="mb-2 font-bold">Current vs required level</h2>
              <div className="h-64"><ResponsiveContainer><BarChart data={g.comparison} margin={{ bottom: 40 }}><CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="skill" tick={tick} interval={0} angle={-30} textAnchor="end" height={60} /><YAxis domain={[0, 3]} ticks={[0, 1, 2, 3]} tick={tick} tickFormatter={(v) => LEVELS[v]?.slice(0, 3)} width={40} />
                <Tooltip formatter={(v, n) => [LEVELS[v], n]} /><Legend verticalAlign="top" /><Bar dataKey="current" name="You" fill={CHART.violet} radius={[6, 6, 0, 0]} /><Bar dataKey="required" name="Required" fill={CHART.cyan} radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div></Card>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card><h2 className="mb-2 font-bold">Skill radar</h2><div className="h-72"><ResponsiveContainer><RadarChart data={g.comparison}><PolarGrid stroke={CHART.grid} /><PolarAngleAxis dataKey="skill" tick={tick} /><PolarRadiusAxis domain={[0, 3]} tick={false} axisLine={false} />
              <Radar name="Required" dataKey="required" stroke={CHART.cyan} fill={CHART.cyan} fillOpacity={0.15} /><Radar name="You" dataKey="current" stroke={CHART.violet} fill={CHART.violet} fillOpacity={0.45} /><Legend /><Tooltip /></RadarChart></ResponsiveContainer></div></Card>
            <Card><h2 className="mb-3 flex items-center gap-2 font-bold"><CheckCircle2 className="h-4 w-4 text-emerald-400" />Skills you already have</h2>
              {g.existing.length === 0 ? <p className="text-sm text-muted">No required skills at the needed level yet — that's where the roadmap starts.</p> :
                <ul className="space-y-2">{g.existing.map((s) => <li key={s.skill} className="flex items-center justify-between text-sm"><span>{s.skill}</span><LevelBadge level={s.current} /></li>)}</ul>}
              {g.extra_skills.length > 0 && <><h3 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-muted">Other skills you have</h3><div className="flex flex-wrap gap-1.5">{g.extra_skills.map((s) => <span key={s.skill} className="chip">{s.skill}</span>)}</div></>}</Card>
          </div>
          <Card>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 font-bold"><Lightbulb className="h-4 w-4 text-amber-300" />Recommended learning priorities</h2>
              <div className="flex gap-2"><Link to={`/courses?career=${g.career.id}`} className="btn-ghost text-xs"><GraduationCap className="h-4 w-4" />Matching courses</Link><Link to={`/roadmap/${g.career.id}`} className="btn-primary text-xs">Open roadmap</Link></div></div>
            {g.priorities.length === 0 ? <p className="text-sm text-emerald-300">You meet every requirement for {g.career.title}. Time to build projects and apply.</p> : (
              <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs uppercase text-muted"><tr><th className="py-2 pr-3">#</th><th className="pr-3">Skill</th><th className="pr-3">Now → Needed</th><th className="pr-3">Priority</th><th>Suggestion</th></tr></thead>
                <tbody>{g.priorities.map((p, i) => <tr key={p.skill} className="border-t border-line/10 align-top"><td className="py-3 pr-3 text-muted">{i + 1}</td><td className="pr-3 font-semibold">{p.skill}</td>
                  <td className="pr-3 whitespace-nowrap"><LevelBadge level={p.current} /> → <LevelBadge level={p.required} /></td><td className="pr-3"><span className={`chip ${PRIORITY[p.priority]}`}>{p.priority}</span></td><td className="text-muted">{p.suggestion}</td></tr>)}</tbody></table></div>)}
          </Card>
        </div>
      )}
    </>
  )
}
