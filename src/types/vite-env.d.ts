/// <reference types="vite/client" />

// Typed so `import.meta.env` is not `any`: the client would otherwise be built
// from unchecked values (spec §5, no `any`).
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
