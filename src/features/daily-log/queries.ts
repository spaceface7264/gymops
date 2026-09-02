import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Database } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

type EntryRow = Database['public']['Tables']['daily_log_entries']['Row']

export type DailyLogKind = Database['public']['Enums']['daily_log_kind']

export const dailyLogKinds: DailyLogKind[] = ['handover', 'note', 'issue']

export type DailyLogEntry = Pick<
  EntryRow,
  'id' | 'gym_id' | 'kind' | 'body' | 'tags' | 'created_at' | 'updated_at' | 'created_by'
> & {
  gyms: { id: string; name: string; timezone: string } | null
  // Named, because `created_by` and `updated_by` both point at `profiles` and
  // an unqualified embed would not know which one is meant.
  author: { id: string; full_name: string | null } | null
}

export type DailyLogInput = {
  gymId: string
  kind: DailyLogKind
  body: string
  tags: string[]
}

const entryColumns =
  'id, gym_id, kind, body, tags, created_at, updated_at, created_by, gyms(id, name, timezone), author:profiles!daily_log_entries_created_by_fkey(id, full_name)'

export const dailyLogKeys = {
  all: ['daily-log'] as const,
  list: (gymId: string | null, kind: DailyLogKind | 'all', tag: string | null) =>
    ['daily-log', 'list', gymId ?? 'all', kind, tag ?? 'any'] as const,
  latest: (gymId: string | null) => ['daily-log', 'latest', gymId ?? 'all'] as const,
}

/** The gym's timeline, newest first. Deleted entries are left out here. */
export function useDailyLog(
  gymId: string | null,
  filters: { kind: DailyLogKind | 'all'; tag: string | null } = {
    kind: 'all',
    tag: null,
  },
) {
  return useQuery({
    queryKey: dailyLogKeys.list(gymId, filters.kind, filters.tag),
    queryFn: async () => {
      let query = supabase
        .from('daily_log_entries')
        .select(entryColumns)
        // A removed entry stays visible to its author and the gym's managers,
        // which is what lets them remove it (20260902171000).
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(100)

      if (gymId) query = query.eq('gym_id', gymId)
      if (filters.kind !== 'all') query = query.eq('kind', filters.kind)
      if (filters.tag) query = query.contains('tags', [filters.tag])

      const { data, error } = await query
      if (error) throw error
      return data
    },
  })
}

/** The last thing written here, for the home page (P4-10). */
export function useLatestLogEntry(gymId: string | null) {
  return useQuery({
    queryKey: dailyLogKeys.latest(gymId),
    queryFn: async () => {
      let query = supabase
        .from('daily_log_entries')
        .select(entryColumns)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1)

      if (gymId) query = query.eq('gym_id', gymId)

      const { data, error } = await query
      if (error) throw error
      return data[0] ?? null
    },
  })
}

function useLogWrite<TVariables>(mutationFn: (variables: TVariables) => Promise<void>) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: dailyLogKeys.all }),
  })
}

/**
 * Tags as typed: comma-separated, with an optional leading `#`. The database
 * lower-cases, trims and de-duplicates them, so this only has to split.
 */
export function parseTags(input: string): string[] {
  return input
    .split(',')
    .map((tag) => tag.trim().replace(/^#/, ''))
    .filter((tag) => tag !== '')
}

export function useCreateLogEntry() {
  return useLogWrite(async (input: DailyLogInput) => {
    const { error } = await supabase.from('daily_log_entries').insert({
      gym_id: input.gymId,
      kind: input.kind,
      body: input.body.trim(),
      tags: input.tags,
    })

    if (error) throw error
  })
}

/** Only the author's own entry, which the database enforces column by column. */
export function useUpdateLogEntry() {
  return useLogWrite(
    async ({ id, kind, body, tags }: { id: string } & Omit<DailyLogInput, 'gymId'>) => {
      const { error } = await supabase
        .from('daily_log_entries')
        .update({ kind, body: body.trim(), tags })
        .eq('id', id)

      if (error) throw error
    },
  )
}

/** Soft delete (spec §2.5): the author, or a manager of that gym. */
export function useDeleteLogEntry() {
  return useLogWrite(async (id: string) => {
    const { error } = await supabase
      .from('daily_log_entries')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw error
  })
}
