# CareerPath AI – AI-Powered Career Guidance Agent

Full-stack project: **React + Tailwind + Framer Motion + Recharts** frontend, **Flask + SQLAlchemy + JWT** backend, **MySQL** database,
**scikit-learn** recommendation engine, and a **RAG chatbot** (TF-IDF retrieval + optional LLM).

```
careerpath-ai-v2/
├── backend/                 Flask API
│   ├── app.py               app factory (python app.py)
│   ├── config.py            settings from environment variables
│   ├── models.py            15 SQLAlchemy tables
│   ├── seed.py              creates DB + tables + sample data
│   ├── routes/              blueprints: auth, profile, careers (assessment/recs/skill-gap/saved), courses, roadmap, resume, ai_chat, dashboard, admin
│   ├── services/            recommender.py (ML), rag.py, chat_agent.py (LLM), resume_parser.py
│   ├── data/                seed_data.py (careers, skills, courses), knowledge_base.json
│   └── tests/test_api.py    12 automated API tests
├── database/schema.sql      complete MySQL schema (generated from models)
├── frontend/                React app (Vite)
├── scripts/                 gen_schema.py, check_links.py
```

## 1. Prerequisites
Python 3.10+, Node 18+, MySQL 8 (+ MySQL Workbench optional).

## 2. Database (MySQL)
Option A – let the seed script do it (creates database `careerpath_ai` automatically):
see step 3. Option B – in MySQL Workbench open `database/schema.sql` and run it (⚡), then run the seed script.

## 3. Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate            # Windows      (macOS/Linux: source venv/bin/activate)
pip install -r requirements.txt
copy .env.example .env           # macOS/Linux: cp .env.example .env
```
Edit `.env`: set `DATABASE_URL=mysql+pymysql://root:YOUR_PASSWORD@localhost:3306/careerpath_ai` and change `SECRET_KEY` / `JWT_SECRET_KEY`.
```bash
python seed.py                   # tables + 12 careers, 54 skills, 65 courses + demo users
python app.py                    # API on http://localhost:5000
```
No MySQL yet? For a quick try use `DATABASE_URL=sqlite:///careerpath_dev.db`.

Run tests: `python -m pytest -q` (uses in-memory SQLite).

## 4. Frontend
```bash
cd frontend
npm install
npm run dev                      # http://localhost:5173  (proxies /api to Flask)
```
Production build: `npm run build`.

## 5. Demo logins (created by seed.py)
| Role | Email | Password |
|---|---|---|
| Student | student@careerpath.ai | Student@12345 |
| Admin | admin@careerpath.ai | Admin@12345 |

Change these in `.env` before sharing the project. Seven extra demo students (`demo1..8@careerpath.ai`, password `Demo@12345`) populate the admin charts.

## 6. Enabling the LLM chatbot
Default is `LLM_PROVIDER=none`: the bot answers from the curated knowledge base (offline, no key needed).
For conversational answers set in `backend/.env`:
```
LLM_PROVIDER=anthropic        # or openai
LLM_MODEL=claude-sonnet-5-5   # any model your key supports
ANTHROPIC_API_KEY=...         # or OPENAI_API_KEY
```
Keys stay on the server. The prompt forbids inventing links, salaries, eligibility rules or jobs; **links shown to students come only from the
knowledge base and the courses table**, never from model text.

## 7. How the recommendation score works (explainable)
`match = 55% skills + 20% interests + 15% education + 10% preferences`
* **Skills** – for every required skill: `min(your level / required level, 1)`, weighted by required level.
* **Interests** – TF-IDF cosine similarity (scikit-learn) between your interests/subjects and each career profile, scaled so the best career = 100%.
* **Education** – 100% primary-field match, 60% related field, 30% other degree.
* **Preferences** – work-environment match + career-goal keyword match.
No random numbers; the breakdown is shown on every recommendation card. Scores are guidance, not a guarantee of employment.

## 8. Security features
Password hashing (Werkzeug scrypt), JWT + logout revocation, role-based access (student/admin), server-side validation on every endpoint,
SQLAlchemy parameterised queries (SQL-injection safe), PDF upload validation (extension, MIME, `%PDF` signature, 5 MB, 10 pages, in-memory only),
rate limits (AI endpoints 20/min per user, login/register limits), JSON-only safe error messages, secrets only in `.env`.

## 9. Pages
Landing · Register · Login · Forgot/Reset password · Dashboard · Profile · Career Assessment (5 steps) · Recommendations · AI Chatbot ·
Skill Gap Analyzer · Learning Roadmap (progress tracking) · Courses (level filters) · Resume Analyzer · Saved Careers · Chat History ·
Admin Dashboard · Admin Careers (+ skills) · Admin Courses/Resources.

## 10. Notes for your viva / report
* Password reset: no SMTP is configured, so in development the reset token is returned by the API (production would email it).
* Course URLs are official landing pages. Run `python scripts/check_links.py` before your demo to re-verify them.
* Regenerate the SQL schema after model changes: `python scripts/gen_schema.py`.
