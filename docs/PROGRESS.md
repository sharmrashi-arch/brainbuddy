# BrainBuddy — Progress Checklist

Status key: `not done` · `working (proof)` · `broken` · `not tested`

| # | Feature | Status | Proof / Notes |
|---|---------|--------|---------------|
| 1 | Chat: live word-by-word answer + Stop button + friendly error | working (proof) | Playwright: text grew 0→12→46 chars live; Stop truncated 1107 vs full ~2500; failed req showed "Sorry, I couldn't answer right now..."; 0 console errors |
| 2 | Language selector + Auto mode (same language as input) | not tested | |
| 3 | Attach button: photo/PDF/text, chip + remove, sends with message | not tested | |
| 4 | Photo understanding (vision Groq model in .env) | working (proof) | `qwen/qwen3.8-27b` accepts images (real call read "FOX 42"); default in config.py fixed (llama-scout doesn't exist); Playwright: uploaded 2x+5=15 photo -> answered x=5, 0 errors |
| 5 | Question PDF: step-by-step answers in batches + download PDF | not tested | |
| 6 | Microphone: record -> text -> input, polite blocked message | not tested | |
| 7 | Listening: "Kya aap ise sunna chahte hain?" + always-speak setting | not tested | |
| 8 | Screen capture: screenshot as attachment + AI answers | not tested | |
| 9 | Chat history: id, sidebar, open, rename, delete, persists | not tested | |
| 10 | Settings: dark mode, language, answer level, voice (persist) | not tested | |
| 11 | File making: PDF/Word/PPT real download, Hindi in PDF correct | not tested | |
| 12 | Syllabus answers from saved books + source, or run-script msg | not tested | |
| 13 | Web search: SERP, 7-day cache, show source links | not tested | |
| 14 | Responsive: 360/390/768/1024/1440, no side scroll, tap targets | not tested | |
| 15 | Safety: .env in .gitignore, no keys in site files, upload text = data | not tested | |

## Session log
- Setup: git clean, server on :8000 (health ok, groq=true), PROGRESS.md created.
- Feature 1 (chat stream/stop/error): working, verified via Playwright.
- Feature 4 (vision): working, model fixed to qwen/qwen3.8-27b, verified.
- Bonus: read-aloud Stop button — code added (app.js/css/i18n), NOT fully tested yet (Playwright stub timing issue), needs re-test.
- Image generation: NOT possible via Groq (no image-gen model). Needs external API key. Paused.