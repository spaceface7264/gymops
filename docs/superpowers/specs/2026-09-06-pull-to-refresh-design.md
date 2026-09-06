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
- `touchmove` computes `delta = currentY - startY`. Downward only. `pull = min(delta * 0.5, 96)`. `armed` when `pull >= 64`. Any upward movement, or the page no longer at the top, cancels back to `idle`.
- `touchend` while `armed` enters `refreshing` and awaits `onRefresh()`; the indicator is shown for at least 400 ms so a fast refetch does not blink. `touchend` while merely `pulling` returns to `idle`.
- `onRefresh` is `queryClient.refetchQueries({ type: 'active' })`: everything mounted reloads, including the bell and the gym switcher, and a new page gets it for free.
- Listeners are passive on `document`; the page is never blocked from scrolling. Chrome Android's native whole-page reload is switched off below `md` with `overscroll-behavior-y: none` on `html`, so the gesture does not fire twice.

## Pieces

- `src/hooks/use-pull-to-refresh.ts`: `usePullToRefresh({ enabled, onRefresh })` returns `{ pull, state }`. No DOM of its own.
- `src/components/pull-indicator.tsx`: `PullIndicator({ pull, state })`. A 32 px `bg-card` disc with a shadow, fixed under the header, `translateY` driven by `pull`, the `LoaderCircle` icon rotated by the pull and `animate-spin` while refreshing, opacity 0 when idle. `role="status"` with a sr-only "Refreshing…" (`app.refreshing`, en and da) only while refreshing. Transform and opacity only; the global reduced-motion rule already covers it. Page content does not move.
- `AppShell`: calls the hook with `enabled = phone && !fullBleed` and renders the indicator before `<main>`.
- `index.css`: one rule for the overscroll behaviour below `md`.

## Testing

- Vitest, hook: synthetic `TouchEvent`s on `document`. At top, move 150 px, end → `onRefresh` called once and state passes through `refreshing`. Move 40 px → not called. `scrollTop` 100 → not called. `enabled: false` → no listeners.
- Vitest, shell: no indicator on desktop.
- Manual: Playwright `--project=chrome` at 390 px with touch, watch the disc and the refetch.

## Docs

PROJECT_STATE.md and PROJECT_SPEC.md §3.2/§4 in the same commit.
