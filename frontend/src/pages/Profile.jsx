import { useEffect, useState } from 'react'
import api, { errMsg, useFetch } from '../api.js'
import { useAuth, useToast } from '../context.jsx'
import { Button, Card, ErrorBox, Input, PageHeader, PageLoader, Select, Textarea } from '../components/ui.jsx'
import SkillEditor, { TagToggle } from '../components/SkillEditor.jsx'

export default function Profile() {
  const toast = useToast(); const { setUser } = useAuth()
  const opts = useFetch('/meta/options'); const prof = useFetch('/profile')
  const [f, setF] = useState(null); const [skills, setSkills] = useState([]); const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const [pw, setPw] = useState({ current_password: '', new_password: '' }); const [pwBusy, setPwBusy] = useState(false)

  useEffect(() => {
    if (!prof.data) return
    setF({ full_name: prof.data.user.full_name, ...Object.fromEntries(Object.entries(prof.data.profile).map(([k, v]) => [k, v ?? (Array.isArray(v) ? [] : '')])) })
    setSkills(prof.data.skills)
  }, [prof.data])

  if (opts.loading || prof.loading || !f) return <PageLoader />
  const o = opts.data; const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const save = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true)
    try {
      const body = { ...f, graduation_year: f.graduation_year ? Number(f.graduation_year) : null, skills }
      const { data } = await api.put('/profile', body); setUser((u) => ({ ...u, full_name: data.user.full_name })); toast('Profile saved')
    } catch (x) { setErr(errMsg(x)) } finally { setBusy(false) }
  }
  const changePw = async (e) => {
    e.preventDefault(); setPwBusy(true)
    try { await api.put('/profile/password', pw); setPw({ current_password: '', new_password: '' }); toast('Password changed') } catch (x) { toast(errMsg(x), 'error') } finally { setPwBusy(false) }
  }
  return (
    <>
      <PageHeader title="Your profile" subtitle="Keep this up to date for better recommendations and chatbot answers." />
      <form onSubmit={save} className="space-y-6">
        {err && <ErrorBox>{err}</ErrorBox>}
        <Card className="grid gap-4 sm:grid-cols-2">
          <Input label="Full name" required value={f.full_name} onChange={set('full_name')} />
          <Select label="Educational qualification" value={f.education_level} onChange={set('education_level')} options={o.education_levels} placeholder="Select…" />
          <Input label="Degree" value={f.degree} onChange={set('degree')} placeholder="e.g. B.Sc Computer Science" />
          <Input label="Department" value={f.department} onChange={set('department')} />
          <Input label="Graduation year" type="number" min="1990" max="2100" value={f.graduation_year} onChange={set('graduation_year')} />
          <Select label="Preferred work environment" value={f.work_environment} onChange={set('work_environment')} options={o.work_environments} placeholder="Select…" />
          <Select label="Learning preference" value={f.learning_preference} onChange={set('learning_preference')} options={o.learning_preferences} placeholder="Select…" />
          <div className="sm:col-span-2"><Textarea label="Career goals" value={f.career_goals} onChange={set('career_goals')} /></div>
        </Card>
        <Card className="space-y-5">
          <div><span className="label">Areas of interest</span><TagToggle options={o.interests} value={f.interests} onChange={(v) => setF({ ...f, interests: v })} /></div>
          <div><span className="label">Favourite subjects</span><TagToggle options={o.subjects} value={f.favourite_subjects} onChange={(v) => setF({ ...f, favourite_subjects: v })} /></div>
        </Card>
        <Card><h2 className="mb-4 font-bold">Technical skills</h2><SkillEditor skills={o.skills} value={skills} onChange={setSkills} /></Card>
        <Button loading={busy}>Save profile</Button>
      </form>
      <Card className="mt-8 max-w-xl"><h2 className="mb-4 font-bold">Change password</h2>
        <form onSubmit={changePw} className="space-y-4">
          <Input label="Current password" type="password" required value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} />
          <Input label="New password" type="password" required minLength={8} value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} />
          <Button variant="ghost" loading={pwBusy}>Update password</Button></form></Card>
    </>
  )
}
