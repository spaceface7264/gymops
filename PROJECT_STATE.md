# GymOps — Project State

Last updated: 2026-09-01

## Currently working on

**P1-01 done** on branch `phase-1-scaffold`. Next up: **P1-02** (Supabase local stack), then **P1-03** (i18n) and **P1-04** (core migration).

## Phase status

| Phase                    | Status         | Notes                                           |
| ------------------------ | -------------- | ----------------------------------------------- |
| Design                   | ✅ Complete    | Approved 2026-09-01. Spec in `PROJECT_SPEC.md`. |
| P1 Scaffold and auth | 🔄 In progress | P1-01 done. |
| P2 Users and gyms admin  | ⬜ Not started |                                                 |
| P3 News and guides       | ⬜ Not started |                                                 |
| P4 Daily ops             | ⬜ Not started |                                                 |
| P5 Notifications and PWA | ⬜ Not started |                                                 |
| P6 Team chat             | ⬜ Not started |                                                 |
| P7 Desktop and release   | ⬜ Not started |                                                 |
| P8 AI assistant (V1.5)   | ⬜ Not started | Needs Anthropic API key in Supabase secrets.    |

## Task status

Update this list as work begins:

| Task | Status | Started | Done | Notes |
| --- | --- | --- | --- | --- |
| P1-01 | ✅ done | 2026-09-01 | 2026-09-01 | Vite 8 + React 19 + TS 6, Tailwind v4, shadcn/ui, React Router 7, TanStack Query 5, ESLint 10 + Prettier, Vitest 4 + RTL. Branch `phase-1-scaffold`. |
| P1-02 … P8-06 | ⬜ not started | | | |

Status values: ⬜ not started · 🔄 in progress · ✅ done · ⏸ blocked

## Blockers and external dependencies

| Item                                                        | Needed for                           | Owner                      | Status               |
| ----------------------------------------------------------- | ------------------------------------ | -------------------------- | -------------------- |
| Supabase project (hosted) | first deploy after P1 | Rami | `.env.local` already points at project `ngcqpftfqepvhpjikaqq` — confirm it is the GymOps one |
| Resend account + API key                                    | P5-03                                | Rami                       | not created          |
| VAPID key pair                                              | P5-03                                | generated during P5-03     | —                    |
| Anthropic API key                                           | P8-03                                | Rami                       | not created          |
| Apple Developer ID + Windows signing cert                   | first public desktop release (P7-04) | Rami                       | not started          |
| BRP Systems API key, service account, rate limits, webhooks | V3                                   | Rami → BRP account manager | not requested        |
| Final product name                                          | before public release                | Rami                       | placeholder `gymops` |

## Decisions log

| Date       | Decision                                                                                            |
| ---------- | --------------------------------------------------------------------------------------------------- |
| 2026-09-01 | Single React app + Supabase, Tauri 2 desktop, PWA for phones.                                       |
| 2026-09-01 | Team chat ships in V1; AI assistant in V1.5; tasks/calendar V2; reports/BRP V3.                     |
| 2026-09-01 | Assistant uses Claude Opus 5 via Edge Function with full-text search tools, no embeddings pipeline. |
| 2026-09-01 | P1-01: kept ESLint + Prettier as specced rather than the oxlint the current Vite template ships; typed linting scoped to `.ts`/`.tsx`. Design docs are in `.prettierignore`. |
| 2026-09-01 | P1-01: kept ESLint + Prettier as specced rather than the oxlint the current Vite template ships. Typed linting (`recommendedTypeChecked`) is scoped to `.ts`/`.tsx`. |

## How to update this file

- When starting a task: add a row to Task status with 🔄 and the date, and set "Currently working on".
- When finishing: mark ✅, add the commit hash in Notes, update the Phase status when all its tasks are done.
- Record any new decision or rejected option here and in `PROJECT_SPEC.md` §4.
