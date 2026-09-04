-- P7B-02 — one ranked search over news and guides. `security invoker`: the
-- select policies on posts and guides decide what can match, exactly as the
-- two direct queries the client ran until now. `ts_rank` on the generated
-- search_vector puts a title hit above a passing mention.

create function public.content_search(query text)
returns table (
  kind text,
  id uuid,
  title text,
  body_text text,
  status text,
  gym_name text,
  rank real
)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (select websearch_to_tsquery('simple', query) as tsq)
  select * from (
    select 'news'::text as kind, p.id, p.title, p.body_text, p.status::text,
           g.name as gym_name, ts_rank(p.search_vector, q.tsq) as rank
    from public.posts p
    left join public.gyms g on g.id = p.gym_id
    cross join q
    where p.deleted_at is null and p.search_vector @@ q.tsq
    union all
    select 'guide'::text, d.id, d.title, d.body_text, d.status::text,
           g.name, ts_rank(d.search_vector, q.tsq)
    from public.guides d
    left join public.gyms g on g.id = d.gym_id
    cross join q
    where d.deleted_at is null and d.search_vector @@ q.tsq
  ) hits
  order by rank desc, title
  limit 40;
$$;

comment on function public.content_search(text) is
  'Ranked full-text search over posts and guides the caller may read (P7B-02).';

grant execute on function public.content_search(text) to authenticated;
