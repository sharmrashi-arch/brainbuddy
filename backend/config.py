import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

APP_NAME = os.getenv("APP_NAME", "BrainBuddy")
APP_ENV = os.getenv("APP_ENV", "development")
PUBLIC_URL = os.getenv("PUBLIC_URL", "http://127.0.0.1:8000")

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
SERP_API_KEY = os.getenv("SERP_API_KEY", "")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")

# Read every model name from .env so they can be changed without touching code.
GROQ_MODEL = os.getenv("GROQ_MODEL_MAIN", os.getenv("GROQ_MODEL", "openai/gpt-oss-120b"))
GROQ_MODEL_FAST = os.getenv("GROQ_MODEL_FAST", "openai/gpt-oss-20b")
GROQ_MODEL_VISION = os.getenv("GROQ_MODEL_VISION", "qwen/qwen3.8-27b")
GROQ_MODEL_STT = os.getenv("GROQ_MODEL_STT", "whisper-large-v3-turbo")

DATA_DIR = Path(os.getenv("DATA_DIR", str(BASE_DIR / "data")))
RAW_DATA_DIR = DATA_DIR / "raw"
CATALOG_PATH = DATA_DIR / "catalog.json"
SOURCES_PATH = DATA_DIR / "sources.json"

DB_DIR = Path(os.getenv("DB_DIR", str(BASE_DIR / "db")))
CACHE_DB_PATH = DB_DIR / "cache.sqlite3"
HISTORY_DB_PATH = DB_DIR / "history.sqlite3"
TMP_DIR = Path(os.getenv("TMP_DIR", str(BASE_DIR / "tmp")))

RETRIEVAL_TOP_K = 5
DISTANCE_THRESHOLD = 1.2
SERP_CACHE_DAYS = 7
RATE_LIMIT_PER_MINUTE = int(os.getenv("RATE_LIMIT_PER_MINUTE", "30"))
MAX_QUESTION_LENGTH = 20000

MAX_IMAGE_MB = 8
MAX_UPLOAD_MB = 15
MAX_FILE_TEXT = 8000
MAX_PDF_PAGES = 30
DOWNLOAD_TTL_SECONDS = 3600

# CORS: explicit origins only (never "*" together with credentials).
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", PUBLIC_URL).split(",") if o.strip()]
if APP_ENV == "development":
    for extra in ("http://127.0.0.1:8000", "http://localhost:8000", "http://127.0.0.1:5500", "http://localhost:5500"):
        if extra not in CORS_ORIGINS:
            CORS_ORIGINS.append(extra)

ALLOWED_SITE_HINTS = [
    "ncert.nic.in",
    "cbseacademic.nic.in",
    "cbse.gov.in",
    "bseh.org.in",
    "nios.ac.in",
    "ignou.ac.in",
    "epathshala.nic.in",
    "diksha.gov.in",
    "swayam.gov.in",
    "ugc.ac.in",
    "aicte.gov.in",
    "nptel.ac.in",
    "kuk.ac.in",
    "mdu.ac.in",
    "du.ac.in",
    "nta.nic.in",
]

PRIVACY_NOTE = "BrainBuddy galti kar sakta hai. Zaroori baat ek baar jaanch lijiye. Aapki keys kabhi browser ko nahi bheji jaati."