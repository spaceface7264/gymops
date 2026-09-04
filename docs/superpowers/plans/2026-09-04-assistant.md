# Phase 8 — AI assistant (V1.5) implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (recommended) or superpowers:executing-plans, task by task, tests first. The first implementation step copies this file to `docs/superpowers/plans/2026-09-04-assistant.md` in the repo (the previous phases' plans live there).

## Context

GymOps (`~/coding/gymops`) has phases 1–7c merged. Phase 8 is the last planned V1.5 feature: a read-only Q&A assistant over the published guides and news a person may read, with source links on every answer, an "Ask" page with history, an `@assistant` bot in chat channels, and a per-user daily cap a superadmin can change (`PROJECT_SPEC.md` §2.3, §3 line 84; `PROJECT_TASKS.md` P8-01 … P8-06). Only guide/news text, the question and recent channel messages go to Anthropic; drafts, incidents, daily logs and member data never do.

**Decisions taken while planning (2026-09-04, with Rami):**

- **No bot user.** An assistant reply is a `messages` row with `created_by = null` and a new `from_assistant = true` flag, written by the Edge Function with the service role. The composer offers a fixed `@assistant` suggestion. (Rejected: an `auth.users` + `profiles` row for the bot — it would need a `profiles_select` carve-out, seats in every channel, and a password-less auth user.)
- **The client triggers channel replies.** After the insert, the sender's client calls the `assistant` function with its own JWT, so `search_content`/`read_content` run under the asker's RLS exactly as the spec requires. (Rejected: a pg_net after-insert trigger — no caller JWT, so the tools would need security-definer re-implementations of content visibility, plus Vault secrets.)
- **Ask page streams over SSE via raw `fetch`**; `supabase.functions.invoke` buffers the whole body. The function therefore adds CORS handling (no precedent in the repo).
- **Citations are deterministic:** every `read_content` result of a run is recorded and stored as `assistant_messages.sources`; the model is also told to name the sources it used. Channel replies carry a `Sources:` block of absolute URLs (`SITE_URL`), because `ChatMarkdown` linkifies only bare http(s) URLs.
- **Cap = calls per user per UTC day**, one `assistant_usage` row per call (reserved _before_ the model call, tokens updated after), cap value in a new `app_settings` table (`assistant_daily_cap`, default 50).
- Model `claude-opus-5`, `thinking: { type: 'adaptive' }`, `output_config.effort: 'medium'` (tunable), streaming, `@anthropic-ai/sdk` via `npm:` in Deno. Tools through the SDK's beta `toolRunner` (`betaTool` with raw JSON schema, no zod); a manual `messages.stream` loop is the documented fallback if the beta helper misbehaves under Deno. No `tool_choice` forcing, no prefill; `stop_reason === 'refusal'` becomes a fixed "can't help with that" text. Server-side `fallbacks` deliberately left out (internal Q&A over gym guides; one-line opt-in later).

## Global constraints

- Branch `assistant` in a worktree (`.claude/worktrees/assistant`), dev server on **5174**, one PR. Check `git worktree list` and `gh pr list` first; the two unpushed docs commits on `main` (`0771858`, `eb36f23`) must be pushed or the branch based on them.
- Order: **P8-02 → P8-01 → P8-03 → P8-05 → P8-04 → P8-06** (SQL first so the function is typed against `database.types.ts`; the channel surface before the Ask page because it proves the function end to end without SSE).
- Tests first per task. Gates after every task: `npm run typecheck && npm run lint && npm run format:check && npx vitest run --dir src`; `npm run db:reset && npm run db:test` for SQL tasks; `cd supabase/functions && deno check invite/index.ts notify/index.ts assistant/index.ts && deno lint && deno fmt --check && deno test` for the function.
- Every string via `t()` in both `src/locales/{en,da}/common.json` (parity test `src/lib/i18n.test.ts`). Screens use `PageHeader`/`EmptyState`/`LoadingState`/`StatusBadge` from `@/components`; follow `DESIGN.md` (light only, pills, 44 px targets).
- Components never import `@/lib/supabase`; all data access in `src/features/assistant/queries.ts`.
- Finishing a task = same commit updates `PROJECT_STATE.md` (task row, phase row, decisions log) and, where a decision or layout changed, `PROJECT_SPEC.md` §3.1/§3.2/§4 (see "Docs" at the end). Commits reference the task id, e.g. `feat(assistant): search_content and read_content (P8-02)`.
- Local secrets: add `ANTHROPIC_API_KEY=` to the gitignored `supabase/functions/.env`; serve with `npx supabase functions serve --env-file supabase/functions/.env`. `supabase/seed.sql` seeds no posts or guides, so create two published guides and a post as `admin@gymops.test` before any live check (optional: a local-only `supabase/seeds/local-content.sql` listed in `config.toml` `[db.seed] sql_paths`).

## Verified facts the plan relies on

- `set_created_by()` is `coalesce(new.created_by, auth.uid())` (`supabase/migrations/20260901194004_core_schema.sql:175`) — a service-role insert with no author stays `null`.
- `notify_chat_message()` (`supabase/migrations/20260903140100_chat_notification_trigger.sql`) builds the title from `chat_author_name(new.created_by)`; with a null author that is null and `notifications.title` is `not null`, so an assistant reply in a **DM would fail the insert**. The trigger must return early on `from_assistant`.
- `guard_message_edit()` (`20260903090000_chat_schema.sql`) pins `channel_id/created_by/created_at` for `authenticated`; it must also pin `from_assistant`. `messages_insert` requires `created_by = auth.uid()`; add `and not from_assistant`.
- `content_search(query)` (`20260904090000_content_search.sql`, `security invoker`) returns drafts to publishers; the assistant's `search_content` must filter `status = 'published'`.
- `chat_overview()` marks anything not by `auth.uid()` unread; the asker has the channel open and `useMarkChannelRead` follows the newest row, so nothing to change.
- Edge Function house style: `supabase/functions/{invite,notify}/index.ts`, `deno.json` import map (`jsr:` / `npm:`; fmt: no semicolons, single quotes, width 90), committed `deno.lock`, `Deno.env.get`, errors `{ error: '<snake_code>' }`, `config.toml` `[functions.<name>]` blocks, CI `functions` job with an explicit `deno check` file list (`.github/workflows/ci.yml`).
- Client precedent for calling a function and reading its error body: `src/features/admin/queries.ts` ~221–250 (`useInviteUser`, `readProblem`).
- `useSendMessage` (`src/features/chat/queries.ts:576`) returns `void`; P8-05 needs the new message id. `messageColumns` (line 86) is one literal string. `src/routes/nav.ts` has a closed `labelKey` union and `fullBleedRoutes = ['/chat']`; `src/routes/admin-page.tsx` has a `sections` array with `superadminOnly` and exports `RequireSuperadmin`.
- Feature module template: `src/features/events/` (key factory, `useEventWrite` invalidation wrapper, barrel). Unit-test template: `src/features/events/events.test.tsx` (`vi.mock('@/lib/supabase')` chain builder), `src/test/render.tsx` `renderWithProviders`. pgTAP helpers: `tests.create_user`, `tests.authenticate_as`, `tests.clear_authentication`; next test numbers `240-`, `250-`; 475 assertions today.

---

## P8-02 — `search_content` / `read_content` (S)

**Files:** create `supabase/migrations/20260904120000_assistant_content_tools.sql`, `supabase/tests/240-assistant-content-tools.test.sql`; regenerate `src/lib/database.types.ts`.

```sql
create function public.search_content(query text)
returns table (kind text, id uuid, title text, snippet text, gym_name text)
language sql stable security invoker set search_path = '' as $$
  select s.kind, s.id, s.title,
         left(regexp_replace(s.body_text, '\s+', ' ', 'g'), 300), s.gym_name
  from public.content_search(query) s
  where s.status = 'published'
  limit 10;
$$;

create function public.read_content(target_kind text, target_id uuid)
returns table (title text, body_text text, gym_name text, published_at timestamptz)
language sql stable security invoker set search_path = '' as $$
  select p.title, p.body_text, g.name, p.published_at
  from public.posts p left join public.gyms g on g.id = p.gym_id
  where target_kind = 'news' and p.id = target_id and p.deleted_at is null and p.status = 'published'
  union all
  select d.title, d.body_text, g.name, d.published_at
  from public.guides d left join public.gyms g on g.id = d.gym_id
  where target_kind = 'guide' and d.id = target_id and d.deleted_at is null and d.status = 'published';
$$;
grant execute on function public.search_content(text) to authenticated;
grant execute on function public.read_content(text, uuid) to authenticated;
```

Both `security invoker`: the posts/guides RLS is the whole visibility filter; the status test is the one difference from `content_search`.

**pgTAP first** (`240-`, reuse the 230 fixture — published posts, a draft, a Gym B guide, users admin + staff_a; `plan(10)`): both functions exist and are not definer; staff_a's `search_content('chalk')` = the published hits, title hit first; admin gets no draft; snippet ≤ 300 chars, no newline; `read_content('news', published)` = 1 row; `read_content('news', draft)` as admin = 0; staff_a reading the Gym B guide = 0 (RLS); wrong kind = 0; `function_privs_are` authenticated = EXECUTE.

**Verify:** `npm run db:reset && npm run db:test` → 485; `npm run db:types`, commit.

---

## P8-01 — Schema: settings, conversations, messages, usage, `messages.from_assistant` (S)

**Files:** create `supabase/migrations/20260904130000_assistant_schema.sql`, `supabase/tests/250-assistant-permissions.test.sql`; modify `supabase/tests/200-chat-notifications.test.sql` (+2 assertions); regenerate `database.types.ts`; reword P8-01 in `PROJECT_TASKS.md` ("bot profile" → `messages.from_assistant`).

```sql
-- settings: one row per tunable; authenticated read, superadmin update, no insert/delete policy
create table public.app_settings (
  key text primary key, value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles on delete set null);
insert into public.app_settings (key, value) values ('assistant_daily_cap', '50'::jsonb);
-- trigger: set_updated_at + a stamp trigger `new.updated_by := auth.uid()`
-- policies: app_settings_select using (is_active_user()); app_settings_update using/with check (is_superadmin())

create table public.assistant_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  title text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index on public.assistant_conversations (user_id, updated_at desc);

create table public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.assistant_conversations on delete cascade,
  role text not null check (role in ('user','assistant')),
  body text not null,
  sources jsonb not null default '[]'::jsonb,   -- [{kind, id, title}] read during the run
  created_at timestamptz not null default now());
create index on public.assistant_messages (conversation_id, created_at);
-- policies: conversations select/delete where user_id = auth.uid(); messages select via owning conversation.
-- No insert policies for authenticated: only the function (service role) writes.

create table public.assistant_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  surface text not null check (surface in ('ask','channel')),
  conversation_id uuid references public.assistant_conversations on delete set null,
  channel_id uuid references public.channels on delete set null,
  model text not null,
  input_tokens int not null default 0, output_tokens int not null default 0,
  cache_creation_input_tokens int not null default 0, cache_read_input_tokens int not null default 0,
  created_at timestamptz not null default now());
create index on public.assistant_usage (user_id, created_at desc);
create index on public.assistant_usage (created_at desc);
-- policy: assistant_usage_select using (user_id = auth.uid() or is_superadmin()); no insert policy.

create function public.assistant_quota() returns table (used int, cap int)
language sql stable security definer set search_path = '' as $$
  select (select count(*)::int from public.assistant_usage
          where user_id = auth.uid() and created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc'),
         (select coalesce((value #>> '{}')::int, 50) from public.app_settings where key = 'assistant_daily_cap');
$$;
grant execute on function public.assistant_quota() to authenticated;

alter table public.messages add column from_assistant boolean not null default false;
-- messages_insert: … and created_by = auth.uid() and not from_assistant
-- guard_message_edit(): create or replace, add `new.from_assistant := old.from_assistant;` beside the created_by pin
-- notify_chat_message(): create or replace, first line `if new.from_assistant then return null; end if;`
```

`user_id` references `profiles` (not `auth.users`) so PostgREST can embed `profiles(full_name, email)` in the P8-06 table, as `messages.created_by` does.

**pgTAP first** (`250-`, users owner / other / super; ~20 assertions): settings row reads 50; owner's update changes 0 rows, super's sticks with `updated_by = super`; owner insert throws 42501. Conversations/messages inserted as postgres: owner sees them, other sees none, owner insert throws 42501, owner delete cascades. Usage: owner sees own 3, super sees all 4, insert throws; `assistant_quota()` = (2, 50) then (2, 20) after super changes the cap. Messages: default false; owner inserting `from_assistant = true` throws 42501; postgres insert with `from_assistant = true` has `created_by is null`; the flag survives an update; a moderator can still soft-delete it. `200-chat-notifications`: assistant rows in the DM and the gym channel raise no notification (the not-null-title regression guard).

**Verify:** `db:reset && db:test`; `db:types` diff shows the tables, `app_settings`, `assistant_quota`, `messages.from_assistant`.

---

## P8-03 — Edge Function `assistant` (L)

**Files:** create `supabase/functions/assistant/{index.ts,run.ts,prompt.ts,sse.ts,index.test.ts}`; modify `supabase/functions/deno.json` (add `"@anthropic-ai/sdk": "npm:@anthropic-ai/sdk@^<current>"` and `"@anthropic-ai/sdk/": "npm:/@anthropic-ai/sdk@^<current>/"` so the `helpers/beta/json-schema` subpath resolves; `npm view @anthropic-ai/sdk version` first), `deno.lock` (regenerated, commit), `supabase/config.toml` (`[functions.assistant] enabled = true / verify_jwt = true`), `.github/workflows/ci.yml` (add `assistant/index.ts` to `deno check`; add a `deno test` step), `CLAUDE.md`/`README.md` (the key in `functions/.env`).

**Contract** (`POST /functions/v1/assistant`, headers `Authorization: Bearer <user JWT>`, `apikey`):

- `{ surface: 'ask', question, conversation_id? }` → `200 text/event-stream`, or a JSON error before the stream opens.
- `{ surface: 'channel', channel_id, message_id }` → `200 { message_id }` (plain JSON; nobody watches a stream here, so `functions.invoke` is fine).
- `OPTIONS` → 204. CORS on every response: `Access-Control-Allow-Origin: *` (the desktop origin is `tauri://localhost`; the JWT is the gate), `Allow-Headers: authorization, apikey, content-type, x-client-info`, `Allow-Methods: POST, OPTIONS`.
- Errors `{ error }`: 405 `method_not_allowed`; 401 `unauthenticated` (no token, `auth.getUser` fails, inactive profile); 400 `invalid_request` (shape, empty or >4000-char question, bad uuid); 404 `conversation_not_found` / `message_not_found` (caller-JWT select returned nothing, covers "not yours"); 400 `not_a_mention` (message not by caller or no `@assistant`); 429 `cap_reached` (+ `used`, `cap`); 503 `assistant_not_configured` (no key — notify's "skipped" spirit); 503 `upstream_busy` (`Anthropic.RateLimitError`, `APIConnectionTimeoutError`); 502 `upstream_error` (other `Anthropic.APIError` / `APIConnectionError`, log status + message); 500 `not_recorded` (a service-role insert failed). `instanceof` most-specific first, no string matching.

**SSE frames** (`sse.ts`: `event: <name>\ndata: <json>\n\n`; `: ping\n\n` every 15 s during tool loops):
`delta {text}` · `sources {sources:[{kind,id,title}]}` (once, before done) · `done {conversation_id, message_id, usage:{input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens}}` · `error {error}` then close. Headers `text/event-stream`, `cache-control: no-cache`, `x-accel-buffering: no`. Return the `Response(new ReadableStream({ start }))` immediately; all work inside `start`. Failures before the first frame are JSON statuses; after it, an `error` event.

**`index.ts` flow:** OPTIONS/method → token → `service` client (`SUPABASE_SERVICE_ROLE_KEY`) + `service.auth.getUser(token)` + `profiles.active` (copy invite's `readCaller` shape) → `caller` client (`SUPABASE_ANON_KEY`, `global.headers.Authorization`, `persistSession: false`) — **every read and every tool call goes through `caller`** → `parse()` → `caller.rpc('assistant_quota')` → 429 if `used >= cap` → load surface → reserve a usage row with `service` (tokens 0) → run → persist → update tokens (also in `catch`).

- _Ask:_ existing `conversation_id` must be selectable by `caller` (else 404); otherwise `service` inserts `{ user_id, title: question.slice(0,80) }`. History = `caller` select `role, body` ordered, `limit 40`, as plain text `MessageParam`s + the new question. Insert the user turn **before** the model call. After: insert the assistant turn with `sources`, bump `updated_at`, emit `sources`, `done`.
- _Channel:_ `caller` selects the message (`id, body, created_by`, not deleted, in that channel) → 404; `created_by === user.id` and `/@assistant\b/i.test(body)` → else 400. Context = last 20 non-deleted messages via `caller` with `author:created_by(full_name)`, reversed, rendered as one user turn (`[HH:MM] Name: body`, assistant rows as `Assistant:`; "answer the last line, which mentions you"). Reply body = answer + `\n\nSources:\n- <title>: ${SITE_URL}/guides/<id>` per source (bare URLs on their own lines). `service.from('messages').insert({ channel_id, body, from_assistant: true, mentions: [] })`; Realtime (`use-channel-live.ts`) delivers it to every open client unchanged.

**`run.ts`:** `new Anthropic({ apiKey, maxRetries: 1, timeout: 90_000 })`. Tools via `betaTool` from `@anthropic-ai/sdk/helpers/beta/json-schema`:

- `search_content({ query })` → `caller.rpc('search_content', { query })`; returns JSON of hits or "No published content matches."; on error returns `{ error: 'search_failed' }` text (never throws — the model can say so). Description tells it to search in the content's language (Danish or English) and retry with other words.
- `read_content({ kind: enum news|guide, id })` → `caller.rpc('read_content', { target_kind, target_id })`; pushes `{kind,id,title}` to the run's `sources`; returns the row with `body_text` cut at 12 000 chars; "Not found or not readable." otherwise.
- `client.beta.messages.toolRunner({ model: 'claude-opus-5', max_tokens: 4096, max_iterations: 6, thinking: { type: 'adaptive' }, output_config: { effort: 'medium' }, system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }], tools, messages, stream: true })`; outer `for await (const stream of runner)`, inner event loop forwards `text_delta`s to `onDelta` and accumulates `text`; `await stream.finalMessage()` per iteration sums the four usage fields; `refusal` → fixed text; `max_tokens` → append a short "answer cut short" line. Streamed text and persisted text are the same string.
- `prompt.ts`: frozen `SYSTEM_PROMPT` (no per-user text, no dates): GymOps internal assistant for a bouldering chain; use `search_content` then `read_content`; answer only from what was read, else say so and point to a manager; answer in the question's language; short; name the source titles used; don't narrate tool calls; never invent policy.
- **Fallback** if the beta runner fails under Deno (subpath resolution or iterator wiring): keep `{ definition, run }` pairs and swap `run.ts` for a manual loop — `client.messages.stream(...)`, forward deltas, `finalMessage()`, sum usage, break unless `stop_reason === 'tool_use'`, push assistant content, execute `tool_use` blocks, push **one** user message with all `tool_result`s (`is_error: true` on failure), hard `max_iterations`. Nothing outside `run.ts` changes.

**Tests first** (`index.test.ts`, `Deno.test` + `jsr:@std/assert`; new CI step `deno test`): pure exports `parse()`, `renderTranscript()`, `replyBody()`, `toCode()`, `frame()`: OPTIONS → 204 + CORS; bad JSON → 400; 4001-char question and non-uuid rejected; `replyBody` renders `Sources:` as bare `SITE_URL` URLs; `toCode(RateLimitError)` → 503; frame bytes exact.

**Verify:** deno gates; `functions serve`; JWT via `curl …/auth/v1/token?grant_type=password` as `staff@gymops.test`; `curl -N` the ask surface — deltas arrive incrementally, then `sources`, `done`; rows in the three tables; a second call within 5 min shows `cache_read_input_tokens > 0` (if 0, the `tools + system` prefix is under the model's minimum cacheable size — lengthen the frozen prompt, never add per-request text); staff asking about a Gym B guide gets "nothing found"; `update app_settings set value='2'` → third call 429.

---

## P8-05 — `@assistant` in channels (M)

**Files:** create `src/features/assistant/queries.ts` (`useAssistantReply`, `AssistantError`, `readProblem` copied from admin) and `index.ts`; modify `src/features/chat/queries.ts` (`messageColumns` + `from_assistant`, `Message` type, `useSendMessage` returns the id, export `mentionsAssistant = (body) => /@assistant\b/i.test(body)`), `composer.tsx` (a first suggestion row `@assistant — t('chat.askAssistant')` when the query is a prefix of "assistant"; choosing inserts `@assistant `; never added to `mentions`; new prop `onSent(messageId, body)`), `chat-page.tsx` (`useAssistantReply()`; `onSent` calls it when `mentionsAssistant(body)`; pending line `aria-live="polite"` `chat.assistantAnswering`; error `role="alert"` mapping `cap_reached` → `chat.assistantCapReached` else `chat.assistantFailed`), `message-list.tsx` (author = `t('chat.assistant')` + a `Sparkles` icon when `from_assistant`; Edit already hidden since not `mine`; Delete stays for moderators), `chat/index.ts`, locales (`chat.assistant` Assistant/Assistent, `chat.askAssistant`, `chat.assistantAnswering`, `chat.assistantFailed`, `chat.assistantCapReached`), `chat.test.tsx`.

`useAssistantReply` = `useMutation` over `supabase.functions.invoke('assistant', { body: { surface: 'channel', channel_id, message_id } })`; errors mapped through `readProblem` to `AssistantProblem = 'cap_reached' | 'upstream_busy' | 'upstream_error' | 'not_configured' | 'unknown'`. No invalidation: the reply arrives via Realtime.

**Vitest first** (extend `chat.test.tsx`; add `functions: { invoke: vi.fn() }` to the mock): `@ass` shows the option, Enter inserts `@assistant `, `mentions` stays empty; sending a mention inserts, then `invoke` is called with the new id and the pending text shows; a message without the handle never calls `invoke`; `invoke` rejecting with `context.json()` → `{ error: 'cap_reached' }` shows the cap alert; a `from_assistant` row renders "Assistant", no Edit, Delete for a moderator.

**Verify:** unit gates; in the browser with `functions serve`: `@assistant …` in `#company` as staff → reply appears for the sender and in a second window; a DM mention works and `notifications` count is unchanged; the `Sources:` URLs are clickable; cap reached shows the alert.

---

## P8-04 — Ask page (M)

**Files:** extend `src/features/assistant/queries.ts` (`assistantKeys`, `useConversations`, `useConversationMessages`, `useDeleteConversation`, `useAssistantQuota`, `askStream()`); create `sse.ts` (`parseSse(buffer) → { events, rest }`, pure), `use-ask.ts`, `ask-page.tsx`, `conversation-list.tsx`, `thread.tsx`, `ask-composer.tsx`, `sources.tsx`, `ask.test.tsx`, `sse.test.ts`; modify `src/routes/router.tsx` (`ask`, `ask/:conversationId`), `src/routes/nav.ts` (`'nav.ask'` in the union; entry `{ to: '/ask', labelKey: 'nav.ask', icon: Sparkles }` after chat; `fullBleedRoutes = ['/chat', '/ask']`), locales (`nav.ask` Ask/Spørg; `assistant.*`: title, description, newConversation, conversations, noConversations, empty, write, send, thinking, sources, quota `"{{used}} of {{cap}} today"`, capReached, failed, notConfigured, deleteConversation, back, untitled, stop), `DESIGN.md` layout line.

- `askStream({ question, conversationId, signal })`: `supabase.auth.getSession()` first (refreshes an expiring token — the function pins it for the whole run), then `fetch(`${VITE_SUPABASE_URL}/functions/v1/assistant`, { method: 'POST', headers: { Authorization, apikey: VITE_SUPABASE_PUBLISHABLE_KEY, 'content-type' }, body, signal })`; `!ok` → read JSON, throw `AssistantError`; else return `response.body`.
- `useAsk()`: `useReducer` `{ status: idle|streaming|done|error, text, sources, problem }`; reader + `TextDecoder` + `parseSse`; on `done` invalidate conversations, messages(id), quota and resolve `{ conversationId }`; `AbortController` for unmount and a Stop button.
- Layout mirrors `chat-page.tsx` (full-bleed, two panes from `md`, phone shows list at `/ask` and thread at `/ask/:id` with a back button, no `PageHeader`). Left: heading, "New conversation", list (title or `assistant.untitled`, relative time), `EmptyState`, quota line. Right: thread (`LoadingState`; user bubbles right `bg-accent`, assistant bubbles `bg-card` border; streaming bubble shows `assistant.thinking` until the first delta), `Sources` links (`/guides/:id` | `/news/:id`, dedupe by id) under each assistant turn, composer (auto-grow `Textarea`, Enter sends, `size="icon"` send button disabled while streaming, Stop while streaming), error line `role="alert"`. `/ask` with no conversation shows `EmptyState` above the composer; the first `done` navigates to `/ask/:conversation_id`.

**Vitest first:** `sse.test.ts` — one frame; two frames in one chunk; a frame split mid-`data:` (rest carried); `: ping` ignored; no `event:` line ignored. `ask.test.tsx` (`vi.stubGlobal('fetch')` returning a `Response` over a `ReadableStream` of `delta`/`sources`/`done` frames; mock `auth.getSession`, `rpc`, `from` chain): list newest-first and empty state; `/ask/c1` shows messages and `/guides/g1` links; Enter calls `fetch` with the right method/headers/body, text grows, `done` navigates; 429 body shows `assistant.capReached`; a mid-stream `error` event shows `assistant.failed` and re-enables the composer; quota line "3 of 50 today".

**Verify:** gates; in Chrome on 5174 with `functions serve`: tokens visibly stream, sources link to the right guide, reload shows the persisted turn, 390 px width shows list vs thread, Danish fits. Note in the task row that the nav now has ten entries (the five-tab More sheet stays under Later).

---

## P8-06 — Superadmin cap + usage view (S)

**Files:** extend `queries.ts` (`useAssistantSettings` — `app_settings` where key = `assistant_daily_cap`, single; `useSetDailyCap` — update `{ value }`, invalidate settings + quota; `useAssistantUsage(days = 30)` — select the token columns + `profiles:user_id(full_name, email)` since now−30 d, aggregate client-side per user sorted by calls desc plus a total); create `usage-panel.tsx` (`AssistantUsagePanel`: `h2 admin.usage.title`; a `Card` with the cap `Input type="number" min=1 max=1000` + Save and saved/failed feedback; a `Table` in `admin/audit-panel.tsx` style: user / calls / input / output / cache read with `toLocaleString(i18n.language)`, total row, `EmptyState`, `LoadingState rows={6}`), `usage.test.tsx`; modify `src/routes/admin-page.tsx` (`'admin.usage.title'` in the union; `{ to: '/admin/usage', labelKey: 'admin.usage.title', superadminOnly: true }`), `router.tsx` (`usage` under admin in `RequireSuperadmin`), locales (`admin.usage.*`: title "Assistant usage"/"Assistent-forbrug", cap, capHint "Calls per person per day (UTC)", save, saved, saveFailed, last30Days, user, calls, inputTokens, outputTokens, cacheRead, total, empty).

**Vitest first:** cap input shows 50; changing to 20 + Save issues `update` with `eq('key','assistant_daily_cap')` and shows saved; two rows for one user collapse to one line with summed tokens, a second user is a second line, the total row sums; empty → `admin.usage.empty`; superadmin sees the Usage tab, an admin does not.

**Verify:** as `super@` set the cap to 1 → the second call is 429 on both surfaces, the table shows names; as `admin@`, `/admin/usage` redirects to `/`.

---

## Docs (same commits as the task they belong to)

- `PROJECT_STATE.md`: task rows P8-01…06 with dates and test counts; phase row → ✅ when done; the "Anthropic API key" blocker stays until the hosted secret exists; "Hosted project cutover" gains `supabase secrets set ANTHROPIC_API_KEY=…` and `supabase functions deploy assistant`; decisions log: flag not bot user; client-triggered reply not pg_net; raw `fetch` for SSE; deterministic sources from `read_content`; cap counted at call start.
- `PROJECT_SPEC.md`: §3.1 add `app_settings`, `messages.from_assistant`, `assistant_quota()`, `search_content`/`read_content`; §4 rejected rows: bot auth user/profile; pg_net trigger for the reply; `functions.invoke` for the Ask page (buffers).
- `PROJECT_TASKS.md`: P8-01 wording. `CLAUDE.md`: `functions/.env` carries `ANTHROPIC_API_KEY`; `/ask` is full-bleed. `README.md`: the local `.env` line. `DESIGN.md`: full-bleed routes.

## Risks to watch

1. **Streaming through the gateway** — verify with `curl -N` that deltas do not arrive in one burst; heartbeats keep idle proxies from cutting tool loops.
2. **`npm:@anthropic-ai/sdk` under Deno** — prove `deno check` + one live call on day one; the manual loop is the swap.
3. **Wall clock** — hosted functions have a plan-dependent per-request limit (about 150 s on the lower tier); bounds are `max_iterations 6`, `max_tokens 4096`, search `limit 10`, reads cut at 12 k chars, client timeout 90 s, `maxRetries 1`.
4. **Cache prefix size** — check `cache_read_input_tokens` on the second call; grow the frozen prompt if 0.
5. **Cap race** — reserving the usage row before the call narrows it to milliseconds; a hard cap (`for update` in a definer function) is not worth it at 50/day.
6. **JWT expiry mid-run** — the tool returns the RLS error as text, so the model says it could not read rather than the function crashing; the client refreshes the session before every call.
7. **The DM not-null crash** and the `messages_insert` / `guard_message_edit` hardening are not optional; the pgTAP rows in 250 and 200 guard them.
