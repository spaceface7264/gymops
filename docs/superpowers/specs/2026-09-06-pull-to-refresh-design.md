# Pull-to-refresh on the phone — design

Date: 2026-09-06. Decided with Rami: shell pages only, refetch every active query, own hook with no library.

## Why

The phone app is a standalone PWA with no reload button. Queries are stale for 30 s and do not refetch on focus, so a staff member who opens the app mid-shift has no way to reload a list except restarting the app. Pull-to-refresh is the gesture every phone user already knows.

## Scope

- Every screen framed by `AppShell` that is not full-bleed (Home, checklists, daily log, incidents, news, guides, events, admin, account, notifications).
- Phone only (`usePhone()`, below `md`). Desktop has a browser reload button and no touch gesture convention.
- Chat is out: it is full-bleed, its stream scrolls inside `MessageScroller` with `overscroll-contain`, and Realtime keeps it current.

## Behaviour

The document scrolls (the shell root is `min-h-dvh`), so the gesture is armed only when `document.scrollingElement.scrollTop === 0` at `touchstart`.

States: `idle` → `pulling` → `armed` → `refreshing` → `idle`.

- `touchstart` with one finger at the top of the page records the start Y.
- `touchmove` computes `delta = currentY - startY`. Downward only. `pull = 96 * (1 - exp(-delta / 128))`: rubber, so the disc approaches the cap and never freezes under a moving thumb. `armed` when `pull >= 64` (about 140 px of thumb). Any upward movement, or the page no longer at the top, cancels back to `idle`.
- A `touchstart` inside a `[role="dialog"]` (the More sheet, any dialog) is ignored: Radix locks the page at the top, and a drag in a sheet is the sheet's.
- `touchend` while `armed` enters `refreshing` and awaits `onRefresh()`; the indicator is shown for at least 400 ms so a fast refetch does not blink. `touchend` while merely `pulling` returns to `idle`.
- `onRefresh` is `queryClient.refetchQueries({ type: 'active' })`: everything mounted reloads, including the bell and the gym switcher, and a new page gets it for free.
- The hook also returns `refresh()`, the same commit path from a button: the More sheet has a Refresh row on a page that can be pulled (WCAG 2.5.1, a single-pointer alternative to the gesture; also the doubter's button). After a refresh, `done` is true for 1.5 s.
- Independently, `useRefetchOnResume()` refetches the stale active queries once when the document becomes visible again, so a PWA brought back from the Home Screen is current before anyone pulls. `refetchOnWindowFocus` stays off.
- Listeners are passive on `document`; the page is never blocked from scrolling. Chrome Android's native whole-page reload is switched off below `md` with `overscroll-behavior-y: none` on `html`, so the gesture does not fire twice.

## Pieces

- `src/hooks/use-pull-to-refresh.ts`: `usePullToRefresh({ enabled, onRefresh })` returns `{ pull, state }`. No DOM of its own.
- `src/components/pull-indicator.tsx`: `PullIndicator({ pull, state, done })`. A 32 px `bg-card` disc with a shadow that comes down out of the header with the finger and docks centred on the header's bottom edge at 64 px (`translateY(min(pull, 64) - 20)`), never over the page title. An `ArrowDown` turns over as the pull grows (180° at armed, Chrome Android's grammar) and the disc scales to 1.1 when armed; `LoaderCircle` spins while refreshing. Under the finger the disc tracks it; off the finger (release, end) transform and opacity ease over 150 ms, so nothing snaps. Idle sits above the viewport at opacity 0. A separate always-mounted sr-only `role="status"` line reads "Refreshing…" then "Refreshed" (`app.refreshing`, `app.refreshed`, en and da); toggling text inside an exposed live region is what VoiceOver reliably announces. Transform and opacity only; the global reduced-motion rule already covers it. Page content does not move.
- `src/hooks/use-refetch-on-resume.ts`: `useRefetchOnResume()`, mounted in `AppShell`.
- `AppShell`: calls the hook with `enabled = phone && !fullBleed`, renders the indicator before `<main>`, and hands `refresh` to `MoreTab` for its Refresh row (`nav.refresh`).
- `index.css`: one rule for the overscroll behaviour below `md`.

## Critique (2026-09-06, after the first build)

An `/impeccable critique` scored the first build 25/40: engineering and look right, kinetics and discoverability wrong. Decided with Rami: P1 + P2 in the order kinetics, a11y, plus refetch on resume. Fixed: no armed cue (arrow flip + scale), the disc landing on the page title (docks on the header seam), snaps on release and reset (eased when off the finger, rubber curve to the cap), firing under an open sheet (dialog guard), no non-gesture path (Refresh row) and the live region entering the tree with its text (always-mounted status line, "Refreshed" at the end). Left as P3: `touchcancel` commits an armed pull, no axis lock against a diagonal swipe on a `ToggleGroup`, and `overscroll-behavior-y: none` also removes Android's bottom glow (`contain` would keep it).

## Testing

- Vitest, hook: synthetic `TouchEvent`s on `document`. At top, move 150 px, end → `onRefresh` called once and state passes through `refreshing`. Move 40 px → not called. `scrollTop` 100 → not called. `enabled: false` → no listeners.
- Vitest, shell: no indicator on desktop.
- Manual: Playwright `--project=chrome` at 390 px with touch, watch the disc and the refetch.

## Docs

PROJECT_STATE.md and PROJECT_SPEC.md §3.2/§4 in the same commit.
