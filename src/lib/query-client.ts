import { QueryClient } from '@tanstack/react-query'

/**
 * Shared query client. All data access goes through TanStack Query hooks in
 * `features/<x>/queries.ts` (spec §5) — components never call Supabase directly.
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  })
}
