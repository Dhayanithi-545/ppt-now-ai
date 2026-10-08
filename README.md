<p align="center">
  <img src="frontend/public/logo.png" alt="PPT Now logo" width="96" />
</p>

<h1 align="center">Aira · PPT Now</h1>

<p align="center"><b>AI presentations that look designed, ready in a minute.</b></p>

Aira turns a topic, a few notes or a whole document into a polished, editable slide deck. It plans the story, writes every slide with **Gemini 2.5 Flash (Vertex AI)** and lays the deck out on a hand-built design system that looks like a professional template marketplace. You then refine anything with a click or a sentence, present it full screen, and download an editable PowerPoint or a pixel-perfect PDF.

## Features

- **Prompt to deck in seconds.** Describe your topic. Aira asks clarifying questions only when it needs them, then proposes an outline you can edit, reorder and approve before generating.
- **Live generation.** Slides stream in one by one as they are written; a 12-slide deck takes about 10 seconds.
- **Designer-grade layouts.** 12 premium themes and 31 layouts:
  - covers, agendas, big statements and big-number stats
  - KPI cards, icon grids, timelines and process steps
  - comparisons, charts, tables, quotes, team and pricing
  - problem/solution, TAM/SAM/SOM and SWOT
- **Your own style.** Describe a look ("minimal Japanese aesthetic, muted earth tones") and get a matching theme. Colors are checked against WCAG contrast rules automatically.
- **Edit like a design tool:**
  - click any text to edit it
  - switch the theme or layout instantly
  - duplicate, delete or drag slides
  - regenerate a slide or swap its image
  - undo and redo; version history is saved automatically
- **Chat edits.** "Make slide 4 more visual", "add a slide about risks after slide 6", "make the tone more formal".
- **Web research (optional).** Uses Google Search grounding for current facts and figures.
- **Smart auto-fit.** Overflowing text is detected in the browser and rewritten shorter by the AI.
- **Export:**
  - **PowerPoint:** fully editable text, native charts and tables, speaker notes
  - **PDF:** identical to the preview
- **Works everywhere.** A responsive app for desktop and mobile, with light and dark modes and a presenter mode.

## How it works

```
browser ──► frontend (React) ──/api──► backend (FastAPI) ──► Gemini 2.5 Flash on Vertex AI
             design system · editor        outline · slides (SSE) · chat edits · themes
             PPTX export (in browser)      images · SQLite · PDF (headless Chromium)
```

- **Design:** HTML/CSS is the source of truth. Gemini only writes structured JSON (content for a chosen layout); it never writes HTML or CSS.
- **Rendering:** the same React components render the live editor, the PDF and the PowerPoint export.
- **Reliability:** every slide is validated, retried, and given a simpler layout if needed, so one bad slide never breaks a deck.

## Tech stack

| Part | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Zustand, ECharts, PptxGenJS, html-to-image, Lucide icons, self-hosted Google Fonts |
| Backend | Python, FastAPI, google-genai (Vertex AI Gemini 2.5 Flash), Pydantic, SQLite, Playwright (PDF) |
| Tests | pytest, Vitest, Playwright end-to-end and visual QA |
| Deploy | Docker images for frontend (nginx) and backend; `docker-compose.yml` |

## Repository layout (`dev` branch)

```
frontend/   web app: design system, create flow, editor, PPTX export    → frontend/README.md
backend/    API: Gemini pipeline, streaming, storage, images, PDF        → backend/README.md
tests/      backend + frontend unit tests, end-to-end and visual QA      → tests/README.md
docker-compose.yml
```

## Quick start (local)

Requirements: Python 3.11+, Node 20+, and a Google Cloud service account with Vertex AI access.

```powershell
# backend
cd backend
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python -m playwright install chromium
copy .env.example .env          # set GOOGLE_APPLICATION_CREDENTIALS and GCP_PROJECT
.venv\Scripts\python -m uvicorn app.main:app --port 8000

# frontend (second terminal)
cd frontend
copy .env.example .env
npm install
npm run dev                     # http://localhost:5173
```

## Deploy

```powershell
$env:GCP_KEY_FILE="D:\path\to\service-account.json"
docker compose up --build       # http://localhost:8080
```

See `backend/README.md` and `frontend/README.md` for configuration, the API reference and production notes.
