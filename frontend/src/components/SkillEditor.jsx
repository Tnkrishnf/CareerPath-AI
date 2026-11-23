import { useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { LEVELS } from '../api.js'
import { LevelBadge } from './ui.jsx'

/** Controlled editor for [{name, level}] using the catalogue of skills from /meta/options. */
export default function SkillEditor({ skills, value, onChange }) {
  const [name, setName] = useState('')
  const [level, setLevel] = useState(2)
  const chosen = new Set(value.map((s) => s.name))
  const grouped = useMemo(() => {
    const g = {}
    skills.filter((s) => !chosen.has(s.name)).forEach((s) => (g[s.category] ||= []).push(s.name))
    return g
  }, [skills, value]) // eslint-disable-line react-hooks/exhaustive-deps

  const add = () => { if (!name) return; onChange([...value, { name, level }]); setName('') }
  const setLvl = (n, l) => onChange(value.map((s) => (s.name === n ? { ...s, level: l } : s)))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[180px] flex-1">
          <span className="label">Skill</span>
          <select className="input" value={name} onChange={(e) => setName(e.target.value)} aria-label="Skill">
            <option value="">Choose a skill…</option>
            {Object.entries(grouped).map(([cat, names]) => <optgroup key={cat} label={cat}>{names.map((n) => <option key={n}>{n}</option>)}</optgroup>)}
          </select>
        </div>
        <div>
          <span className="label">Proficiency</span>
          <div className="flex gap-1" role="radiogroup" aria-label="Proficiency">
            {[1, 2, 3].map((l) => (
              <button type="button" key={l} role="radio" aria-checked={level === l} onClick={() => setLevel(l)}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${level === l ? 'border-violet-400 bg-violet-500/25' : 'border-line/15 bg-line/5 hover:bg-line/10'}`}>{LEVELS[l]}</button>
            ))}
          </div>
        </div>
        <button type="button" className="btn-primary" onClick={add} disabled={!name}><Plus className="h-4 w-4" />Add</button>
      </div>
      {value.length === 0 ? <p className="text-sm text-muted">No skills added yet.</p> : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {value.map((s) => (
            <li key={s.name} className="flex items-center justify-between gap-2 rounded-xl border border-line/10 bg-line/5 px-3 py-2">
              <span className="text-sm font-semibold">{s.name}</span>
              <span className="flex items-center gap-1">
                <select className="rounded-lg border border-line/15 bg-bg/40 px-2 py-1 text-xs" value={s.level} onChange={(e) => setLvl(s.name, Number(e.target.value))} aria-label={`${s.name} level`}>
                  {[1, 2, 3].map((l) => <option key={l} value={l}>{LEVELS[l]}</option>)}
                </select>
                <button type="button" onClick={() => onChange(value.filter((x) => x.name !== s.name))} className="rounded p-1 text-muted hover:text-red-400" aria-label={`Remove ${s.name}`}><X className="h-4 w-4" /></button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
export { LevelBadge }

export function TagToggle({ options, value, onChange }) {
  const toggle = (o) => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o])
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button type="button" key={o} onClick={() => toggle(o)} aria-pressed={value.includes(o)}
          className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${value.includes(o) ? 'border-transparent bg-gradient-to-r from-violet-500 to-cyan-400 text-white shadow-md' : 'border-line/15 bg-line/5 text-muted hover:text-fg'}`}>{o}</button>
      ))}
    </div>
  )
}
