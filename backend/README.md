# Aira backend (FastAPI)

The API behind Aira. It does the following:
- turns a prompt into an outline and slide content with **Gemini 2.5 Flash on Vertex AI** (JSON only, one schema per layout)
- streams generated slides over SSE
- applies chat edits
- creates themes from a style prompt
- finds, caches and uploads images
- stores decks and versions in SQLite
- prints PDFs with headless Chromium

The backend never renders slides itself. PDF export opens the frontend's `/print/{id}` page.

## Structure

```
backend/
├── app/
│   ├── main.py            HTTP routes (FastAPI app)
│   ├── config.py          settings from backend/.env
│   ├── db.py              SQLite: decks, versions, custom themes
│   ├── schemas.py         request models + Gemini schemas (clarify, outline, chat edits)
│   ├── spec/              layouts.json (31 layouts, field limits) · design.json (fonts, enums, icons, themes)
│   └── services/
│       ├── llm.py         Vertex client, retry/backoff, JSON + grounded text calls
│       ├── pipeline.py    clarify → research → outline → parallel slides → auto-fit → chat edits
│       ├── layouts.py     per-layout Gemini schemas + sanitising of model output
│       ├── themes.py      theme tokens from a prompt + WCAG contrast validation
│       ├── images.py      stock photos → Imagen → none (frontend draws an illustration)
│       ├── capabilities.py  detects grounding / image generation / stock keys at startup
│       └── export_pdf.py  Playwright PDF of the frontend print route
├── data/                  runtime: aira.db + media/ (git-ignored)
├── requirements.txt
├── Dockerfile
└── .env.example
```

`app/spec/*.json` is also copied in `frontend/src/design/`. If you change one, copy it to the other; `tests/backend/test_spec_sync.py` fails when they differ.

## Run locally (Windows)

```powershell
cd backend
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python -m playwright install chromium      # PDF export
copy .env.example .env                                     # then edit: key path + project
.venv\Scripts\python -m uvicorn app.main:app --port 8000 --reload
```

- API docs: <http://localhost:8000/docs>
- Health check: <http://localhost:8000/health>
- Run the frontend dev server (`frontend/`, port 5173) for the UI and for PDF export.

## Configuration (`backend/.env`)

| Key | Required | Default | Purpose |
|---|---|---|---|
| `GOOGLE_APPLICATION_CREDENTIALS` | yes, locally | – | Service-account JSON path. Leave unset on GCP to use ADC. |
| `GCP_PROJECT`, `GCP_LOCATION`, `GEMINI_MODEL` | yes | `ticm-qa`, `global`, `gemini-2.5-flash` | Vertex AI project, region and model. |
| `FRONTEND_URL` | yes for PDF | `http://localhost:5173` | Public URL of the frontend; PDF export opens `{FRONTEND_URL}/print/{id}`. |
| `CORS_ORIGINS` | if cross-origin | `http://localhost:5173` | Comma-separated browser origins allowed to call the API directly. |
| `FRONTEND_DIST_DIR` | no | – | Serve a built frontend from this process (single-server setups). |
| `UNSPLASH_ACCESS_KEY` / `PEXELS_API_KEY` | no | – | Stock photos and photo search. |
| `IMAGE_MODEL`, `IMAGE_LOCATION`, `ENABLE_IMAGE_GENERATION` | no | `imagen-4.0-fast-generate-001`, `us-central1`, `true` | Image generation (auto-detected). |
| `ENABLE_GROUNDING` | no | `true` | Google Search grounding for "web research" (auto-detected). |
| `MAX_CONCURRENT_LLM`, `SLIDE_CONCURRENCY` | no | `16`, `6` | Gemini parallelism per instance / per deck. |
| `DATA_DIR`, `MAX_VERSIONS_PER_DECK`, `MAX_PROMPT_CHARS` | no | `backend/data`, `50`, `8000` | Storage and limits. |

Optional services are probed once at startup and reported by `GET /api/capabilities`. When one is missing, its feature switches off and generation continues.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/health`, `/api/capabilities` | Liveness; optional-service availability |
| POST | `/api/decks/clarify` | Questions to ask when a prompt is vague |
| POST | `/api/decks/outline` | Create a deck + outline (web research first if requested) |
| POST | `/api/decks/{id}/generate` | **SSE**: `start`, then one `slide` event per finished slide (again when its image arrives), then `done` |
| GET / PATCH / DELETE | `/api/decks/{id}` | Load / save edits (each save creates a version) / delete |
| GET | `/api/decks`, `/api/decks/{id}/versions[/{vid}]` | Recent decks; version history |
| POST | `/api/decks/{id}/chat-edit` | Natural-language edit → structured operations applied to the deck |
| POST | `/api/decks/{id}/slides/{n}/regenerate` | Rewrite one slide (optional instruction / layout) |
| POST | `/api/decks/{id}/slides/{n}/fit` | Shorter rewrite of a slide the browser measured as overflowing |
| POST | `/api/decks/{id}/export/pdf` | PDF download (`filename` chosen by the user) |
| POST / GET / DELETE | `/api/themes/from-prompt`, `/api/themes[/{id}]` | Custom themes (tokens only, contrast-validated) |
| GET / POST | `/api/images/search`, `/api/images/select`, `/api/images/generate`, `/api/images/upload` | Image picker |
| GET | `/media/{file}` | Cached / uploaded images |

## Deployment

```bash
docker build -t aira-backend ./backend
docker run -p 8000:8000 --env-file backend/.env \
  -e GOOGLE_APPLICATION_CREDENTIALS=/secrets/key.json -v /path/key.json:/secrets/key.json:ro \
  -e FRONTEND_URL=https://slides.example.com -v aira-data:/data aira-backend
```

The image includes Chromium for PDF export and runs as a non-root user; mount `/data` as a volume. See the repo-root `docker-compose.yml` for the full stack.

Production notes:
- **Credentials:** on Cloud Run or GKE, attach a service account with `roles/aiplatform.user` and don't set `GOOGLE_APPLICATION_CREDENTIALS`.
- **Workers:** run one uvicorn worker per container. Concurrency limits are per process, so scale by adding replicas.
- **More than one replica:** move `app/db.py` to Postgres/Firestore and `data/media` to GCS. The function signatures stay the same.
- **Auth:** add SSO/JWT and rate limits in front (API gateway or a FastAPI dependency).
- **Vertex quota:** check the QPM/TPM quota for `gemini-2.5-flash`. A 12-slide deck makes about 14 calls. 429 responses are retried with backoff.

## Known limitations

- Imagen is not enabled on project `ticm-qa` (404), so image slides use stock photos (with a key) or the frontend's illustrations.
- Stock photos are cached locally and credited on the slide. A public Unsplash production app must also follow Unsplash's hotlinking and download-tracking guidelines.
- Auto-fit shortens text; it does not split a slide into two.
