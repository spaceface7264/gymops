# GymOps

Internal operations app for a chain of bouldering gyms: news, guides with
acknowledgements, checklists, the daily log, incidents, events, team chat and
notifications — one codebase that runs in the browser, as an installable PWA on
phones, and as a Windows/macOS desktop app.

Stack: Vite + React 19 + TypeScript, Tailwind + shadcn/ui, TanStack Query,
React Router 7, react-i18next (`en`, `da`); Supabase (Postgres with RLS as the
permission layer, Realtime, Storage, Edge Functions); Tauri 2 for the desktop
shell. `PROJECT_SPEC.md` holds the requirements and conventions,
`PROJECT_TASKS.md` the task graph, `PROJECT_STATE.md` what is done and decided.

## Setup

You need:

- **Node 20** (CI runs 20; the lockfile is generated with npm 11).
- A **Docker-compatible runtime** for the local Supabase stack — OrbStack or
  Docker Desktop.
- The **Supabase CLI** (`npx supabase` works; CI pins 2.116.0).
- **Rust** (stable, via [rustup](https://rustup.rs)) only for the desktop
  shell. On macOS the Xcode Command Line Tools are enough; on Windows the
  Visual Studio C++ build tools and WebView2; on Linux `libwebkit2gtk-4.1-dev`
  and friends per the Tauri prerequisites.

```sh
npm ci
cp .env.example .env.local          # then fill in the values below
npm run db:start                    # local Supabase; prints the keys
npm run db:reset                    # migrations + seeds + pgTAP helpers
npm run dev                         # http://localhost:5173
```

Seed users (local only): `super@`, `admin@`, `manager@`, `staff@` at
`gymops.test`, password `Password123`.

## Environment

All client variables are `VITE_*` and end up in the built bundle — never put a
secret in one. `.env.local` is git-ignored.

| Variable                        | Purpose                                                               |
| ------------------------------- | --------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`             | The Supabase API URL (local stack: `http://127.0.0.1:54321`).         |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | The project's publishable key.                                        |
| `VITE_VAPID_PUBLIC_KEY`         | Public half of the web-push key pair; empty disables the push opt-in. |
| `VITE_SENTRY_DSN`               | Sentry DSN; empty disables reporting.                                 |

Server-side secrets (service-role key, Resend, the VAPID private key, the
Anthropic key) live in Supabase function secrets and GitHub Actions secrets
only. `supabase/functions/.env` holds a local-only development set for
`npx supabase functions serve --env-file supabase/functions/.env`.

## Commands

| Command                                             | Purpose                                            |
| --------------------------------------------------- | -------------------------------------------------- |
| `npm run dev` / `build` / `preview`                 | Vite                                               |
| `npm run typecheck`, `lint`, `format:check`, `test` | the gates CI runs                                  |
| `npm run e2e` / `e2e:chrome`                        | Playwright against the local stack                 |
| `npm run db:start` / `db:stop` / `db:status`        | local Supabase stack                               |
| `npm run db:reset` / `db:test` / `db:lint`          | re-apply migrations + seeds; pgTAP RLS tests; lint |
| `npm run db:migration <name>`                       | new migration file                                 |
| `npm run db:types`                                  | regenerate `src/lib/database.types.ts` (commit it) |
| `npm run tauri dev`                                 | the desktop window over the Vite dev server        |
| `npm run tauri build`                               | installers into `src-tauri/target/release/bundle/` |

Realtime features (checklists, the notification badge, chat) need the full
stack — `supabase start -x …` without the realtime container leaves them stale.

## Desktop

`src-tauri/` wraps the built web assets with Tauri 2 and the `deep-link`
(`gymops://`), `single-instance`, `notification`, `updater` and `process`
plugins. `src/lib/platform` is the only code that imports `@tauri-apps/*`;
everything else asks it `isDesktop()`.

- `npm run tauri dev` opens the window on the dev server (port 5173, fixed).
- macOS honours the `gymops://` scheme only from a bundled app:
  `npm run tauri build -- --debug --bundles app`, open the `.app` under
  `src-tauri/target/debug/bundle/macos/` once, then
  `open 'gymops://auth/callback?…'` reaches it. Every installed copy registers
  the scheme under the same identifier, so an app in `/Applications` will take
  the link instead of the debug bundle; `open -a <path-to-app> 'gymops://…'`
  targets one copy.
- Auth mail links: invites land on the web `/auth/callback`, which offers the
  desktop app or the browser; a password reset requested in the app redirects
  straight to `gymops://auth/callback`.

## Releases

A tag `v*` runs `.github/workflows/release.yml`, which builds a universal macOS
`.dmg` and a Windows `.msi` and publishes them, with the updater's
`latest.json`, as a **draft** release on the public
[`gymops-releases`](https://github.com/spaceface7264/gymops-releases)
repository (the source repository is private; installed apps fetch the feed
from there without a token). Publish the draft to ship it; installed apps
offer the update on their next launch.

```sh
npm version 0.2.0 --no-git-tag-version      # package.json
# mirror the version in src-tauri/tauri.conf.json and src-tauri/Cargo.toml
git commit -am "chore: release 0.2.0" && git tag v0.2.0 && git push --tags
```

Actions secrets the workflow needs:

| Secret                                                                                           | What it is                                                                                                                              |
| ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `RELEASES_TOKEN`                                                                                 | A fine-grained PAT with `contents: write` on `gymops-releases`.                                                                         |
| `TAURI_SIGNING_PRIVATE_KEY`                                                                      | The updater's private key (`tauri signer generate`). Lose it and no installed app can ever update again — keep a copy outside the repo. |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_VAPID_PUBLIC_KEY`, `VITE_SENTRY_DSN` | The hosted project's values, baked into the build.                                                                                      |

### Code signing and notarization

Without the variables below the workflow still succeeds and produces
**unsigned** bundles: macOS Gatekeeper refuses them unless the user
right-click-opens the app, and Windows SmartScreen warns. Signing is added by
setting secrets; `tauri-action` reads them, nothing in the repo changes.

**macOS** — needs an Apple Developer Program membership.

1. In Xcode or the developer portal create a **Developer ID Application**
   certificate and export it with its private key as a `.p12`.
2. Add secrets: `APPLE_CERTIFICATE` (the `.p12`, base64: `base64 -i cert.p12`),
   `APPLE_CERTIFICATE_PASSWORD`, and `APPLE_SIGNING_IDENTITY` (the certificate's
   name, `Developer ID Application: <Company> (<TEAMID>)`).
3. For notarization add either `APPLE_ID` + `APPLE_PASSWORD` (an app-specific
   password) + `APPLE_TEAM_ID`, or an App Store Connect API key as
   `APPLE_API_ISSUER`, `APPLE_API_KEY` and `APPLE_API_KEY_PATH`.

Tauri signs the `.app`, notarizes it and staples the ticket during
`tauri build` when those are present.

**Windows** — a code-signing certificate (an OV/EV certificate from a CA, or
Azure Trusted Signing).

- With a certificate file: install it on the runner in a step before
  `tauri-action` (`Import-PfxCertificate` from a base64 secret) and set
  `bundle.windows.certificateThumbprint` in `src-tauri/tauri.conf.json`;
  `digestAlgorithm` and `timestampUrl` sit next to it.
- With Azure Trusted Signing or another external tool: set
  `bundle.windows.signCommand` to the command Tauri should run per file.

The updater verifies its own signature (`TAURI_SIGNING_PRIVATE_KEY`) regardless
of OS code signing; the two are separate keys.

## Observability

Sentry (`src/lib/sentry.ts`) reports errors and a 20% trace sample from both
clients into one project, told apart by a `client` tag (`web` / `desktop`),
with `release: gymops@<version>`. Production source maps are not uploaded yet;
that needs `@sentry/vite-plugin` and a `SENTRY_AUTH_TOKEN` secret.
