/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LINK_PRIVACY?: string
  readonly VITE_LINK_TERMS?: string
  readonly VITE_LINK_SECURITY?: string
  readonly VITE_LINK_ACCESSIBILITY?: string
  readonly VITE_LINK_HELP?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
