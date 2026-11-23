import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import api, { errMsg, LEVELS, useFetch } from '../api.js'
import { useToast } from '../context.jsx'
import { Button, Card, ErrorBox, Input, Modal, PageHeader, PageLoader, Select, Textarea } from '../components/ui.jsx'

const csv = (v) => (Array.isArray(v) ? v.join(', ') : v || '')
const toList = (s) => s.split(',').map((x) => x.trim()).filter(Boolean)

/* ---------- generic CRUD helpers ---------- */
function useCrud(base, reload) {
  const toast = useToast()
  const remove = async (id, label) => {
    if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return
    try { await api.delete(`${base}/${id}`); toast('Deleted'); reload() } catch (e) { toast(errMsg(e), 'error') }
  }
  return { remove }
}

/* ---------- careers ---------- */
function CareerForm({ item, skills, onClose, onSaved }) {
  const blank = { title: '', description: '', opportunities: '', education_required: '', education_related: '', interest_keywords: '', work_environments: '', is_active: true, skills: [] }
  const [f, setF] = useState(item ? { ...item, education_required: csv(item.education_required), education_related: csv(item.education_related), interest_keywords: csv(item.interest_keywords), work_environments: csv(item.work_environments), skills: item.skills.map((s) => ({ ...s })) } : blank)
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [pick, setPick] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true)
    const body = { title: f.title, description: f.description, opportunities: f.opportunities, is_active: f.is_active, education_required: toList(f.education_required), education_related: toList(f.education_related),
      interest_keywords: toList(f.interest_keywords), work_environments: toList(f.work_environments), skills: f.skills }
    try { item ? await api.put(`/admin/careers/${item.id}`, body) : await api.post('/admin/careers', body); onSaved() } catch (x) { setErr(errMsg(x)) } finally { setBusy(false) }
  }
  const available = skills.filter((s) => !f.skills.some((x) => x.name === s.name))
  return (
    <form onSubmit={submit} className="space-y-4">
      {err && <ErrorBox>{err}</ErrorBox>}
      <Input label="Title" required value={f.title} onChange={set('title')} /><Textarea label="Description" required value={f.description} onChange={set('description')} /><Textarea label="Opportunities" value={f.opportunities || ''} onChange={set('opportunities')} />
      <div className="grid gap-4 sm:grid-cols-2"><Input label="Primary education fields" hint="Comma separated, e.g. computer science, bca" value={f.education_required} onChange={set('education_required')} /><Input label="Related education fields" value={f.education_related} onChange={set('education_related')} />
        <Input label="Interest keywords" value={f.interest_keywords} onChange={set('interest_keywords')} /><Input label="Work environments" hint="Remote, Hybrid, Startup…" value={f.work_environments} onChange={set('work_environments')} /></div>
      <div><span className="label">Required skills</span>
        <div className="mb-2 flex gap-2"><select className="input" value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Add skill"><option value="">Add a skill…</option>{available.map((s) => <option key={s.id}>{s.name}</option>)}</select>
          <button type="button" className="btn-ghost" disabled={!pick} onClick={() => { setF({ ...f, skills: [...f.skills, { name: pick, required_level: 2 }] }); setPick('') }}><Plus className="h-4 w-4" /></button></div>
        <ul className="space-y-1.5">{f.skills.map((s) => <li key={s.name} className="flex items-center justify-between rounded-lg border border-line/10 bg-line/5 px-3 py-1.5 text-sm"><span>{s.name}</span>
          <span className="flex items-center gap-2"><select className="rounded-lg border border-line/15 bg-bg/40 px-2 py-1 text-xs" value={s.required_level} onChange={(e) => setF({ ...f, skills: f.skills.map((x) => (x.name === s.name ? { ...x, required_level: Number(e.target.value) } : x)) })}>{[1, 2, 3].map((l) => <option key={l} value={l}>{LEVELS[l]}</option>)}</select>
            <button type="button" aria-label={`Remove ${s.name}`} onClick={() => setF({ ...f, skills: f.skills.filter((x) => x.name !== s.name) })} className="text-muted hover:text-red-400"><Trash2 className="h-4 w-4" /></button></span></li>)}</ul></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-violet-500" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} />Active (visible to students)</label>
      <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button loading={busy}>Save career</Button></div>
    </form>
  )
}

function SkillsPanel() {
  const toast = useToast(); const { data, loading, reload } = useFetch('/admin/skills'); const { remove } = useCrud('/admin/skills', reload)
  const [name, setName] = useState(''); const [cat, setCat] = useState(''); const [edit, setEdit] = useState(null)
  const add = async (e) => { e.preventDefault(); try { await api.post('/admin/skills', { name, category: cat }); setName(''); reload(); toast('Skill added') } catch (x) { toast(errMsg(x), 'error') } }
  const save = async () => { try { await api.put(`/admin/skills/${edit.id}`, { name: edit.name, category: edit.category }); setEdit(null); reload(); toast('Skill updated') } catch (x) { toast(errMsg(x), 'error') } }
  if (loading) return <PageLoader />
  return (
    <Card>
      <form onSubmit={add} className="mb-5 flex flex-wrap items-end gap-3"><div className="min-w-[160px] flex-1"><Input label="New skill" required value={name} onChange={(e) => setName(e.target.value)} /></div><div className="min-w-[160px] flex-1"><Input label="Category" value={cat} onChange={(e) => setCat(e.target.value)} placeholder="General" /></div><Button><Plus className="h-4 w-4" />Add skill</Button></form>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{data.skills.map((s) => (
        <div key={s.id} className="flex items-center justify-between rounded-xl border border-line/10 bg-line/5 px-3 py-2 text-sm">
          {edit?.id === s.id ? <div className="flex flex-1 gap-1"><input className="input !py-1" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /><button className="btn-primary !px-2.5 !py-1 text-xs" onClick={save}>Save</button></div>
            : <><span><span className="font-semibold">{s.name}</span><span className="ml-2 text-xs text-muted">{s.category}</span></span><span className="flex gap-1"><button aria-label={`Edit ${s.name}`} onClick={() => setEdit({ ...s })} className="p-1 text-muted hover:text-fg"><Pencil className="h-4 w-4" /></button><button aria-label={`Delete ${s.name}`} onClick={() => remove(s.id, s.name)} className="p-1 text-muted hover:text-red-400"><Trash2 className="h-4 w-4" /></button></span></>}</div>))}</div>
    </Card>
  )
}

export function AdminCareers() {
  const toast = useToast(); const careers = useFetch('/admin/careers'); const skills = useFetch('/admin/skills'); const { remove } = useCrud('/admin/careers', careers.reload)
  const [tab, setTab] = useState('careers'); const [modal, setModal] = useState(null)
  if (careers.loading || skills.loading) return <PageLoader />
  if (careers.error) return <ErrorBox>{careers.error}</ErrorBox>
  return (
    <>
      <PageHeader title="Career & skill management" subtitle="Changes apply immediately to recommendations, skill-gap analysis and the chatbot knowledge base." actions={tab === 'careers' && <Button onClick={() => setModal({})}><Plus className="h-4 w-4" />Add career</Button>} />
      <div className="mb-5 flex gap-2" role="tablist">{['careers', 'skills'].map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`rounded-full border px-5 py-1.5 text-sm font-medium capitalize ${tab === t ? 'border-transparent bg-gradient-to-r from-violet-500 to-cyan-400 text-white' : 'border-line/15 bg-line/5 text-muted'}`}>{t}</button>)}</div>
      {tab === 'skills' ? <SkillsPanel /> : (
        <Card><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs uppercase text-muted"><tr><th className="py-2">Career</th><th>Skills</th><th>Status</th><th /></tr></thead>
          <tbody>{careers.data.careers.map((c) => <tr key={c.id} className="border-t border-line/10"><td className="py-3 pr-3"><div className="font-semibold">{c.title}</div><div className="line-clamp-1 max-w-md text-xs text-muted">{c.description}</div></td><td>{c.skills.length}</td>
            <td><span className={`chip ${c.is_active ? 'border-emerald-400/40 text-emerald-300' : 'text-muted'}`}>{c.is_active ? 'Active' : 'Hidden'}</span></td>
            <td className="whitespace-nowrap text-right"><button className="btn-ghost !p-2" aria-label={`Edit ${c.title}`} onClick={() => setModal(c)}><Pencil className="h-4 w-4" /></button> <button className="btn-danger !p-2" aria-label={`Delete ${c.title}`} onClick={() => remove(c.id, c.title)}><Trash2 className="h-4 w-4" /></button></td></tr>)}</tbody></table></div></Card>)}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.id ? 'Edit career' : 'Add career'} wide>
        {modal && <CareerForm item={modal.id ? modal : null} skills={skills.data.skills} onClose={() => setModal(null)} onSaved={() => { setModal(null); careers.reload(); toast('Career saved') }} />}</Modal>
    </>
  )
}

/* ---------- courses ---------- */
function CourseForm({ item, skills, onClose, onSaved }) {
  const [f, setF] = useState(item ? { ...item, skills: csv(item.skills) } : { title: '', platform: '', skill_category: '', level: 'beginner', resource_type: 'course', url: 'https://', description: '', skills: '', is_active: true })
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true)
    const body = { title: f.title, platform: f.platform, skill_category: f.skill_category, level: f.level, resource_type: f.resource_type, url: f.url, description: f.description, skills: toList(f.skills), is_active: f.is_active }
    try { item ? await api.put(`/admin/courses/${item.id}`, body) : await api.post('/admin/courses', body); onSaved() } catch (x) { setErr(errMsg(x)) } finally { setBusy(false) }
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      {err && <ErrorBox>{err}</ErrorBox>}
      <Input label="Title" required value={f.title} onChange={set('title')} />
      <div className="grid gap-4 sm:grid-cols-2"><Input label="Platform" required value={f.platform} onChange={set('platform')} /><Input label="Skill category" required value={f.skill_category} onChange={set('skill_category')} />
        <Select label="Difficulty" value={f.level} onChange={set('level')} options={['beginner', 'intermediate', 'advanced']} /><Select label="Type" value={f.resource_type} onChange={set('resource_type')} options={['course', 'certification', 'resource']} /></div>
      <Input label="URL (must be a verified link)" required type="url" value={f.url} onChange={set('url')} />
      <Textarea label="Description" value={f.description || ''} onChange={set('description')} />
      <Input label="Skills it teaches" hint={`Comma separated, exact names, e.g. ${skills.slice(0, 3).map((s) => s.name).join(', ')}`} value={f.skills} onChange={set('skills')} />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-violet-500" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} />Active</label>
      <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button loading={busy}>Save</Button></div>
    </form>
  )
}

export function AdminCourses() {
  const toast = useToast(); const courses = useFetch('/admin/courses'); const skills = useFetch('/admin/skills'); const { remove } = useCrud('/admin/courses', courses.reload)
  const [modal, setModal] = useState(null); const [type, setType] = useState(''); const [q, setQ] = useState('')
  if (courses.loading || skills.loading) return <PageLoader />
  if (courses.error) return <ErrorBox>{courses.error}</ErrorBox>
  const rows = courses.data.courses.filter((c) => (!type || c.resource_type === type) && (!q || c.title.toLowerCase().includes(q.toLowerCase())))
  return (
    <>
      <PageHeader title="Course & learning resource management" subtitle="Add only links you have opened and verified. Students see these on the Courses page and roadmaps." actions={<Button onClick={() => setModal({})}><Plus className="h-4 w-4" />Add course</Button>} />
      <Card className="mb-5 grid gap-4 sm:grid-cols-2"><Input label="Search" value={q} onChange={(e) => setQ(e.target.value)} /><Select label="Type" value={type} onChange={(e) => setType(e.target.value)} options={['course', 'certification', 'resource']} placeholder="All types" /></Card>
      <Card><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs uppercase text-muted"><tr><th className="py-2">Title</th><th>Platform</th><th>Level</th><th>Type</th><th>Status</th><th /></tr></thead>
        <tbody>{rows.map((c) => <tr key={c.id} className="border-t border-line/10"><td className="py-3 pr-3"><a href={c.url} target="_blank" rel="noopener noreferrer" className="font-semibold hover:text-cyan-300">{c.title}</a><div className="text-xs text-muted">{c.skill_category}</div></td><td className="pr-3">{c.platform}</td><td className="pr-3 capitalize">{c.level}</td><td className="pr-3 capitalize">{c.resource_type}</td>
          <td><span className={`chip ${c.is_active ? 'border-emerald-400/40 text-emerald-300' : 'text-muted'}`}>{c.is_active ? 'Active' : 'Hidden'}</span></td>
          <td className="whitespace-nowrap text-right"><button className="btn-ghost !p-2" aria-label={`Edit ${c.title}`} onClick={() => setModal(c)}><Pencil className="h-4 w-4" /></button> <button className="btn-danger !p-2" aria-label={`Delete ${c.title}`} onClick={() => remove(c.id, c.title)}><Trash2 className="h-4 w-4" /></button></td></tr>)}</tbody></table></div></Card>
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.id ? 'Edit course' : 'Add course'}>
        {modal && <CourseForm item={modal.id ? modal : null} skills={skills.data.skills} onClose={() => setModal(null)} onSaved={() => { setModal(null); courses.reload(); toast('Saved') }} />}</Modal>
    </>
  )
}
