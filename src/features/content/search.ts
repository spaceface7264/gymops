import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type SearchHit = {
  kind: 'news' | 'guide'
  id: string
  title: string
  snippet: string
  scopeName: string | null
  isDraft: boolean
}

export const searchKeys = {
  query: (text: string) => ['content', 'search', text] as const,
}

/** Below this a search matches most of the chain and helps nobody. */
export const minSearchLength = 2

/** Keeps the query out of the network until the typing stops. */
export function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}

function snippet(text: string | null, query: string): string {
  const body = (text ?? '').replace(/\s+/g, ' ').trim()
  const word = query.trim().split(/\s+/)[0]?.toLowerCase() ?? ''
  const at = word ? body.toLowerCase().indexOf(word) : -1
  if (at < 0) return body.slice(0, 160)

  const from = Math.max(0, at - 60)
  return `${from > 0 ? '…' : ''}${body.slice(from, from + 160).trim()}${
    from + 160 < body.length ? '…' : ''
  }`
}

/**
 * One search over news and guides (P3-06, ranked in P7B-02).
 * `content_search()` runs `websearch_to_tsquery` with the `simple`
 * configuration against the generated `search_vector` columns — quoted
 * phrases and `-word` work, neither language is stemmed into the other — and
 * orders by `ts_rank`, so a title hit comes before a passing mention. It is
 * `security invoker`: RLS decides what can match at all.
 */
export function useContentSearch(query: string) {
  const text = query.trim()

  return useQuery({
    queryKey: searchKeys.query(text),
    enabled: text.length >= minSearchLength,
    queryFn: async (): Promise<SearchHit[]> => {
      const { data, error } = await supabase.rpc('content_search', { query: text })
      if (error) throw error

      return data.map((row) => ({
        kind: row.kind === 'guide' ? ('guide' as const) : ('news' as const),
        id: row.id,
        title: row.title,
        snippet: snippet(row.body_text, text),
        scopeName: row.gym_name,
        isDraft: row.status === 'draft',
      }))
    },
  })
}
