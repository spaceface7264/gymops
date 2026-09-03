# Facelift — visual identity for the existing screens

Date: 2026-09-03. Decided with Rami; task IDs P7C-01 … P7C-05 in
`PROJECT_TASKS.md`. One branch (`facelift`), one PR.

## 1. Why

The app ships as stock shadcn neutral: zero chroma in the theme, no typeface
loaded, a `.dark` block nothing can reach, and the violet of the app icon
(`#863bff`) appearing nowhere in the UI. Staff are 20–25 year olds using it
one-handed on a phone mid-shift, on a front-desk touch screen and in the
desktop app. The facelift gives it an identity they would choose to open,
**without changing layout, navigation or routes**.

## 2. Decisions

| Decision         | Choice                                                                                                                                                                                    |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Goal             | Look less generic. Layout, routes and shadcn structure stay.                                                                                                                              |
| Reference feel   | All Gravy (allgravy.com): white surfaces, one purple accent, rounded shapes, bold friendly headings, casual tone, phone-first.                                                            |
| Accent           | The icon violet `#863bff`.                                                                                                                                                                |
| Typeface         | Inter, self-hosted via `@fontsource-variable/inter` (the desktop app must work offline; no Google Fonts request).                                                                         |
| Dark mode        | Removed. The `.dark` block, the `dark` custom variant and every `dark:` class in `src/components/ui` go. Light only.                                                                      |
| Breadth          | Foundation, primitives, shared layer, shell, then every screen.                                                                                                                           |
| Logo             | The favicon bolt as an inline SVG `Logo` component, beside the wordmark in the sidebar and above the auth card.                                                                           |
| Page ground      | Faint lilac ground, white cards with a 1px border, no shadow.                                                                                                                             |
| Radius           | `--radius: 1rem`. Cards and dialogs `rounded-2xl`, inputs `rounded-xl`, buttons and badges pill (`rounded-full`).                                                                         |
| Status colour    | Five tinted tones (success, warning, info, danger, new) in one `StatusBadge` with a `tone` prop, replacing the three per-feature badge maps. Semantic colour is separate from the accent. |
| Header identity  | The email text and the standing Sign out button become an initials avatar opening a menu: Account, Notification preferences, Sign out.                                                    |
| Phone bottom bar | Unchanged in this pass (nine scrolling entries). Logged under Later as the next UX task: five primary tabs plus More.                                                                     |
| Motion           | Minimal: 150 ms ease-out on hover and press, a short fade on route content, skeleton shimmer. All under `prefers-reduced-motion`. No layout animation.                                    |
| Type scale       | Page title 24 px semibold, section title 18 px semibold, body 15 px, meta 13 px. Tabular numerals on counts.                                                                              |

## 3. Colour

Light only. Every text pairing below was computed against WCAG AA (4.5:1);
the lowest is 4.8:1.

### Brand violet

| Step | Hex       | Role                                                           |
| ---- | --------- | -------------------------------------------------------------- |
| 50   | `#f5f0ff` | `--accent`: active nav pill, row and menu hover                |
| 100  | `#ede4ff` | "new" badge tint                                               |
| 200  | `#d9c7ff` | avatar tint, selection                                         |
| 300  | `#bf9fff` |                                                                |
| 400  | `#a46dff` |                                                                |
| 500  | `#863bff` | `--primary`, `--ring` (5.1:1 with white)                       |
| 600  | `#7429f0` | primary hover                                                  |
| 700  | `#5f1fd1` | primary pressed; `--accent-foreground`; links (8.1:1 on white) |
| 800  | `#4716a3` |                                                                |
| 900  | `#2e0f66` |                                                                |

### Neutrals (all leaning violet)

| Token                    | Hex       | Role                                                                              |
| ------------------------ | --------- | --------------------------------------------------------------------------------- |
| `--background`           | `#f7f5fb` | page ground                                                                       |
| `--card`, `--popover`    | `#ffffff` | cards, dialogs, menus, inputs                                                     |
| `--foreground`           | `#16121f` | text, headings, icons (18.4:1 on card)                                            |
| `--secondary`, `--muted` | `#f1eef7` | secondary buttons, table header, skeleton base                                    |
| `--secondary-foreground` | `#2c2540` | text on secondary, table cells                                                    |
| `--muted-foreground`     | `#6b6580` | meta, descriptions, inactive nav (5.5:1 on card, 5.1:1 on ground, 4.8:1 on muted) |
| `--border`               | `#e6e2ef` | card edges, dividers                                                              |
| `--input`                | `#d9d4e6` | input and outline-button borders                                                  |
| `--destructive`          | `#cc2e2e` | delete buttons, error text (5.3:1 with white)                                     |

Removed: `.dark` and the eight `--sidebar-*` tokens (the nav uses `--accent`).

### Status tones (background / text / dot)

| Tone    | Background | Text      | Dot       | Ratio |
| ------- | ---------- | --------- | --------- | ----- |
| success | `#e3f7ea`  | `#14713a` | `#22a35a` | 5.4:1 |
| warning | `#fff3d6`  | `#8a5a00` | `#e8a100` | 5.4:1 |
| info    | `#e0eefc`  | `#1a4f9c` | `#2f7de1` | 6.7:1 |
| danger  | `#fde6e6`  | `#a11c1c` | `#cc2e2e` | 6.5:1 |
| new     | `#ede4ff`  | `#5f1fd1` | `#863bff` | 6.6:1 |

Violet is spent on the active nav pill, the primary button, the focus ring,
unread counts and the "new" badge, and nowhere else. It is never body text on
white: 5.1:1 clears AA only for large or bold text.

## 4. What gets built

### P7C-01 Foundation

`src/index.css`: the tokens above in place of the neutral set, the `.dark`
block and `dark` variant deleted, `--font-sans` set to Inter, `--radius: 1rem`,
the type scale as base styles. `package.json`: `@fontsource-variable/inter`,
imported once in `main.tsx`. The PWA precache glob already includes `woff2`,
so the font ships in the service worker and in the desktop bundle.

### P7C-02 Primitives

Restyle the ten vendored primitives in `src/components/ui`: pill buttons,
`rounded-xl` inputs, card border and radius, badge tones; strip `dark:`.
`CardTitle` renders a real heading (an `as` prop, default `h2`), closing the
"no heading landmarks on the home cards" gap. Add through the shadcn CLI and
restyle the same way: `skeleton`, `avatar`, `sonner`, `tooltip`, `textarea`,
`switch`.

### P7C-03 Shared layer

New under `src/components/`:

- `Logo` — inline SVG of the favicon mark, optional wordmark.
- `PageHeader` — title, optional description, action slot.
- `EmptyState` — icon, title, body, optional action.
- `LoadingState` — skeleton rows or cards.
- `StatusBadge` — `tone` prop; the three feature badge maps become thin
  wrappers that pick a tone and a label.

### P7C-04 Shell

`app-shell.tsx`: `Logo` in the sidebar head; nav items as pills with the
violet active state, 44 px minimum hit area on phone; header with the gym
switcher left and bell plus avatar menu right. `auth-layout.tsx`: `Logo`
above the card on the lilac ground.

### P7C-05 Screen sweep

Every route in `router.tsx`: open with `PageHeader`, replace bare loading and
empty text with the shared states, badges with `StatusBadge`, check touch
targets and spacing. Order: login, home, incidents list and detail,
checklists, chat, news feed, then the rest.

Out of scope: nav restructure, dark mode, illustrations, any change to routes
or data hooks.

## 5. Constraints

- No hard-coded strings; every new label in `en` and `da`. Danish runs long,
  so check labels in `da` first.
- Bottom tab bar on phone, sidebar from `md` up (spec §4).
- Front-desk touch: 44 px targets; up/down buttons, not drag-and-drop.
- `@tauri-apps/*` only under `src/lib/platform`; fonts ship in the bundle.
- Contrast AA on every text pairing, as tabulated above.

## 6. Verification

- `npm run typecheck lint format:check test build` green after every task.
- Screenshots at 390, 768 and 1280 px for login, home, incidents, checklists
  and chat, in `en` and `da`, compared before and after.
- `npm run e2e` still passes.
- Keyboard focus visible in violet on every control; VoiceOver reads one
  heading per home card; `prefers-reduced-motion` removes the route fade.
- `npm run tauri build -- --debug --bundles app`; open the `.app` offline and
  confirm Inter renders.
