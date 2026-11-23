import { useFetch } from '../api.js'
import { Select } from './ui.jsx'

/** Career dropdown. onLoaded gives the parent the careers list (e.g. to preselect). */
export default function CareerSelect({ value, onChange, label = 'Career', placeholder }) {
  const { data } = useFetch('/careers')
  const options = (data?.careers || []).map((c) => ({ value: String(c.id), label: c.title }))
  return <Select label={label} value={value ? String(value) : ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)} options={options} placeholder={placeholder ?? 'Select a career…'} />
}

/** Default career: ?career= param, else the student's #1 recommendation, else the first career. */
export function useDefaultCareer(param) {
  const recs = useFetch('/recommendations'); const careers = useFetch('/careers')
  const loading = recs.loading || careers.loading
  const id = param ? Number(param) : recs.data?.recommendations?.[0]?.career.id || careers.data?.careers?.[0]?.id || null
  return { id, loading, hasRecs: !!recs.data?.recommendations?.length }
}
