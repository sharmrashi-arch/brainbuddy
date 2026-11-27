# BrainBuddy

AI assistant for every kind of question — studies, work, writing, maths, translation, photos, presentations, and more. Answers in the student's own language (100+ languages, auto-detect). Built on free/official sources with sources shown.

## Features
- **Streaming chat** (ChatGPT-style, live typing, Stop button)
- **Markdown + KaTeX maths** rendering (marked + DOMPurify + KaTeX)
- **43 languages + Auto-detect** (Hinglish aware)
- **Image understanding** — upload a photo, ask "yeh kya hai?" / solve a question in it
- **File upload** — text/markdown/csv/json + PDF (text extraction), "chat with your file"
- **Question-PDF solver** — answers every question in an uploaded paper
- **Quiz, Flashcards, Study Plan** generators
- **Document generators** — downloadable PDF, Word (.docx), PowerPoint (.pptx)
- **Voice** — mic input (Whisper) + read-aloud (Web Speech API)
- **Per-session chat history** (SQLite) with rename/delete
- **PWA** — installable, dark mode, responsive (phone/tablet/laptop)
- **Safety** — prompt-injection defence, uploaded text treated as data, rate limiting

## Tech stack
- **Backend:** Python 3.11+, FastAPI, uvicorn, pydantic, slowapi (rate limit), PyMuPDF optional + pypdf (PDF text), reportlab (PDF out), python-docx, python-pptx, Pillow, langdetect
- **LLM:** Groq (`openai/gpt-oss-120b` main, `openai/gpt-oss-20b` fast, `qwen/qwen3.8-27b` vision, `whisper-large-v3-turbo` voice)
- **Search:** SerpAPI (official sites only) with 7-day SQLite cache
- **RAG (optional):** ChromaDB + sentence-transformers over official NCERT/CBSE/HBSE PDFs
- **Frontend:** plain HTML + CSS + JS (no build step), served by FastAPI

## Run (Windows PowerShell)
```powershell
cd C:\Users\pc\Downloads\Mystudydost
py -3.14 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
# .env me GROQ_API_KEY, SERP_API_KEY aur model names bharo (kabhi commit mat karo)
# Optional real Google login: GOOGLE_CLIENT_ID (Google Cloud Console -> OAuth client ID)
python scripts/make_icons.py        # optional: (re)generate icons + OG image
uvicorn backend.main:app --reload
```
Open: http://127.0.0.1:8000

> **Keys** sirf `.env` me. `.env` gitignored hai. Model names bhi `.env` se aate hain, isliye account ke hisaab se badal sakte ho.

## API endpoints
| Method | Path | Kaam |
|---|---|---|
| GET | `/health`, `/api/health` | status + groq ready |
| GET | `/api/languages` | 43 languages list |
| GET | `/api/config` | public config + privacy note |
| GET | `/api/catalog` | boards/classes catalog |
| GET/POST/PUT/DELETE | `/api/chats` | per-session chat history |
| POST | `/api/upload` | file/image/PDF upload (text extract) |
| POST | `/api/vision` | image samjho / question solve |
| POST | `/api/transcribe` | mic audio -> text (Whisper) |
| POST | `/api/chat` | poora jawab (non-stream) |
| POST | `/api/chat/stream` | **SSE streaming** jawab |
| POST | `/api/quiz` | MCQ quiz |
| POST | `/api/flashcards` | flashcards |
| POST | `/api/study-plan` | din-ba-din plan |
| POST | `/api/solve-pdf` | question paper ke answers |
| POST | `/api/generate` | PDF / Word / PPT banao |
| GET | `/downloads/{id}` | generated file download |

## Data pipeline (optional RAG)
1. `python scripts/download_data.py` — official sources se PDFs download (`data/sources.json`)
2. `python scripts/ingest.py` — PyMuPDF chunking + ChromaDB (`db/`)
3. `data/catalog.json` — boards/classes/courses dropdown data

## Security
- Keys sirf backend `.env` me; browser ko nahi jaate
- CORS sirf apne domain(s) par; rate limit `30/min/IP`
- Uploaded file/web text ko `<<<UNTRUSTED_...>>>` me wrap karke DATA ki tarah treat kiya jaata hai
- Har jawab ke saath source dikhaya jaata hai; unknown info invent nahi ki jaati

## Folder structure
```
backend/   config llm prompts rag router safety languages vision files voice generate study_tools history main
frontend/  index.html app.css app.js i18n.js manifest.webmanifest sw.js assets/
scripts/   download_data.py ingest.py make_icons.py
data/      sources.json catalog.json raw/
db/        history.sqlite3 cache.sqlite3 chroma (optional)
tests/     test_smoke.py
docs/      BrainBuddy_v2_Kilo_Prompt.md
```

## Note
BrainBuddy galti kar sakta hai. Zaroori baat ek baar jaanch lijiye.

## Live deploy (Render)
1. Code GitHub par push karo (ye repo: `sharmrashi-arch/brainbuddy`).
2. [render.com](https://render.com) par account banao → **New → Blueprint** → ye repo select karo (`render.yaml` auto-detect hoga).
3. Env vars bharo (dashboard me): `GROQ_API_KEY`, `SERP_API_KEY`, `GOOGLE_CLIENT_ID` (optional), `GOOGLE_CLIENT_SECRET` (optional).
4. Google Cloud Console me OAuth client ke **Authorized JavaScript origins** me apna Render URL daalo (e.g. `https://brainbuddy.onrender.com`).
5. Deploy → live URL milega (e.g. `https://brainbuddy.onrender.com`).

> Free plan par restart/spin-down par chat history reset ho sakti hai. Persistent history ke liye paid plan + disk (`render.yaml` me `disk` block) use karo.