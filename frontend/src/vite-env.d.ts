/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MIDTRANS_CLIENT_KEY: string
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
