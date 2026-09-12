/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SDR_HTTP?: string
  readonly VITE_SDR_WS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
