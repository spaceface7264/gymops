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
 * One search over news and guides (P3-06). `websearch_to_tsquery` with the
 * `simple` configuration is the query side of the generated `search_vector`
 * columns — quoted phrases and `-word` work, and neither language is stemmed
 * into the other. RLS decides what can match at all.
 */
export function useContentSearch(query: string) {
  const text = query.trim()

  return useQuery({
    queryKey: searchKeys.query(text),
    enabled: text.length >= minSearchLength,
    queryFn: async (): Promise<SearchHit[]> => {
      const [posts, guides] = await Promise.all([
        supabase
          .from('posts')
          .select('id, title, body_text, status, gyms(name)')
          .textSearch('search_vector', text, { type: 'websearch', config: 'simple' })
          .limit(20),
        supabase
          .from('guides')
          .select('id, title, body_text, status, gyms(name)')
          .textSearch('search_vector', text, { type: 'websearch', config: 'simple' })
          .limit(20),
      ])

      if (posts.error) throw posts.error
      if (guides.error) throw guides.error

      return [
        ...posts.data.map((row) => ({ kind: 'news' as const, row })),
        ...guides.data.map((row) => ({ kind: 'guide' as const, row })),
      ]
        .map(({ kind, row }) => ({
          kind,
          id: row.id,
          title: row.title,
          snippet: snippet(row.body_text, text),
          scopeName: row.gyms?.name ?? null,
          isDraft: row.status === 'draft',
        }))
        .sort((a, b) => a.title.localeCompare(b.title))
    },
  })
}
