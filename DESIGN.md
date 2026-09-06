# GymOps design reference

The one page to read before building or changing a screen. Decided with Rami on 2026-09-03 (Phase 7c, PR #11); the reasoning and the contrast maths are in `docs/superpowers/specs/2026-09-03-facelift-design.md`, the screens as shipped are in `docs/design/screens/`, the palette swatches at https://claude.ai/code/artifact/8ded5226-8845-48cf-a592-7477e5043edd.

**The feel:** friendly and clear, modelled on All Gravy. White surfaces on a faint lilac ground, one violet accent, pill buttons, bold plain headings, Inter. Built for 20–25-year-old staff on a phone mid-shift and on a front-desk touch screen. Light only.

## Colour

Tokens live in `src/index.css` and are used through Tailwind (`bg-primary`, `text-muted-foreground`, `bg-tone-warning-bg` …). Never write a hex in a component.

| Token                         | Value                 | Use                                                        |
| ----------------------------- | --------------------- | ---------------------------------------------------------- |
| `--background`                | `#f7f5fb`             | page ground                                                |
| `--card`, `--popover`         | `#ffffff`             | cards, dialogs, menus, inputs, the header and nav          |
| `--foreground`                | `#16121f`             | text, headings, icons                                      |
| `--primary`                   | `#863bff`             | primary button, active states, unread counts, focus ring   |
| `--primary-hover` / `-active` | `#7429f0` / `#5f1fd1` | button hover and pressed                                   |
| `--secondary`, `--muted`      | `#f1eef7`             | secondary buttons, table header, skeletons                 |
| `--secondary-foreground`      | `#2c2540`             | text on secondary, table cells                             |
| `--muted-foreground`          | `#6b6580`             | meta, descriptions, inactive nav                           |
| `--accent`                    | `#f5f0ff`             | active nav pill, row and menu hover                        |
| `--accent-foreground`         | `#5f1fd1`             | text on the accent tint, links                             |
| `--destructive`               | `#cc2e2e`             | delete buttons, error text                                 |
| `--border` / `--input`        | `#e6e2ef` / `#d9d4e6` | card edges and dividers / input and outline-button borders |
| `--ring`                      | `#863bff`             | focus ring, 3 px at 40 %                                   |

Violet is spent on the active nav pill, the primary button, the focus ring, unread counts and the `new` tone. It is never body text on white (5.1:1 clears AA only for large or bold text).

### Status tones

Five tones, each a tinted background, dark text of the same hue and a dot, exposed as `bg-tone-<tone>-bg`, `text-tone-<tone>-fg`, `bg-tone-<tone>-dot`. Semantic colour is separate from the accent.

| Tone      | Means                                 | Examples                                                           |
| --------- | ------------------------------------- | ------------------------------------------------------------------ |
| `success` | done, active, resolved, complete      | checklist complete, incident resolved, active user                 |
| `warning` | in progress, draft, flagged but open  | checklist in progress, draft post, medium severity, a logged issue |
| `info`    | scheduled, informational attribute    | incident in progress, pinned post, event type, merely-unread post  |
| `danger`  | needs attention now, a closed failure | open incident, high severity, missed checklist                     |
| `new`     | **only** unread or must-acknowledge   | unread news, acknowledgement required                              |
| `neutral` | a label, not a state                  | gym name, kind, role, category, company-wide                       |

`new` is reserved. If something is not literally unread or awaiting acknowledgement, it is not `new`.

## Type and shape

- **Inter**, self-hosted from `@fontsource-variable/inter` so the desktop app renders it offline. Base 15 px; tabular numerals everywhere. Text fields (`Input`, `Textarea`, `NativeSelect`) are 16 px so iOS does not zoom into them; never put `text-sm` on one.
- **Scale:** page title 24 px semibold (`PageHeader`), section title 18 px semibold (`CardTitle`), body 15 px, meta 13 px.
- **Radius:** `--radius: 1rem`. Cards and dialogs `rounded-2xl` (16 px), inputs and selects `rounded-xl` (12 px), menu items `rounded-lg` (12 px), buttons and badges pill. Inputs are less round than the card they sit in.
- **Surfaces:** cards are white with a 1 px border and no shadow. Dialogs are the one lifted surface (they keep a shadow).
- **Touch:** `--spacing` is 4 px, not the rem default, so `h-11` is 44 px at the 15 px root. Every control a thumb hits is at least 44 px tall: `Button` default `h-11`, `size="icon"` `size-11`, inputs and selects `h-11`, phone nav items `min-h-11`, `Switch` has a padded hit area. `size="sm"` (`h-9`) is for dense desktop-only rows.
- **Motion:** 150 ms ease-out on hover, press and every dialog, menu and tooltip enter (100 ms for tooltips); skeleton pulse while loading. Everything respects `prefers-reduced-motion`. No layout animation; no route transitions.

## Layout

- Phone: a bottom tab bar (spec §4 rejects a drawer). Sidebar from `md` up. `/chat` and `/ask` are the full-bleed routes: the frame is `h-dvh overflow-hidden` at every width and the screen scrolls its own panes, so a composer stays above the bar.
- Signed-in screens render inside `AppShell` in a `max-w-3xl` column. Signed-out screens use `AuthLayout`: the logo above a `max-w-sm` card.
- The header carries the gym switcher, the bell and an initials avatar whose menu holds Account, Notification preferences and Sign out. There is no standing Sign out button.

## The shared layer

Everything in `src/components/` (exported from `@/components`); the vendored shadcn primitives are in `src/components/ui/`. Feature code composes the former and reaches for the latter only for what the former does not cover.

| Component       | Use it for                                                                                                        | Rules                                                                                                                                                                              |
| --------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PageHeader`    | how every screen opens: `title`, optional `description`, one `action`                                             | renders the page's only `h1`. `action` is a control that already belongs beside the title (New …, Edit); never hoist Save out of a form or a control out of a card. Chat has none. |
| `EmptyState`    | nothing here yet: `icon`, `title`, optional `body`, `action`                                                      | inside a `Card` pass `bordered={false}`; on a screen with no other heading pass `as="h1"`. Reuse the existing `*.empty` key as the title.                                          |
| `LoadingState`  | skeleton rows in place of "Loading…" text: `rows` (3 in a card, 5–6 on a page)                                    | one `role="status"` announcement; never a bare loading paragraph                                                                                                                   |
| `StatusBadge`   | any state or label: `tone`, optional `dot`                                                                        | tones per the table above; `neutral` for labels; never the raw `Badge` for a state                                                                                                 |
| `Logo`          | the bolt from the app icon, `wordmark` for the text                                                               | sidebar head and the auth frame                                                                                                                                                    |
| `Markdown`      | text typed by a person or written by the assistant: `**bold**`, `*italic*`, `` `code` ``, bare links, line breaks | React nodes, never HTML; anything else stays as typed. Chat messages and the assistant's answers                                                                                   |
| `CardTitle`     | (in `ui/card`) a section title inside a card                                                                      | a real heading, `h2` by default, `as` to change                                                                                                                                    |
| `ConfirmDialog` | the one question before something irreversible: `title`, `body`, `confirmLabel`, `pending`, `error`, `onConfirm`  | an `AlertDialog`: no close button, Cancel focused, the failure shown inside it. Reversible toggles (deactivate, pin, mute) never confirm.                                          |
| `UnreadCount`   | the violet pill with a count: nav, channel list, bell                                                             | pass the `aria-label` that spells the count out; `99+` past ninety-nine                                                                                                            |
| `Checkbox`      | (in `ui/`) a yes/no on a form, or a row that can be picked                                                        | 20 px box with a 44 px hit area; wrap it and its text in a `<label className="min-h-11">` so the row is the target                                                                 |
| `NativeSelect`  | (in `ui/`) a `<select>` that stays native, in the `Input` look                                                    | the phone's own picker, keyboard and screen reader for free; a Radix `Select` only when options need more than text                                                                |
| `Tabs`          | (in `ui/`) switching between panels of one screen                                                                 | a segmented pill; when the panels are routes, `TabsTrigger asChild` around a `NavLink` so the URL is the state                                                                     |
| `ToggleGroup`   | (in `ui/`) a filter or a value: `type="single"` for one-of, `"multiple"` for a set                                | looks like `Tabs`, means something else (a radio group or pressed buttons); always `aria-label`; `variant="outline"` for chips a form collects                                     |

Error lines stay as they are: `<p role="alert" className="text-destructive text-sm">`.

## Feedback

A form that stays on screen reports its failure inline, next to the buttons. A toast (`toast` from `sonner`; the `Toaster` in `App` sits above the phone bar) is for when the result leaves the screen: saved and navigated away, a dialog that closed, or an action with no form at all (pin, mute, activate, mark read: at least an error toast, a success toast where the change is consequential). Success toasts are short nouns ("Post published", "Invitation sent"); errors reuse the feature's `*Failed` string. Nobody is toasted for their own checklist tick or chat message; the chat box says "Sending…" in a `role="status"` line while it waits and keeps the text with a "Try again" when it fails.

## Chat

The stream is cut into days (`h2` Today / Yesterday / date), lines by the same speaker within five minutes share one name, times are 24-hour, and the first unread line has a "New" chip above it in the `new` tone. Sender names are in the text colour; the accent is spent on exactly two things in the stream: a resolved `@Name` in the text, and a violet hairline (`highlight` bubble) on the line that names the reader. The transcript is shadcn's `MessageScroller` (`ui/message-scroller`): it follows the newest line only while the reader is at the bottom, holds its place when older pages load, and offers "Jump to latest" whenever the end is out of view; day headings and the "New" rule are `Marker`s. Every channel is bubbles (`ui/message` + `ui/bubble`), laid out the way the phone apps staff already use: the reader's own lines on the right on `--bubble-own` (#ede4ff, the `new` tint under its own name: `new` stays reserved for what is unread, and `--accent` is the hover tint that vanished against the lilac ground), everybody else's on the left on white; the sender's name inside the bubble at the top in the text colour (first bubble of a run, somebody else's only), the time bottom-right inside the bubble at 11 px (a clock while it is being sent), a squarer top corner on the first bubble of a run, and day and "New" markers as small chips. Message text is the app's 15 px, the size it was typed at. The "New" chip is the solid violet pill every unread count uses. The "Jump to latest" control is a round 44 px icon button bottom right with the count of unread lines below the reader; while it is up, the stream keeps a gutter clear of it. A line that could not be sent stays in the stream with a "Not sent" mark in the `danger` tone and a 44 px Try again beside it; the box empties the moment a line is in the stream, and what happens to it is told there. On a phone a conversation has one header (back, channel, bell, menu); the shell's header is off below `md`. Links are named by path (into this app) or host and short path (out of it), with the address as `title`. The menu trigger is a bare chevron in the bubble's top corner (WhatsApp's; no fill), hidden and without pointer events until the line is tapped, hovered or focused, and kept up while the menu is open; the bubble keeps 28 px clear for it beside the name, or beside the time when there is no name row. Menu items are 36 px from `md` up and 44 on a phone. There is no Edit. Every line has one menu, revealed by tapping the bubble on a phone and by hover or focus from `md` up: Reply, React (opens the four emoji 👍 ✅ 👀 ❤️ in a pill, 44 px each, yours marked), Copy, and Delete for an own or moderated line. A reply shows the quoted line's first line above the words, in a `bg-foreground/5` block with the name in the accent (no side stripe); tapping it goes to the line, loading older pages if it is further up. A smiley beside the bubble (revealed like the chevron) opens the four emoji in a row above it; the menu's React entry opens the same row. Reactions sit as one chip on the bubble's bottom edge (`BubbleReactions`): a 28 px white pill, no stroke, only the ring that lifts it off the bubble, showing the 16 px faces and one 12 px total once there is more than one (WhatsApp's rule), with a 44 px hit area through an invisible inset; tapping it opens a dialog with an "All N" tab and one tab per emoji, names on the left and the emoji on the right, your own rows tappable to remove, because touch has no hover. A reaction landing pops in (`animate-reaction-pop`, 260 ms, a small overshoot): the one bounce in the app, a rare moment worth a touch of delight; the chip fades and zooms in with its first face. A resolved `@Name` is set in `text-accent-foreground`; a typed one stays plain. The channel header is back, title (with a `BellOff` mark when muted) and one "Channel" menu whose mute item is a verb with a toast. A line being sent sits in the stream at once, muted, `aria-busy`, with no Delete. Enter sends only with a fine pointer; on touch, Enter is a line and the button sends. The composer's field is 16 px, like every text field, so iOS does not zoom into it.

## Tooltips

`Tooltip` (one `TooltipProvider` in `App`: the first waits 400 ms, the next opens at once) explains a control or spells out what was truncated. It never carries the only copy of something essential, because touch has no hover; the full gym list a badge counts is also in the event form. A disabled button hears no pointer, so the trigger is a focusable `<span>` around it.

## Do and don't

- Do put every string through `t()` with a key in both `en` and `da`; Danish runs long, check it first.
- Do keep native `<select>` elements native (spec §4): use `NativeSelect`.
- Do confirm anything irreversible through `ConfirmDialog`, and nothing else.
- Do use `Textarea` from `ui/` for multi-line input; it auto-grows.
- Don't add `dark:` classes; there is no dark theme and the variant is gone.
- Don't use `bg-background` on a control; controls sit on `bg-card`.
- Don't reach for `rounded-md`, `h-9`, `shadow-xs` on anything a user touches; those are the pre-facelift defaults. `size="sm"` is for dense desktop-only rows; a control on a phone screen is `default` or `icon`.
- Don't build a row of `aria-pressed` buttons; that is a `ToggleGroup`.
- Don't write a bottom padding for the phone bar; use `pb-(--nav-bar-clearance)`.
- Don't introduce a new colour. If a state needs one, it is one of the five tones.

## Known follow-ups

- The phone bottom bar scrolls sideways past five entries. The fix (five primary tabs plus a More sheet, which needs `sheet` vendored) is logged under Later in `PROJECT_TASKS.md`.
- Also under Later from the 2026-09-04 refinement: `command` for the chat @mention listbox and a search palette, `progress` for checklist completion, `collapsible` for the guide category tree (`scroll-area` for the chat lists is superseded by `message-scroller`, 2026-09-05).
