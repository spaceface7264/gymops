-- P3-02 — news and guides: posts, post_reads, guide_categories, guides,
-- guide_acks, with the generated body_text/search columns everything in
-- phase 3 searches over.
--
-- Permission matrix: PROJECT_SPEC.md §2.1, rows "Publish company-wide
-- news/guides", "Publish gym news/guides" and "See acknowledgement reports".
-- Tested by supabase/tests/040-content-permissions.test.sql.

-- ============================================================ enum types ==

create type public.content_status as enum ('draft', 'published');

-- ====================================================== helper functions ==

-- Rich text is Tiptap JSON (spec §5). This flattens it to the words a human
-- typed, so body_text and the search vector can be generated columns instead
-- of something the client has to keep in sync. Lax jsonpath: a document with
-- no text nodes yields no rows rather than an error.
create function public.tiptap_text(doc jsonb)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(string_agg(node #>> '{}', ' '), '')
  from jsonb_path_query(coalesce(doc, '{}'::jsonb), 'strict $.**.text', '{}', true) as node
  where jsonb_typeof(node) = 'string';
$$;

comment on function public.tiptap_text(jsonb) is
  'Plain text of a Tiptap document, for body_text and full-text search.';

-- 'simple' rather than 'english' or 'danish': authors write in whichever
-- language they please (spec §2.2) and one stemmer applied to the other
-- language matches worse than no stemmer at all.
create function public.content_search_vector(title text, doc jsonb)
returns tsvector
language sql
immutable
parallel safe
set search_path = ''
as $$
  select setweight(to_tsvector('simple', coalesce(title, '')), 'A')
      || setweight(to_tsvector('simple', public.tiptap_text(doc)), 'B');
$$;

-- ================================================================ tables ==

-- gym_id null = company-wide, visible to everyone (spec §2.1).
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid references public.gyms on delete cascade,
  title text not null,
  body jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  body_text text generated always as (public.tiptap_text(body)) stored,
  search_vector tsvector generated always as (public.content_search_vector(title, body)) stored,
  status public.content_status not null default 'draft',
  published_at timestamptz,
  pinned boolean not null default false,
  requires_ack boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users on delete set null,
  updated_by uuid references auth.users on delete set null,
  deleted_at timestamptz
);

comment on table public.posts is 'News posts, per gym or company-wide. Soft deleted.';

create index posts_feed_idx on public.posts (gym_id, published_at desc) where deleted_at is null;
create index posts_search_idx on public.posts using gin (search_vector);

-- One row per person per post: read_at is set by opening it, acknowledged_at
-- by the acknowledgement button (P3-04). A post with requires_ack false only
-- ever gets read_at.
create table public.post_reads (
  post_id uuid not null references public.posts on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  read_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  primary key (post_id, user_id)
);

create index post_reads_user_idx on public.post_reads (user_id);

-- One tree mixing company and gym categories (spec §2.2).
create table public.guide_categories (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid references public.gyms on delete cascade,
  parent_id uuid references public.guide_categories on delete restrict,
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users on delete set null,
  updated_by uuid references auth.users on delete set null
);

create index guide_categories_parent_idx on public.guide_categories (parent_id, position);

create table public.guides (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid references public.gyms on delete cascade,
  category_id uuid references public.guide_categories on delete restrict,
  title text not null,
  body jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  body_text text generated always as (public.tiptap_text(body)) stored,
  search_vector tsvector generated always as (public.content_search_vector(title, body)) stored,
  status public.content_status not null default 'draft',
  published_at timestamptz,
  requires_ack boolean not null default false,
  -- Bumped by the editor when a change is significant enough that everyone
  -- must confirm it again; guide_acks records which version was confirmed.
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users on delete set null,
  updated_by uuid references auth.users on delete set null,
  deleted_at timestamptz
);

comment on table public.guides is 'Guides and how-to pages. Soft deleted; version drives re-acknowledgement.';

create index guides_category_idx on public.guides (category_id, title) where deleted_at is null;
create index guides_search_idx on public.guides using gin (search_vector);

-- One row per person per guide, holding the last version they confirmed: a
-- guide whose version is ahead needs confirming again.
create table public.guide_acks (
  guide_id uuid not null references public.guides on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  version integer not null,
  acknowledged_at timestamptz not null default now(),
  primary key (guide_id, user_id)
);

create index guide_acks_user_idx on public.guide_acks (user_id);

-- ============================================================== triggers ==

create trigger posts_set_updated_at before update on public.posts
  for each row execute function public.set_updated_at();
create trigger posts_set_created_by before insert on public.posts
  for each row execute function public.set_created_by();

create trigger guide_categories_set_updated_at before update on public.guide_categories
  for each row execute function public.set_updated_at();
create trigger guide_categories_set_created_by before insert on public.guide_categories
  for each row execute function public.set_created_by();

create trigger guides_set_updated_at before update on public.guides
  for each row execute function public.set_updated_at();
create trigger guides_set_created_by before insert on public.guides
  for each row execute function public.set_created_by();

-- Publishing stamps published_at once, and unpublishing back to draft clears
-- it, so "when did staff first see this" is not a guess.
create function public.set_published_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  elsif new.status = 'draft' then
    new.published_at := null;
  end if;
  return new;
end;
$$;

create trigger posts_set_published_at before insert or update on public.posts
  for each row execute function public.set_published_at();
create trigger guides_set_published_at before insert or update on public.guides
  for each row execute function public.set_published_at();

-- ================================================================== RLS ==

alter table public.posts enable row level security;
alter table public.post_reads enable row level security;
alter table public.guide_categories enable row level security;
alter table public.guides enable row level security;
alter table public.guide_acks enable row level security;

-- Who may publish here: an admin anywhere, a manager in the gyms they manage.
-- Company-wide content (gym_id null) is admins only, which is the §2.1 row
-- "Publish company-wide news/guides".
create function public.can_publish_content(target_gym_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.is_admin()
    or (target_gym_id is not null and target_gym_id in (select public.managed_gym_ids()));
$$;

-- Who may read published content here: everyone for company-wide, the gym's
-- own members otherwise. Admins read every gym's.
create function public.can_read_content(target_gym_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select target_gym_id is null
    or public.is_admin()
    or target_gym_id in (select public.member_gym_ids());
$$;

grant execute on function
  public.can_publish_content(uuid), public.can_read_content(uuid),
  public.tiptap_text(jsonb), public.content_search_vector(text, jsonb)
to authenticated;

-- posts: published content to its audience; drafts only to the people who may
-- edit them. Soft-deleted rows are invisible to every client.
create policy posts_select on public.posts
  for select to authenticated using (
    deleted_at is null
    and (
      (status = 'published' and public.can_read_content(gym_id))
      or public.can_publish_content(gym_id)
    )
  );

create policy posts_insert on public.posts
  for insert to authenticated with check (public.can_publish_content(gym_id));

-- Both sides checked, so a post cannot be moved into a gym the editor does
-- not run, nor out of one they do.
create policy posts_update on public.posts
  for update to authenticated
  using (public.can_publish_content(gym_id))
  with check (public.can_publish_content(gym_id));

-- No delete policy: deleting is setting deleted_at (spec §2.5).

-- post_reads: your own row is yours to write. Reading someone else's is the
-- acknowledgement report — admins, and managers for their own gyms' people.
create policy post_reads_select on public.post_reads
  for select to authenticated using (
    user_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.gym_memberships m
      where m.user_id = post_reads.user_id
        and m.gym_id in (select public.managed_gym_ids())
    )
  );

create policy post_reads_insert on public.post_reads
  for insert to authenticated with check (user_id = auth.uid());

create policy post_reads_update on public.post_reads
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- guide_categories: the tree everyone browses; only publishers reshape it.
create policy guide_categories_select on public.guide_categories
  for select to authenticated using (public.can_read_content(gym_id));

create policy guide_categories_insert on public.guide_categories
  for insert to authenticated with check (public.can_publish_content(gym_id));

create policy guide_categories_update on public.guide_categories
  for update to authenticated
  using (public.can_publish_content(gym_id))
  with check (public.can_publish_content(gym_id));

create policy guide_categories_delete on public.guide_categories
  for delete to authenticated using (public.can_publish_content(gym_id));

create policy guides_select on public.guides
  for select to authenticated using (
    deleted_at is null
    and (
      (status = 'published' and public.can_read_content(gym_id))
      or public.can_publish_content(gym_id)
    )
  );

create policy guides_insert on public.guides
  for insert to authenticated with check (public.can_publish_content(gym_id));

create policy guides_update on public.guides
  for update to authenticated
  using (public.can_publish_content(gym_id))
  with check (public.can_publish_content(gym_id));

create policy guide_acks_select on public.guide_acks
  for select to authenticated using (
    user_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.gym_memberships m
      where m.user_id = guide_acks.user_id
        and m.gym_id in (select public.managed_gym_ids())
    )
  );

create policy guide_acks_insert on public.guide_acks
  for insert to authenticated with check (user_id = auth.uid());

create policy guide_acks_update on public.guide_acks
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
