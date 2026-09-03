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
  /** P7-05: the Sentry project's DSN. Empty means no reporting. */
  readonly VITE_SENTRY_DSN?: string
}

/** The package version, injected by `vite.config.ts` for the Sentry release. */
declare const __APP_VERSION__: string

interface ImportMeta {
  readonly env: ImportMetaEnv
}
