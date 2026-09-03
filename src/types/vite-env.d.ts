/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Typed so `import.meta.env` is not `any`: the client would otherwise be built
// from unchecked values (spec §5, no `any`).
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string
  /** P5-05: the public half of the VAPID pair `notify` signs pushes with.
   *  Empty in a build with no push configured, which the opt-in says out loud. */
  readonly VITE_VAPID_PUBLIC_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
