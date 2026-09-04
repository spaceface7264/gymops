-- P8-02 — what the assistant may see: published news and guides the caller can
-- read, and nothing else (spec §2.3).
--
-- Both run as the caller. The select policies on posts and guides are the
-- whole of the gym and deletion filter, exactly as for content_search()
-- (P7B-02); the one thing added here is `status = 'published'`, because a
-- publisher searching by hand should find their draft and an assistant
-- answering a question must never quote one. The snippet is the flattened
-- body on one line, enough for the model to judge a hit without reading it.
--
-- Tested by supabase/tests/240-assistant-content-tools.test.sql.

create function public.search_content(query text)
returns table (kind text, id uuid, title text, snippet text, gym_name text)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.kind, s.id, s.title,
         left(regexp_replace(s.body_text, '\s+', ' ', 'g'), 300) as snippet,
         s.gym_name
  from public.content_search(query) s
  where s.status = 'published'
  limit 10;
$$;

comment on function public.search_content(text) is
  'The assistant''s search: published posts and guides the caller may read (P8-02).';

create function public.read_content(target_kind text, target_id uuid)
returns table (title text, body_text text, gym_name text, published_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.title, p.body_text, g.name, p.published_at
  from public.posts p
  left join public.gyms g on g.id = p.gym_id
  where target_kind = 'news' and p.id = target_id
    and p.deleted_at is null and p.status = 'published'
  union all
  select d.title, d.body_text, g.name, d.published_at
  from public.guides d
  left join public.gyms g on g.id = d.gym_id
  where target_kind = 'guide' and d.id = target_id
    and d.deleted_at is null and d.status = 'published';
$$;

comment on function public.read_content(text, uuid) is
  'The assistant''s reader: one published post or guide the caller may read (P8-02).';

grant execute on function public.search_content(text) to authenticated;
grant execute on function public.read_content(text, uuid) to authenticated;
