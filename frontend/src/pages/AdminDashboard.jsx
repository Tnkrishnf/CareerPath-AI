import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BookOpen, Briefcase, ClipboardCheck, MessageSquare, Users } from 'lucide-react'
import api, { errMsg, useFetch } from '../api.js'
import { useToast } from '../context.jsx'
import { Card, CHART, ErrorBox, fmtDate, PageHeader, PageLoader, Stat } from '../components/ui.jsx'

export default function AdminDashboard() {
  const toast = useToast()
  const stats = useFetch('/admin/stats'); const users = useFetch('/admin/users')
  if (stats.loading || users.loading) return <PageLoader />
  if (stats.error) return <ErrorBox>{stats.error}</ErrorBox>
  const { totals: t, most_recommended, activity, common_skill_gaps } = stats.data
  const tick = { fill: CHART.axis, fontSize: 11 }
  const toggle = async (u) => { try { await api.put(`/admin/users/${u.id}/active`, { is_active: !u.is_active }); users.reload(); toast(u.is_active ? 'User disabled' : 'User enabled') } catch (e) { toast(errMsg(e), 'error') } }
  return (
    <>
      <PageHeader title="Admin dashboard" subtitle="Platform usage, recommendation trends and user management." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Users} label="Registered students" value={t.students} /><Stat icon={ClipboardCheck} label="Career assessments" value={t.assessments} />
        <Stat icon={Briefcase} label="Careers / skills" value={`${t.careers} / ${t.skills}`} /><Stat icon={BookOpen} label="Courses & resources" value={t.courses} hint={`${t.chat_messages} chat messages · ${t.resumes} resumes`} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card><h2 className="mb-3 font-bold">User activity (last 14 days)</h2><div className="h-64"><ResponsiveContainer><LineChart data={activity}>
          <CartesianGrid stroke={CHART.grid} vertical={false} /><XAxis dataKey="date" tick={tick} tickFormatter={(d) => d.slice(5)} /><YAxis allowDecimals={false} tick={tick} width={30} /><Tooltip /><Legend />
          <Line type="monotone" dataKey="registrations" name="Sign-ups" stroke={CHART.violet} strokeWidth={2.5} dot={false} /><Line type="monotone" dataKey="assessments" name="Assessments" stroke={CHART.cyan} strokeWidth={2.5} dot={false} /><Line type="monotone" dataKey="chats" name="Chat questions" stroke={CHART.amber} strokeWidth={2.5} strokeDasharray="6 4" dot={false} /></LineChart></ResponsiveContainer></div></Card>
        <Card><h2 className="mb-3 font-bold">Most recommended careers</h2><div className="h-64"><ResponsiveContainer><BarChart data={most_recommended} layout="vertical" margin={{ left: 20 }}>
          <CartesianGrid stroke={CHART.grid} horizontal={false} /><XAxis type="number" allowDecimals={false} tick={tick} /><YAxis type="category" dataKey="career" width={140} tick={tick} /><Tooltip /><Legend />
          <Bar dataKey="top_pick" name="As #1 pick" stackId="a" fill={CHART.violet} /><Bar dataKey="times_recommended" name="In top 5" fill={CHART.blue} radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer></div></Card>
        <Card><h2 className="mb-3 font-bold">Most common skill gaps</h2><div className="h-64"><ResponsiveContainer><BarChart data={common_skill_gaps}>
          <CartesianGrid stroke={CHART.grid} vertical={false} /><XAxis dataKey="skill" tick={tick} interval={0} angle={-25} textAnchor="end" height={60} /><YAxis allowDecimals={false} tick={tick} width={30} /><Tooltip /><Bar dataKey="count" name="Students" fill={CHART.cyan} radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div></Card>
        <Card><h2 className="mb-3 flex items-center gap-2 font-bold"><MessageSquare className="h-4 w-4 text-violet-300" />Users</h2>
          <div className="max-h-64 overflow-auto"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-surface text-xs uppercase text-muted"><tr><th className="py-2">Name</th><th>Role</th><th>Assess.</th><th>Joined</th><th /></tr></thead>
            <tbody>{users.data?.users.map((u) => <tr key={u.id} className="border-t border-line/10"><td className="py-2"><div className="font-semibold">{u.full_name}</div><div className="text-xs text-muted">{u.email}</div></td><td className="capitalize">{u.role}</td><td>{u.assessments}</td><td className="whitespace-nowrap text-xs text-muted">{fmtDate(u.created_at)}</td>
              <td className="text-right">{u.role === 'student' && <button className={u.is_active ? 'btn-danger !px-2.5 !py-1 text-xs' : 'btn-ghost !px-2.5 !py-1 text-xs'} onClick={() => toggle(u)}>{u.is_active ? 'Disable' : 'Enable'}</button>}</td></tr>)}</tbody></table></div></Card>
      </div>
    </>
  )
}
