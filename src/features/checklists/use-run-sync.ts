import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { checklistKeys } from './queries'

/**
 * Live sync for the run screen: a tick made at the other end of the gym shows
 * up here without a reload. One private channel per gym scope
 * (`checklists:<gym id>`, `checklists:all` for an admin), authorised by
 * `can_listen_to_checklists()`; RLS decides per subscriber which rows arrive.
 *
 * The event only says something changed — the screen refetches rather than
 * patching the cache, because a payload may belong to a run that is not on it.
 */
export function useRunSync(gymId: string | null) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel(`checklists:${gymId ?? 'all'}`, { config: { private: true } })
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'checklist_run_items' },
        () => void queryClient.invalidateQueries({ queryKey: checklistKeys.all }),
      )
      .subscribe()

    return () => void supabase.removeChannel(channel)
  }, [gymId, queryClient])
}
