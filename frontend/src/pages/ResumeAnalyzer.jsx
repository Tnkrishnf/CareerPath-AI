import { useRef, useState } from 'react'
import { FileText, GraduationCap, Lightbulb, Tags, UploadCloud, XCircle } from 'lucide-react'
import api, { errMsg, useFetch } from '../api.js'
import { useToast } from '../context.jsx'
import CareerSelect from '../components/CareerSelect.jsx'
import { Button, Card, ErrorBox, fmtDate, PageHeader, Progress } from '../components/ui.jsx'

function Result({ r }) {
  const x = r.result
  return (
    <div className="space-y-5">
      <Card><h2 className="mb-1 font-bold">Analysis of {r.filename}</h2><p className="text-xs text-muted">{r.pages} page(s) · {x.word_count} words · {fmtDate(r.created_at)}{x.target_career && <> · target: {x.target_career.title}</>}</p></Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card><h3 className="mb-3 flex items-center gap-2 font-bold"><Tags className="h-4 w-4 text-cyan-300" />Skills found ({x.skills.length})</h3>
          <div className="flex flex-wrap gap-1.5">{x.skills.length ? x.skills.map((s) => <span key={s} className="chip border-emerald-400/30 bg-emerald-400/10 text-emerald-300">{s}</span>) : <span className="text-sm text-muted">No known skills detected.</span>}</div></Card>
        <Card><h3 className="mb-3 flex items-center gap-2 font-bold"><GraduationCap className="h-4 w-4 text-violet-300" />Education detected</h3>
          <div className="flex flex-wrap gap-1.5">{x.education.length ? x.education.map((s) => <span key={s} className="chip">{s}</span>) : <span className="text-sm text-muted">No degree keywords found. Add an Education section.</span>}</div>
          <h3 className="mb-2 mt-5 text-sm font-bold">Career-related keywords</h3><div className="flex flex-wrap gap-1.5">{x.keywords.length ? x.keywords.map((s) => <span key={s} className="chip">{s}</span>) : <span className="text-sm text-muted">None found.</span>}</div></Card>
        <Card><h3 className="mb-3 flex items-center gap-2 font-bold"><XCircle className="h-4 w-4 text-amber-300" />Missing skills{x.target_career && ` for ${x.target_career.title}`}</h3>
          {x.missing_skills.length === 0 ? <p className="text-sm text-emerald-300">Your resume shows all core skills for this career.</p> : <div className="flex flex-wrap gap-1.5">{x.missing_skills.map((m) => <span key={m.skill} className="chip border-amber-400/40 bg-amber-400/10 text-amber-300">{m.skill} · {m.required_level}</span>)}</div>}
          <h3 className="mb-2 mt-5 text-sm font-bold">Best-matching careers by skill coverage</h3>
          <ul className="space-y-2">{x.best_matching_careers.map((c) => <li key={c.id}><div className="mb-1 flex justify-between text-xs"><span>{c.title}</span><span className="text-muted">{c.skill_coverage_percent}%</span></div><Progress value={c.skill_coverage_percent} /></li>)}</ul></Card>
        <Card><h3 className="mb-3 flex items-center gap-2 font-bold"><Lightbulb className="h-4 w-4 text-amber-300" />Suggestions</h3>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted">{[...x.career_suggestions, ...x.general_suggestions].map((s) => <li key={s}>{s}</li>)}</ul></Card>
      </div>
    </div>
  )
}

export default function ResumeAnalyzer() {
  const toast = useToast(); const input = useRef(null)
  const hist = useFetch('/resume')
  const [file, setFile] = useState(null); const [career, setCareer] = useState(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [result, setResult] = useState(null); const [drag, setDrag] = useState(false)

  const pick = (f) => {
    setErr('')
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.pdf')) return setErr('Only PDF files are accepted.')
    if (f.size > 5 * 1024 * 1024) return setErr('File is too large (max 5 MB).')
    setFile(f)
  }
  const submit = async () => {
    setBusy(true); setErr('')
    const fd = new FormData(); fd.append('resume', file); if (career) fd.append('career_id', career)
    try { const { data } = await api.post('/resume/analyze', fd); setResult(data); hist.reload(); toast('Resume analysed') } catch (e) { setErr(errMsg(e)) } finally { setBusy(false) }
  }
  return (
    <>
      <PageHeader title="Resume analyzer" subtitle="Upload a text-based PDF resume (max 5 MB). The file is analysed in memory and not stored; only the results are saved." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <Card className="space-y-4">
            <div onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]) }}
              onClick={() => input.current.click()} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && input.current.click()}
              className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition ${drag ? 'border-cyan-300 bg-cyan-400/10' : 'border-line/20 hover:border-violet-400/60'}`}>
              <UploadCloud className="mx-auto mb-2 h-9 w-9 text-violet-300" />
              <p className="text-sm font-semibold">{file ? file.name : 'Drop your PDF here or click to browse'}</p>
              <input ref={input} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => pick(e.target.files[0])} />
            </div>
            <CareerSelect value={career} onChange={setCareer} label="Target career (optional)" placeholder="Best match from my resume" />
            {err && <ErrorBox>{err}</ErrorBox>}
            <Button className="w-full" onClick={submit} disabled={!file} loading={busy}><FileText className="h-4 w-4" />Analyse resume</Button>
          </Card>
          <Card><h3 className="mb-3 font-bold">Previous analyses</h3>
            {hist.data?.analyses?.length ? <ul className="space-y-2">{hist.data.analyses.map((a) => <li key={a.id}><button onClick={() => setResult(a)} className="w-full rounded-xl border border-line/10 bg-line/5 px-3 py-2 text-left text-sm transition hover:border-violet-400/40"><div className="truncate font-semibold">{a.filename}</div><div className="text-xs text-muted">{fmtDate(a.created_at)} · {a.result.skills.length} skills</div></button></li>)}</ul> : <p className="text-sm text-muted">Nothing yet.</p>}</Card>
        </div>
        <div className="lg:col-span-2">{result ? <Result r={result} /> : <Card className="grid min-h-[300px] place-items-center text-center text-muted"><div><FileText className="mx-auto mb-3 h-10 w-10" /><p>Upload a resume to see detected skills, gaps and suggestions.</p></div></Card>}</div>
      </div>
    </>
  )
}
