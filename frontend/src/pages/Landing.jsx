import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, BarChart3, Bot, FileText, GraduationCap, Map, ShieldCheck, Sparkles, Target } from 'lucide-react'
import { Logo, ThemeToggle } from '../components/Layout.jsx'

const FEATURES = [
  [Target, 'Explainable career matching', 'Top-5 careers scored from your skills, education, interests and goals. Every percentage is traceable, never random.'],
  [Bot, 'AI career chatbot', 'Ask anything about careers, languages, certifications and interviews. Answers are grounded in a curated knowledge base.'],
  [BarChart3, 'Skill-gap analysis', 'See exactly which skills you have, which are missing, and what to learn first, with interactive charts.'],
  [Map, 'Personalised roadmaps', 'Stage-by-stage plans with topics, practice, projects and progress tracking you can update as you learn.'],
  [GraduationCap, 'Verified course picks', 'Courses and certifications filtered by level and matched to your skill gaps.'],
  [FileText, 'Resume analyzer', 'Upload a PDF resume to detect skills and education, find gaps and get career-specific suggestions.'],
]
const fade = (i = 0) => ({ initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true }, transition: { delay: i * 0.07, duration: 0.5 } })

export default function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <nav className="flex items-center gap-2"><ThemeToggle /><Link to="/login" className="btn-ghost">Log in</Link><Link to="/register" className="btn-primary">Get started</Link></nav>
      </header>

      <section className="mx-auto max-w-6xl px-5 pb-20 pt-14 text-center sm:pt-24">
        <motion.span {...fade()} className="chip mx-auto border-violet-400/30 bg-violet-500/10 text-violet-300"><Sparkles className="h-3.5 w-3.5" />AI-powered career guidance for students</motion.span>
        <motion.h1 {...fade(1)} className="mx-auto mt-6 max-w-4xl text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl">Find the career that fits <span className="grad-text">your skills and your goals</span></motion.h1>
        <motion.p {...fade(2)} className="mx-auto mt-6 max-w-2xl text-lg text-muted">Take a short assessment, get transparent recommendations, close your skill gaps with a personal roadmap, and chat with an AI guide that only shares verified information.</motion.p>
        <motion.div {...fade(3)} className="mt-9 flex flex-wrap justify-center gap-3">
          <Link to="/register" className="btn-primary !px-6 !py-3 text-base">Start free assessment <ArrowRight className="h-4 w-4" /></Link>
          <Link to="/login" className="btn-ghost !px-6 !py-3 text-base">I have an account</Link>
        </motion.div>
        <motion.div {...fade(4)} className="glass mx-auto mt-16 grid max-w-3xl grid-cols-3 divide-x divide-line/10 py-5">
          {[['12', 'career paths'], ['54', 'skills tracked'], ['65', 'curated resources']].map(([n, l]) => <div key={l}><div className="grad-text text-3xl font-extrabold">{n}</div><div className="text-xs text-muted">{l}</div></div>)}
        </motion.div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20">
        <h2 className="mb-10 text-center text-3xl font-extrabold">Everything you need to plan your path</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(([Icon, t, d], i) => (
            <motion.div key={t} {...fade(i)} className="glass glass-hover p-6"><div className="mb-4 inline-block rounded-xl bg-gradient-to-br from-violet-500/30 to-cyan-400/20 p-3"><Icon className="h-5 w-5 text-cyan-300" /></div>
              <h3 className="font-bold">{t}</h3><p className="mt-2 text-sm text-muted">{d}</p></motion.div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="glass grid gap-8 p-8 md:grid-cols-3">
          {[['1', 'Tell us about you', 'Qualifications, skills with proficiency, interests and goals in a 5-step form.'], ['2', 'Get explained matches', 'See why each career fits and which skills are missing.'], ['3', 'Learn and track', 'Follow the roadmap, take recommended courses and track progress.']].map(([n, t, d]) => (
            <div key={n} className="flex gap-4"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 font-bold text-white">{n}</div><div><h3 className="font-bold">{t}</h3><p className="mt-1 text-sm text-muted">{d}</p></div></div>
          ))}
        </div>
        <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-muted"><ShieldCheck className="h-4 w-4" />Recommendations are guidance, not guarantees of employment. Passwords are hashed and never stored in plain text.</p>
      </section>
      <footer className="border-t border-line/10 py-6 text-center text-xs text-muted">© {new Date().getFullYear()} CareerPath AI · Final-year B.Sc. Computer Science project</footer>
    </div>
  )
}
