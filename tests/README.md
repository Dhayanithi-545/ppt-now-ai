# Aira tests

All automated tests and visual-QA tools for both apps.

```
tests/
├── conftest.py · pytest.ini     shared pytest setup (adds backend/ to the import path)
├── requirements.txt             test-only Python packages
├── backend/                     pytest unit + API tests (no network, Gemini mocked)
├── frontend/                    Vitest unit tests (run from frontend/)
├── e2e/                         browser end-to-end tests and visual-QA scripts (Playwright)
├── fixtures/poc-samples/        .pptx files produced by the original POC (reference only)
└── output/                      screenshots, exported files, logs (git-ignored)
```

## Setup

The Python tests use the backend's virtualenv:

```powershell
backend\.venv\Scripts\pip install -r backend\requirements.txt -r tests\requirements.txt
backend\.venv\Scripts\python -m playwright install chromium
```

## Run

```powershell
# backend unit/API tests + PPTX builder test (from the repo root)
backend\.venv\Scripts\python -m pytest tests

# frontend unit tests
cd frontend; npm test
```

| Suite | Covers |
|---|---|
| `backend/test_layouts.py` | Every layout's Gemini schema builds (no oversized enums); output sanitising (limits, items, icons, charts, tables); fallback mapping; frontend registry and icon map cover the spec |
| `backend/test_themes.py` | WCAG contrast math; prompt-generated theme tokens are auto-fixed and clamped; fonts and enums constrained; built-in themes readable |
| `backend/test_pipeline.py` | Outline / slide / chat-edit JSON parsing; outline repair (cover, closing, variety); slide retry → fallback → never fails; chat operations (insert, delete, theme, rename); SSE format |
| `backend/test_api.py` | Deck save/load, versions, custom themes, image upload/search, safe download names |
| `backend/test_spec_sync.py` | `backend/app/spec/*.json` and `frontend/src/design/*.json` are identical |
| `e2e/test_pptx_export.py` | Exports all 31 layouts through the real browser PPTX builder (2 themes) and checks: 16:9 size, background image, editable text, native charts and table, pictures, notes, font names. Needs `frontend/dist` (skipped otherwise). |
| `frontend/frontend.test.ts` | PPTX helpers (units, colours, fonts), contrast, layout remapping |

## End-to-end and visual QA (needs the running apps + Vertex credentials)

Start the backend (`:8000`) and the frontend dev server (`:5173`), then run:

| Script | What it does |
|---|---|
| `e2e/screenshot_gallery.py [--themes a,b]` | Captures every theme × layout at 1280×720, builds contact sheets, and reports overflow |
| `e2e/e2e_decks.py [--only abc]` | Creates the three reference decks through the UI, screenshots every slide, and downloads the PPTX and PDF (see below) |
| `e2e/e2e_editor.py <deck_id>` | Exercises the editor: inline edit, theme, layout, undo/redo, chat edits, regenerate, duplicate/delete/drag, image upload, versions, presenter, dark mode |
| `e2e/render_pptx.ps1 -Pptx f.pptx -Out dir` | Renders an exported PPTX with Microsoft PowerPoint (if installed) |
| `e2e/compare_pptx.py tests/output/e2e/a` | Browser vs PowerPoint, side by side, with a per-slide similarity score |
| `e2e/contact_sheet.py tests/output/e2e/a` | Contact sheet of a deck's slide screenshots |

The three reference decks are:
- (a) pitch deck for an AI fitness startup, 12 slides
- (b) quantum computing for college students, 10 slides
- (c) custom style "minimal Japanese aesthetic, muted earth tones"

Run the scripts with the backend's Python, e.g. `backend\.venv\Scripts\python tests\e2e\e2e_decks.py`. Set `--base` (or `AIRA_URL` for the editor script) to test another deployment.
