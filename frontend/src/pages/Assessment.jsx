import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import api, { errMsg, useFetch } from '../api.js'
import { useAuth, useToast } from '../context.jsx'
import { Button, Card, ErrorBox, Input, LevelBadge, PageHeader, PageLoader, Select, Textarea } from '../components/ui.jsx'
import SkillEditor, { TagToggle } from '../components/SkillEditor.jsx'

const STEPS = ['Education', 'Skills', 'Interests', 'Preferences', 'Goals & review']

export default function Assessment() {
  const nav = useNavigate(); const toast = useToast(); const { user } = useAuth()
  const opts = useFetch('/meta/options'); const prof = useFetch('/profile')
  const [step, setStep] = useState(0); const [f, setF] = useState(null); const [skills, setSkills] = useState([])
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!prof.data) return
    const p = prof.data.profile
    setF({ full_name: prof.data.user.full_name, education_level: p.education_level || '', degree: p.degree || '', department: p.department || '', interests: p.interests || [],
      favourite_subjects: p.favourite_subjects || [], work_environment: p.work_environment || '', career_goals: p.career_goals || '', learning_preference: p.learning_preference || '' })
    setSkills(prof.data.skills)
  }, [prof.data])
  if (opts.loading || prof.loading || !f) return <PageLoader />
  const o = opts.data; const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const validate = () => {
    if (step === 0 && (!f.full_name.trim() || !f.education_level || !f.degree.trim())) return 'Please fill in your name, qualification and degree.'
    if (step === 1 && skills.length === 0) return 'Add at least one skill with a proficiency level.'
    if (step === 2 && f.interests.length === 0) return 'Select at least one area of interest.'
    return ''
  }
  const next = () => { const v = validate(); setErr(v); if (!v) setStep(step + 1) }
  const submit = async () => {
    setErr(''); setBusy(true)
    try { await api.post('/assessments', { ...f, skills }); toast('Assessment complete — recommendations ready!'); nav('/recommendations') }
    catch (x) { setErr(errMsg(x)) } finally { setBusy(false) }
  }

  return (
    <>
      <PageHeader title="Career assessment" subtitle={`Hi ${user.full_name.split(' ')[0]}, answer honestly: the more accurate your answers, the better your matches.`} />
      <ol className="mb-6 flex items-center gap-2 overflow-x-auto pb-1" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-2 whitespace-nowrap">
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-gradient-to-br from-violet-500 to-cyan-400 text-white shadow-glow' : 'bg-line/10 text-muted'}`}>{i < step ? <Check className="h-4 w-4" /> : i + 1}</span>
            <span className={`hidden text-sm sm:block ${i === step ? 'font-semibold' : 'text-muted'}`}>{s}</span>
            {i < STEPS.length - 1 && <span className="h-px flex-1 bg-line/15" />}
          </li>
        ))}
      </ol>
      <Card className="min-h-[340px]">
        {err && <div className="mb-4"><ErrorBox>{err}</ErrorBox></div>}
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.2 }}>
            {step === 0 && <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Full name" value={f.full_name} onChange={set('full_name')} />
              <Select label="Educational qualification" value={f.education_level} onChange={set('education_level')} options={o.education_levels} placeholder="Select…" />
              <Input label="Degree" value={f.degree} onChange={set('degree')} placeholder="e.g. B.Sc Computer Science" />
              <Input label="Department / specialisation" value={f.department} onChange={set('department')} placeholder="e.g. Computer Science" /></div>}
            {step === 1 && <div><h2 className="mb-1 font-bold">Technical skills and proficiency</h2><p className="mb-4 text-sm text-muted">Beginner: know the basics · Intermediate: can build small projects · Advanced: confident and can teach others.</p><SkillEditor skills={o.skills} value={skills} onChange={setSkills} /></div>}
            {step === 2 && <div className="space-y-6">
              <div><h2 className="mb-3 font-bold">Areas of interest</h2><TagToggle options={o.interests} value={f.interests} onChange={(v) => setF({ ...f, interests: v })} /></div>
              <div><h2 className="mb-3 font-bold">Favourite subjects</h2><TagToggle options={o.subjects} value={f.favourite_subjects} onChange={(v) => setF({ ...f, favourite_subjects: v })} /></div></div>}
            {step === 3 && <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Preferred work environment" value={f.work_environment} onChange={set('work_environment')} options={o.work_environments} placeholder="Select…" />
              <Select label="How do you like to learn?" value={f.learning_preference} onChange={set('learning_preference')} options={o.learning_preferences} placeholder="Select…" /></div>}
            {step === 4 && <div className="space-y-5">
              <Textarea label="Career goals" placeholder="e.g. I want to become a data scientist and work on machine learning projects." value={f.career_goals} onChange={set('career_goals')} />
              <div className="rounded-xl border border-line/10 bg-line/5 p-4 text-sm"><h3 className="mb-2 font-bold">Review</h3>
                <p><span className="text-muted">Education:</span> {f.education_level}, {f.degree} {f.department}</p>
                <p className="mt-1 flex flex-wrap items-center gap-1"><span className="text-muted">Skills:</span> {skills.map((s) => <span key={s.name} className="chip">{s.name} <LevelBadge level={s.level} /></span>)}</p>
                <p className="mt-1"><span className="text-muted">Interests:</span> {f.interests.join(', ') || '—'}</p>
                <p className="mt-1"><span className="text-muted">Environment:</span> {f.work_environment || '—'} · <span className="text-muted">Learning:</span> {f.learning_preference || '—'}</p></div></div>}
          </motion.div>
        </AnimatePresence>
      </Card>
      <div className="mt-5 flex justify-between">
        <Button variant="ghost" onClick={() => { setErr(''); setStep(step - 1) }} disabled={step === 0}><ChevronLeft className="h-4 w-4" />Back</Button>
        {step < STEPS.length - 1 ? <Button onClick={next}>Next<ChevronRight className="h-4 w-4" /></Button> : <Button onClick={submit} loading={busy}><Sparkles className="h-4 w-4" />Get my recommendations</Button>}
      </div>
    </>
  )
}
