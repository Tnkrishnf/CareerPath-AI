import { Link } from 'react-router-dom'
import { Bookmark, Bot, ClipboardList, FileText, Sparkles, Target, Wrench } from 'lucide-react'
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { useFetch } from '../api.js'
import { useAuth } from '../context.jsx'
import { Card, CHART, Empty, ErrorBox, PageHeader, PageLoader, Progress, ScoreRing, Stat } from '../components/ui.jsx'

export default function Dashboard() {
  const { user } = useAuth()
  const { data, loading, error } = useFetch('/dashboard')
  if (loading) return <PageLoader />
  if (error) return <ErrorBox>{error}</ErrorBox>
  const d = data
  return (
    <>
      <PageHeader title={`Hi ${user.full_name.split(' ')[0]} 👋`} subtitle="Here is where your career journey stands today." actions={<Link to="/assessment" className="btn-primary"><ClipboardList className="h-4 w-4" />{d.has_assessment ? 'Retake assessment' : 'Take assessment'}</Link>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Wrench} label="Skills tracked" value={d.stats.skills} />
        <Stat icon={Bookmark} label="Saved careers" value={d.stats.saved_careers} />
        <Stat icon={Bot} label="Questions asked" value={d.stats.chat_messages} />
        <Stat icon={FileText} label="Resumes analysed" value={d.stats.resumes} />
      </div>
      {!d.has_assessment ? (
        <div className="mt-6"><Empty icon={Sparkles} title="Start with the career assessment" text="It takes about 5 minutes and unlocks recommendations, skill-gap analysis and your roadmap." action={<Link to="/assessment" className="btn-primary">Begin assessment</Link>} /></div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <div className="mb-4 flex items-center justify-between"><h2 className="font-bold">Top career matches</h2><Link to="/recommendations" className="text-sm text-cyan-300 hover:underline">View details</Link></div>
            <ul className="space-y-4">{d.top_recommendations.map((r, i) => (
              <li key={r.career_id}><div className="mb-1 flex justify-between text-sm"><Link to={`/skill-gap?career=${r.career_id}`} className="font-semibold hover:text-violet-300">{i + 1}. {r.title}</Link><span className="text-muted">{r.match_percent}% match</span></div><Progress value={r.match_percent} /></li>
            ))}</ul>
          </Card>
          <Card className="flex flex-col items-center text-center">
            <h2 className="mb-3 self-start font-bold">Readiness</h2>
            <ScoreRing value={d.readiness.percent} size={130} />
            <p className="mt-3 text-sm text-muted">Skill coverage for <strong className="text-fg">{d.readiness.career}</strong></p>
            <Link to={`/roadmap/${d.top_recommendations[0].career_id}`} className="btn-ghost mt-4 text-xs">Open roadmap</Link>
          </Card>
          <Card className="lg:col-span-2">
            <h2 className="mb-2 font-bold">Skills vs. {d.readiness.career} requirements</h2>
            <div className="h-72"><ResponsiveContainer>
              <RadarChart data={d.skill_radar}><PolarGrid stroke={CHART.grid} /><PolarAngleAxis dataKey="skill" tick={{ fill: CHART.axis, fontSize: 11 }} /><PolarRadiusAxis domain={[0, 3]} tickCount={4} tick={false} axisLine={false} />
                <Radar name="Required" dataKey="required" stroke={CHART.cyan} fill={CHART.cyan} fillOpacity={0.15} /><Radar name="You" dataKey="current" stroke={CHART.violet} fill={CHART.violet} fillOpacity={0.45} /><Legend /><Tooltip /></RadarChart>
            </ResponsiveContainer></div>
          </Card>
          <Card>
            <h2 className="mb-4 font-bold">Roadmap progress</h2>
            {d.roadmaps.length === 0 ? <p className="text-sm text-muted">Open a roadmap to start tracking.</p> : (
              <ul className="space-y-4">{d.roadmaps.map((r) => <li key={r.career.id}><div className="mb-1 flex justify-between text-sm"><Link to={`/roadmap/${r.career.id}`} className="font-semibold">{r.career.title}</Link><span className="text-muted">{r.percent}%</span></div><Progress value={r.percent} /></li>)}</ul>
            )}
            <Link to="/chatbot" className="btn-ghost mt-6 w-full"><Target className="h-4 w-4" />Ask the AI guide</Link>
          </Card>
        </div>
      )}
    </>
  )
}
