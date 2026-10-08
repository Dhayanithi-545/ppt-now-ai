# Aira frontend (React + Vite + TypeScript)

The Aira web app. It contains:
- **Design system:** 12 themes and 31 slide layouts on a fixed 1280×720 canvas
- **Create flow:** prompt → clarifying questions → theme picker → editable outline
- **Editor:** live streaming preview, inline editing, chat edits, theme and layout switching, undo/redo, versions, presenter mode
- **Export:** PPTX built in the browser; PDF rendered by the backend

HTML/CSS is the source of truth: the preview, the PDF and the PPTX all come from the same React components.

## Structure

```
frontend/
├── src/
│   ├── main.tsx · App.tsx      entry + routes (/, /deck/:id, /print/:id, /gallery)
│   ├── config.ts               API base URL from .env
│   ├── api.ts                  typed API client + SSE reader
│   ├── store.ts                editor state (zustand): deck, undo/redo, selection
│   ├── ui.tsx                  shared UI: modal, toasts, theme helpers
│   ├── index.css · app.css     app chrome: Monochrome Gallery look (Instrument Serif + Inter), light/dark, responsive
│   ├── design/                 tokens & types, 12 themes, colour + contrast, theme → CSS vars,
│   │                           layout remapping, fonts, icon map, layouts.json + design.json (spec)
│   ├── slides/                 SlideView/SlideCanvas, 31 layouts (layouts/), backgrounds + motifs,
│   │                           illustration fallback, charts (ECharts), slide.css
│   ├── pages/                  Home (create flow), Gallery, Print, editor/ (Editor, dialogs, Presenter)
│   └── export/pptx.ts          hybrid PPTX builder (PptxGenJS + html-to-image)
├── public/                     logo.png (app logo), favicons, sample photos used by /gallery
├── Dockerfile · nginx.conf.template
└── .env.example
```

`src/design/layouts.json` and `design.json` are copies of `backend/app/spec/`. Keep them identical; a test in `tests/backend/` enforces it.

## Run locally

```powershell
cd frontend
copy .env.example .env
npm install
npm run dev            # http://localhost:5173  (backend must be running on :8000)
```

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload; proxies `/api` and `/media` to the backend |
| `npm run build` | Type-check + production build into `dist/` |
| `npm run preview` | Serve `dist/` locally |
| `npm test` | Unit tests (Vitest), which live in `../tests/frontend/` |
| `npm run lint` | oxlint |

## Configuration (`frontend/.env`)

| Key | Default | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | *(empty)* | API base URL. Leave empty when the API is on the same origin (dev proxy or the nginx image). If set, add this frontend's origin to the backend's `CORS_ORIGINS`. Inlined at build time. |
| `VITE_DEV_API_PROXY` | `http://localhost:8000` | Dev server only: where `/api` and `/media` are forwarded. |

The backend needs the frontend's public URL in its `FRONTEND_URL` so PDF export can open `/print/{id}`.

## Deployment

The Docker image builds the app and serves it with nginx. nginx also reverse-proxies `/api` and `/media` to the backend, so the browser sees one origin and needs no CORS. Proxy buffering is off for the SSE stream.

```bash
docker build -t aira-frontend ./frontend
docker run -p 8080:80 -e BACKEND_URL=http://backend-host:8000 aira-frontend
```

Any static host works too (`npm run build`, upload `dist/`). You then need either a reverse proxy for `/api` and `/media`, or `VITE_API_BASE_URL` plus the backend's `CORS_ORIGINS`. Client-side routes need an `index.html` fallback.

## App chrome (UI)

- **Look:** "Monochrome Gallery": paper and ink colors, Instrument Serif headings, Inter for UI text, and one cobalt accent. Light and dark palettes are defined as tokens in `src/index.css`, follow the OS by default, and can be toggled in the app.
- **Responsive:** breakpoints at 1100 px, 860 px (the assistant becomes a slide-over drawer) and 600 px (phone):
  - icon-only toolbar with a "More" menu
  - dialogs become bottom sheets
  - 44 px touch targets
  - safe-area padding
- **Logo:** `public/logo.png`, used in the header, favicon and Apple touch icon.

## Design system notes

- **Theme tokens** ([`src/design/types.ts`](src/design/types.ts)): palette, gradient, font pair, background style, motif, card/eyebrow/shadow style, image treatment, hero fill and radius. Custom themes from the backend use the same shape.
- **Contrast:** derived colors are auto-corrected at render time ([`themeVars.ts`](src/design/themeVars.ts)).
- **Fonts:** all 21 are bundled locally via Fontsource, so PDF and PPTX rasterization never depend on a CDN.
- **Auto-fit:** `SlideView` measures each slide, shrinks text by at most 22%, and reports `data-overflow`. The editor then asks the API for a shorter version.
- **PPTX export:** each slide's decorative layer becomes a 2× background image. Text (with the exact line breaks), icons, pictures, native charts, native tables and notes are placed on top at their measured positions.
- **Fonts in PowerPoint:** for an exact match, install the theme's Google Fonts (linked in the download dialog) or tick "Use standard fonts". Gradient text exports as a solid color.
