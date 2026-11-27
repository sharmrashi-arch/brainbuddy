import base64
import io
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, File, Header, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

try:
    from .config import (
        APP_NAME, APP_ENV, BASE_DIR, CATALOG_PATH, MAX_QUESTION_LENGTH,
        MAX_UPLOAD_MB, MAX_FILE_TEXT, MAX_PDF_PAGES, TMP_DIR, PRIVACY_NOTE,
        CORS_ORIGINS, RATE_LIMIT_PER_MINUTE, DOWNLOAD_TTL_SECONDS, GOOGLE_CLIENT_ID,
    )
    from .rag import answer_question, answer_stream, generate_quiz, solve_pdf_text
    from .vision import describe_images, prepare_image
    from .voice import transcribe
    from .study_tools import flashcards, study_plan
    from . import generate as gen
    from . import history
    from . import files as file_utils
    from .languages import list_languages, get_language, detect_language
    from .llm import has_groq, generate_answer
    from .router import decide_mode, short_title
    from .safety import check_message
except ImportError:
    from config import (
        APP_NAME, APP_ENV, BASE_DIR, CATALOG_PATH, MAX_QUESTION_LENGTH,
        MAX_UPLOAD_MB, MAX_FILE_TEXT, MAX_PDF_PAGES, TMP_DIR, PRIVACY_NOTE,
        CORS_ORIGINS, RATE_LIMIT_PER_MINUTE, DOWNLOAD_TTL_SECONDS, GOOGLE_CLIENT_ID,
    )
    from rag import answer_question, answer_stream, generate_quiz, solve_pdf_text
    from vision import describe_images, prepare_image
    from voice import transcribe
    from study_tools import flashcards, study_plan
    import generate as gen
    import history
    import files as file_utils
    from languages import list_languages, get_language, detect_language
    from llm import has_groq, generate_answer
    from router import decide_mode, short_title
    from safety import check_message

FRONTEND_DIR = BASE_DIR / "frontend"

app = FastAPI(title=APP_NAME, version="0.3.0")
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _session_id(x_session_id: str = Header(default="")):
    return (x_session_id or "local").strip()[:64]


def _now():
    return datetime.now(timezone.utc).isoformat()


def _extract_pdf_text(raw, max_pages=MAX_PDF_PAGES):
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(raw))
        parts, total = [], 0
        for i, page in enumerate(reader.pages[:max_pages]):
            try:
                t = page.extract_text() or ""
            except Exception:
                t = ""
            parts.append(t)
            total += len(t)
            if total > MAX_FILE_TEXT * 4:
                break
        return "\n".join(parts)[: MAX_FILE_TEXT * 4]
    except Exception:
        return ""


# --------------------------------------------------------------------------- #
# Models
# --------------------------------------------------------------------------- #
class Attachment(BaseModel):
    name: str = ""
    kind: str = ""       # "text" | "image"
    data: str = ""       # data URL for images
    text: str = ""


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=MAX_QUESTION_LENGTH)
    board: str = ""
    klass: str = Field(default="", alias="class")
    subject: str = ""
    language: str = "en"
    level: str = "normal"
    mode: str = ""
    chapter: str = ""
    attachments: list[Attachment] = Field(default_factory=list)

    model_config = {"populate_by_name": True}


class QuizRequest(BaseModel):
    topic: str = ""
    board: str = ""
    klass: str = Field(default="", alias="class")
    subject: str = ""
    language: str = "en"
    chapter: str = ""
    count: int = 5
    difficulty: str = "medium"

    model_config = {"populate_by_name": True}


class FlashcardsRequest(BaseModel):
    topic: str = ""
    board: str = ""
    klass: str = Field(default="", alias="class")
    subject: str = ""
    language: str = "en"
    count: int = 10

    model_config = {"populate_by_name": True}


class StudyPlanRequest(BaseModel):
    subjects: str = ""
    days_left: int = 30
    hours_per_day: int = 2
    language: str = "en"


class GenerateRequest(BaseModel):
    type: str = "pdf"                # pdf | docx | pptx
    text: str = ""
    topic: str = ""
    title: str = ""
    language: str = "en"
    slides: int = 8


class SolveRequest(BaseModel):
    text: str = ""
    language: str = "en"


class VisionRequest(BaseModel):
    question: str = ""
    image: str = ""                  # data URL
    language: str = "en"


class GoogleAuthRequest(BaseModel):
    credential: str = ""             # Google ID token (JWT) from GIS


class ChatCreate(BaseModel):
    title: str = "New Chat"
    board: str = ""
    klass: str = Field(default="", alias="class")
    subject: str = ""
    language: str = "en"
    messages: list = Field(default_factory=list)

    model_config = {"populate_by_name": True}


class ChatUpdate(BaseModel):
    title: str | None = None
    messages: list | None = None
    board: str | None = None
    klass: str | None = None
    subject: str | None = None
    language: str | None = None


# --------------------------------------------------------------------------- #
# Meta endpoints
# --------------------------------------------------------------------------- #
@app.get("/health")
@app.get("/api/health")
def health():
    return {"status": "ok", "app": APP_NAME, "env": APP_ENV, "groq": has_groq()}


@app.get("/api/languages")
def api_languages():
    return {"languages": list_languages()}


@app.get("/api/config")
def api_config():
    return {
        "app": APP_NAME,
        "env": APP_ENV,
        "groqReady": has_groq(),
        "googleClientId": GOOGLE_CLIENT_ID,
        "privacy": PRIVACY_NOTE,
    }


@app.post("/auth/google")
def google_auth(req: GoogleAuthRequest):
    """Verify a Google ID token (from Google Identity Services) and return the profile."""
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=400, detail="Google login not configured (set GOOGLE_CLIENT_ID)")
    if not req.credential:
        raise HTTPException(status_code=400, detail="Missing credential")
    try:
        from google.oauth2 import id_token
        from google.auth.transport import requests as grequests
        info = id_token.verify_oauth2_token(req.credential, grequests.Request(), GOOGLE_CLIENT_ID)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid Google token")
    email = info.get("email") or ""
    return {
        "name": info.get("name") or (email.split("@")[0] if email else "User"),
        "email": email,
        "picture": info.get("picture"),
    }


@app.get("/api/catalog")
def get_catalog():
    if CATALOG_PATH.exists():
        with open(CATALOG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"boards": [], "note": "catalog.json not found"}


# --------------------------------------------------------------------------- #
# Chat history (scoped per session id sent by the client)
# --------------------------------------------------------------------------- #
@app.get("/api/chats")
def list_chats(x_session_id: str = Header(default="")):
    return history.list_chats(_session_id(x_session_id))


@app.get("/api/chats/{chat_id}")
def get_chat(chat_id: str, x_session_id: str = Header(default="")):
    chat = history.get_chat(_session_id(x_session_id), chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    return chat


@app.post("/api/chats")
def create_chat(chat: ChatCreate, x_session_id: str = Header(default="")):
    return history.create_chat(_session_id(x_session_id), chat.model_dump())


@app.put("/api/chats/{chat_id}")
def update_chat(chat_id: str, update: ChatUpdate, x_session_id: str = Header(default="")):
    updated = history.update_chat(_session_id(x_session_id), chat_id, update.model_dump(exclude_none=True))
    if not updated:
        raise HTTPException(status_code=404, detail="Chat not found")
    return updated


@app.delete("/api/chats/{chat_id}")
def delete_chat(chat_id: str, x_session_id: str = Header(default="")):
    history.delete_chat(_session_id(x_session_id), chat_id)
    return {"status": "deleted"}


# --------------------------------------------------------------------------- #
# Uploads / vision / voice
# --------------------------------------------------------------------------- #
@app.post("/api/upload")
async def upload(request: Request, file: UploadFile = File(...)):
    name = (file.filename or "file").strip() or "file"
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""

    raw = b""
    while True:
        chunk = await file.read(1024 * 1024)
        if not chunk:
            break
        raw += chunk
        if len(raw) > MAX_UPLOAD_MB * 1024 * 1024:
            raise HTTPException(status_code=413, detail="File %dMB se badi hai" % MAX_UPLOAD_MB)

    image_exts = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "webp": "image/webp", "gif": "image/gif"}
    text_exts = {"txt", "md", "csv", "json", "log"}

    if ext in image_exts:
        mime = image_exts[ext]
        return {"name": name, "kind": "image", "data": "data:%s;base64,%s" % (mime, base64.b64encode(raw).decode()), "size": len(raw)}

    if ext in text_exts:
        text = raw.decode("utf-8", errors="replace")[:MAX_FILE_TEXT]
        return {"name": name, "kind": "text", "text": text, "size": len(raw)}

    if ext == "pdf":
        text = _extract_pdf_text(raw)
        if not text.strip():
            raise HTTPException(status_code=400, detail="PDF se text nahi mila (scanned/image PDF abhi support nahi)")
        return {"name": name, "kind": "text", "text": text[:MAX_FILE_TEXT], "size": len(raw)}

    raise HTTPException(status_code=415, detail="Unsupported file type — image, .txt/.md/.csv ya PDF bhejein")


@app.post("/api/vision")
@limiter.limit("%d/minute" % RATE_LIMIT_PER_MINUTE)
async def vision(request: Request, req: VisionRequest):
    if not req.image:
        raise HTTPException(status_code=400, detail="image chahiye")
    if not has_groq():
        return {"answer": "Demo mode: GROQ_API_KEY set karo, tab image samjha paunga.", "mode": "demo"}
    try:
        answer = describe_images([req.image], req.question, req.language)
    except Exception as e:
        raise HTTPException(status_code=400, detail="Image process nahi hui: %s" % e)
    return {"answer": answer, "mode": "vision"}


@app.post("/api/transcribe")
@limiter.limit("%d/minute" % RATE_LIMIT_PER_MINUTE)
async def transcribe_audio(request: Request, file: UploadFile = File(...)):
    if not has_groq():
        return {"text": "", "mode": "demo", "note": "GROQ_API_KEY set karo for mic input"}
    raw = await file.read()
    if len(raw) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Audio 25MB se badi hai")
    try:
        text = transcribe(raw, file.filename or "audio.webm")
    except Exception as e:
        raise HTTPException(status_code=400, detail="Transcribe fail: %s" % e)
    return {"text": text, "mode": "whisper"}


# --------------------------------------------------------------------------- #
# Chat (non-streaming + SSE streaming)
# --------------------------------------------------------------------------- #
def _build_chat_question(req: ChatRequest):
    bits = [req.board, req.klass, req.subject, req.chapter, req.question]
    question = " | ".join([b for b in bits if b]).strip()
    for a in (req.attachments or []):
        if a.kind == "text" and a.text:
            question += "\n\n[File: %s]\n%s" % (a.name or "file", a.text)
    return question, [a.data for a in (req.attachments or []) if a.kind == "image" and a.data.startswith("data:image/")]


@app.post("/api/chat")
@limiter.limit("%d/minute" % RATE_LIMIT_PER_MINUTE)
def chat(request: Request, req: ChatRequest):
    ok, reason = check_message(req.question)
    if not ok:
        return {"answer": reason, "sources": [], "mode": "blocked"}
    question, images = _build_chat_question(req)
    mode = req.mode or decide_mode(question, has_images=bool(images))
    result = answer_question(
        question=question or req.question,
        board=req.board, klass=req.klass, subject=req.subject,
        language=req.language, images=images or None, mode=mode, level=req.level,
    )
    return {"answer": result.get("answer", ""), "sources": result.get("sources", []), "mode": result.get("mode", "unknown")}


@app.post("/api/chat/stream")
@limiter.limit("%d/minute" % RATE_LIMIT_PER_MINUTE)
def chat_stream(request: Request, req: ChatRequest):
    ok, reason = check_message(req.question)
    question, images = _build_chat_question(req)
    mode = req.mode or decide_mode(question, has_images=bool(images))

    def gen_events():
        if not ok:
            yield "data: " + json.dumps({"event": "delta", "text": reason}, ensure_ascii=False) + "\n\n"
            yield "data: " + json.dumps({"event": "done", "sources": [], "mode": "blocked"}, ensure_ascii=False) + "\n\n"
            return
        if images:
            result = answer_question(question=question or req.question, board=req.board, klass=req.klass,
                                     subject=req.subject, language=req.language, images=images, mode="vision", level=req.level)
            yield "data: " + json.dumps({"event": "delta", "text": result.get("answer", "")}, ensure_ascii=False) + "\n\n"
            yield "data: " + json.dumps({"event": "done", "sources": result.get("sources", []), "mode": result.get("mode", "vision")}, ensure_ascii=False) + "\n\n"
            return
        for event, payload in answer_stream(question or req.question, req.board, req.klass, req.subject,
                                            req.language, mode, req.level):
            data = {"event": event}
            data.update(payload)
            yield "data: " + json.dumps(data, ensure_ascii=False) + "\n\n"

    return StreamingResponse(
        gen_events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# --------------------------------------------------------------------------- #
# Study tools
# --------------------------------------------------------------------------- #
@app.post("/api/quiz")
@limiter.limit("%d/minute" % RATE_LIMIT_PER_MINUTE)
def quiz(request: Request, req: QuizRequest):
    topic = req.topic or req.chapter or " ".join([p for p in [req.board, req.klass, req.subject] if p]).strip() or "study topic"
    result = generate_quiz(topic, req.board, req.klass, req.subject, req.language, count=req.count, difficulty=req.difficulty)
    return {"quiz": result.get("quiz", ""), "sources": result.get("sources", []), "mode": result.get("mode", "unknown")}


@app.post("/api/flashcards")
@limiter.limit("%d/minute" % RATE_LIMIT_PER_MINUTE)
def flashcards_ep(request: Request, req: FlashcardsRequest):
    result = flashcards(req.topic, req.board, req.klass, req.subject, req.language, count=req.count)
    return {"text": result.get("text", ""), "sources": result.get("sources", []), "mode": result.get("mode", "unknown")}


@app.post("/api/study-plan")
@limiter.limit("%d/minute" % RATE_LIMIT_PER_MINUTE)
def study_plan_ep(request: Request, req: StudyPlanRequest):
    result = study_plan(req.subjects, req.days_left, req.hours_per_day, req.language)
    return {"text": result.get("text", ""), "mode": result.get("mode", "unknown")}


@app.post("/api/solve-pdf")
@limiter.limit("%d/minute" % RATE_LIMIT_PER_MINUTE)
def solve_pdf(request: Request, req: SolveRequest):
    text = (req.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Question paper ka text chahiye")
    result = solve_pdf_text(text[: MAX_FILE_TEXT * 4], req.language)
    return {"answer": result.get("answer", ""), "mode": result.get("mode", "unknown")}


# --------------------------------------------------------------------------- #
# Document generation + download
# --------------------------------------------------------------------------- #
def _content_for_generation(req: GenerateRequest):
    if req.text and req.text.strip():
        return req.text.strip()
    if req.topic and has_groq():
        system = "You are a helpful study content writer. Produce clean, structured notes with a title and short paragraphs or bullet points. Do not invent fake citations."
        user = "Write study notes about: %s. Keep it clear and well structured." % req.topic
        try:
            return generate_answer([{"role": "system", "content": system}, {"role": "user", "content": user}], temperature=0.4, max_tokens=1200)
        except Exception:
            pass
    return "Topic: %s\n\n(Add more detail by connecting GROQ_API_KEY or sending your own text.)" % (req.topic or "Study Notes")


@app.post("/api/generate")
@limiter.limit("%d/minute" % RATE_LIMIT_PER_MINUTE)
def generate_doc(request: Request, req: GenerateRequest):
    kind = (req.type or "pdf").lower()
    if kind not in ("pdf", "docx", "pptx"):
        raise HTTPException(status_code=400, detail="type pdf|docx|pptx only")
    content = _content_for_generation(req)
    title = (req.title or req.topic or "BrainBuddy Notes").strip()
    suffix = "." + kind
    fid, path = file_utils.new_path(suffix)
    try:
        gen.generate(kind, content, title, path, slides=req.slides)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Generate fail: %s" % e)
    size = path.stat().st_size if path.exists() else 0
    return {
        "id": fid,
        "filename": "%s%s" % (fid[:8], suffix),
        "url": "/downloads/%s" % fid,
        "size": size,
        "type": kind,
    }


@app.get("/downloads/{file_id}")
def download(file_id: str):
    file_id = file_id.strip()
    if not file_id or "/" in file_id or "\\" in file_id or ".." in file_id:
        raise HTTPException(status_code=400, detail="Bad id")
    matches = list(TMP_DIR.glob(file_id + ".*")) if TMP_DIR.exists() else []
    if not matches:
        raise HTTPException(status_code=404, detail="File not found or expired")
    path = matches[0]
    return FileResponse(str(path), filename=path.name)


# --------------------------------------------------------------------------- #
# Frontend (mounted last so it never shadows /api routes)
# --------------------------------------------------------------------------- #
@app.get("/chat")
def chat_page():
    index_file = FRONTEND_DIR / "index.html"
    if index_file.exists():
        return FileResponse(str(index_file))
    return {"message": "Frontend not found."}


if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")