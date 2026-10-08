/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the Aira API, e.g. https://api.example.com. Empty = same origin. */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
