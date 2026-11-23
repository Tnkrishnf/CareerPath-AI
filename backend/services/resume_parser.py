"""Resume analysis: PDF validation, text extraction and rule-based skill/education extraction."""
from __future__ import annotations

import io
import re

from pypdf import PdfReader
from pypdf.errors import PyPdfError

from services.recommender import LEVEL_NAMES

ALIASES = {
    "JavaScript": ["javascript", "js", "es6"], "TypeScript": ["typescript"], "Node.js": ["node.js", "nodejs", "node js"],
    "React": ["react", "react.js", "reactjs"], "Machine Learning": ["machine learning", "ml"],
    "Deep Learning": ["deep learning", "neural networks", "cnn"], "Scikit-learn": ["scikit-learn", "sklearn", "scikit learn"],
    "NLP": ["nlp", "natural language processing"], "C++": ["c++"], "Python": ["python"], "Java": ["java"],
    "SQL": ["sql"], "MySQL": ["mysql"], "MongoDB": ["mongodb", "mongo db"], "HTML": ["html", "html5"], "CSS": ["css", "css3"],
    "REST APIs": ["rest api", "rest apis", "restful", "rest"], "Git": ["git", "github", "gitlab"],
    "Docker": ["docker"], "Kubernetes": ["kubernetes", "k8s"], "AWS": ["aws", "amazon web services", "ec2", "s3"],
    "CI/CD": ["ci/cd", "ci cd", "jenkins", "github actions"], "Linux": ["linux", "ubuntu", "bash"],
    "Pandas": ["pandas"], "NumPy": ["numpy"], "Statistics": ["statistics", "statistical"], "Excel": ["excel", "spreadsheets"],
    "Power BI": ["power bi", "powerbi"], "Data Visualization": ["data visualization", "data visualisation", "matplotlib", "seaborn", "tableau"],
    "PyTorch": ["pytorch"], "Flask": ["flask"], "Data Structures": ["data structures", "dsa"], "Algorithms": ["algorithms"],
    "OOP": ["oop", "object oriented", "object-oriented"], "Operating Systems": ["operating systems"],
    "Computer Networks": ["computer networks", "networking", "tcp/ip"], "System Design": ["system design"],
    "Cybersecurity Fundamentals": ["cybersecurity", "cyber security", "information security"],
    "Network Security": ["network security", "firewall"], "Penetration Testing": ["penetration testing", "pentest", "ethical hacking"],
    "Cryptography": ["cryptography", "encryption"], "UI/UX Design": ["ui/ux", "ux design", "ui design", "user experience"],
    "Figma": ["figma"], "Prototyping": ["prototyping", "wireframe", "wireframes"], "Software Testing": ["software testing", "manual testing", "qa"],
    "Selenium": ["selenium"], "Test Automation": ["test automation", "automation testing"],
    "Android Development": ["android"], "Kotlin": ["kotlin"], "Flutter": ["flutter"], "Responsive Design": ["responsive design", "responsive"],
    "Database Design": ["database design", "normalization", "normalisation", "er diagram"],
    "Communication": ["communication", "presentation", "teamwork"], "Problem Solving": ["problem solving", "problem-solving"],
}
EDU_PATTERNS = [
    (r"\bph\.?\s?d\b|\bdoctorate\b", "PhD"), (r"\bm\.?\s?tech\b", "M.Tech"), (r"\bm\.?\s?sc\b|master of science", "M.Sc"),
    (r"\bmca\b", "MCA"), (r"\bmba\b", "MBA"), (r"\bm\.?\s?e\b\.?(?=\s|,)", "M.E"),
    (r"\bb\.?\s?tech\b", "B.Tech"), (r"\bb\.?\s?e\b\.?(?=\s|,)", "B.E"), (r"\bb\.?\s?sc\b|bachelor of science", "B.Sc"),
    (r"\bbca\b", "BCA"), (r"\bb\.?\s?com\b", "B.Com"), (r"\bbachelor", "Bachelor's degree"), (r"\bmaster", "Master's degree"),
    (r"\bdiploma\b", "Diploma"), (r"\bhsc\b|\b12th\b|higher secondary|intermediate", "Higher secondary (12th)"),
    (r"\bssc\b|\b10th\b", "Secondary (10th)"),
]
SECTIONS = {"summary": r"\b(summary|objective|profile)\b", "projects": r"\bprojects?\b",
            "experience": r"\b(experience|internship|work history)\b", "education": r"\beducation\b",
            "certifications": r"\bcertifications?\b|\bcertificates?\b", "skills": r"\bskills\b"}


class ResumeError(ValueError):
    pass


def validate_pdf(filename: str, data: bytes, max_pages: int) -> PdfReader:
    if not filename or not filename.lower().endswith(".pdf"):
        raise ResumeError("Only PDF files are accepted.")
    if not data:
        raise ResumeError("The uploaded file is empty.")
    if not data.startswith(b"%PDF"):
        raise ResumeError("The file content is not a valid PDF.")
    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            raise ResumeError("Encrypted PDFs are not supported.")
        if len(reader.pages) > max_pages:
            raise ResumeError(f"Resume is too long ({len(reader.pages)} pages). Maximum is {max_pages}.")
        return reader
    except PyPdfError as exc:
        raise ResumeError("The PDF could not be read.") from exc


def extract_text(reader: PdfReader) -> str:
    return "\n".join((page.extract_text() or "") for page in reader.pages)


def _find_skills(text: str, valid_skills: set[str]) -> list[str]:
    low = text.lower()
    found = []
    for skill, aliases in ALIASES.items():
        if valid_skills and skill not in valid_skills:
            continue
        for a in aliases:
            pattern = r"(?<![A-Za-z0-9+#])" + re.escape(a) + r"(?![A-Za-z0-9+#])"
            if re.search(pattern, low):
                found.append(skill)
                break
    return sorted(found)


def analyze(text: str, valid_skills: set[str], careers: list[dict], target_career_id: int | None = None) -> dict:
    skills = _find_skills(text, valid_skills)
    low = text.lower()
    education = sorted({label for pat, label in EDU_PATTERNS if re.search(pat, low)})
    sections = {name: bool(re.search(pat, low)) for name, pat in SECTIONS.items()}

    # Career keywords present in the resume (from each career's keyword profile)
    kw = sorted({k for c in careers for k in c["interest_keywords"] if len(k) > 3 and k.lower() in low})

    # Rank careers by simple skill overlap so we can suggest a target if none selected
    def coverage(c):
        total = len(c["skills"]) or 1
        return sum(1 for s in c["skills"] if s in skills) / total
    ranked = sorted(careers, key=lambda c: (-coverage(c), c["title"]))
    target = next((c for c in careers if c["id"] == target_career_id), None) or (ranked[0] if ranked else None)

    missing, career_suggestions = [], []
    if target:
        missing = [{"skill": s, "required_level": LEVEL_NAMES[l]} for s, l in sorted(target["skills"].items(), key=lambda kv: -kv[1])
                   if s not in skills]
        career_suggestions.append(f"For {target['title']}, your resume already shows {len(target['skills']) - len(missing)} of "
                                  f"{len(target['skills'])} core skills.")
        for m in missing[:4]:
            career_suggestions.append(f"Add or build evidence of {m['skill']} (expected at {m['required_level']} level) through a project or course, "
                                      "and list it only when you can discuss it.")

    general = []
    words = len(text.split())
    if words < 150:
        general.append("The extracted text is very short. If your resume is a scanned image, export a text-based PDF.")
    if not sections["summary"]:
        general.append("Add a two- or three-line professional summary at the top.")
    if not sections["projects"]:
        general.append("Add a Projects section: for each project name the technologies and what you built.")
    if not sections["experience"]:
        general.append("Include internships, training or volunteer work, even if short.")
    if not sections["certifications"]:
        general.append("List relevant certifications or completed online courses.")
    if not re.search(r"github\.com|linkedin\.com", low):
        general.append("Add links to your GitHub and LinkedIn profiles.")
    if len(skills) < 5:
        general.append("Few technical skills were detected; make sure your skills section lists tools by name.")
    if words > 900:
        general.append("The resume is long; aim for one page for fresher roles.")

    return {"skills": skills, "education": education, "keywords": kw, "sections_found": sections,
            "target_career": {"id": target["id"], "title": target["title"]} if target else None,
            "best_matching_careers": [{"id": c["id"], "title": c["title"], "skill_coverage_percent": round(100 * coverage(c), 1)} for c in ranked[:3]],
            "missing_skills": missing, "career_suggestions": career_suggestions, "general_suggestions": general,
            "word_count": words}
