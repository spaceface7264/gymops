import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth'
import type { Database } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

type ChannelRow = Database['public']['Tables']['channels']['Row']

export type ChannelKind = Database['public']['Enums']['channel_kind']

/** A channel as the sidebar needs it, with this person's own membership flags. */
export type Channel = Pick<
  ChannelRow,
  'id' | 'kind' | 'gym_id' | 'name' | 'description' | 'is_private'
> & {
  muted: boolean
  last_read_at: string
}

/** What `chat_overview()` answers: one row per channel you are in. */
export type ChannelActivity = {
  channel_id: string
  unread: number
  last_message_at: string | null
  muted: boolean
}

export type DmMember = {
  channel_id: string
  user_id: string
  full_name: string | null
  email: string
}

export const chatKeys = {
  all: ['chat'] as const,
  channels: ['chat', 'channels'] as const,
  overview: ['chat', 'overview'] as const,
  dmMembers: (channelIds: string[]) =>
    ['chat', 'dm-members', channelIds.join(',')] as const,
}

/**
 * The channels this person is *in*, not every channel they may read: a gym
 * channel and `#company` are joined for them by P6-02, a custom one when they
 * join it. Browsing the ones they could join is P6-07's screen.
 *
 * Deliberately not filtered by the shell's gym switcher — somebody who works
 * at two gyms is in both channels at once, and a conversation does not belong
 * to the gym you happen to be looking at.
 */
export function useChannels() {
  const { user } = useAuth()
  const userId = user?.id

  return useQuery({
    queryKey: [...chatKeys.channels, userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<Channel[]> => {
      if (!userId) throw new Error('not signed in')

      const { data, error } = await supabase
        .from('channels')
        .select(
          'id, kind, gym_id, name, description, is_private, channel_members!inner(muted, last_read_at)',
        )
        .eq('channel_members.user_id', userId)

      if (error) throw error

      return data.map(({ channel_members: membership, ...channel }) => ({
        ...channel,
        muted: membership[0]?.muted ?? false,
        last_read_at: membership[0]?.last_read_at ?? new Date(0).toISOString(),
      }))
    },
  })
}

/** Unread counts and last activity, one query for every channel (P6-03). */
export function useChatOverview() {
  const { user } = useAuth()

  return useQuery({
    queryKey: chatKeys.overview,
    enabled: Boolean(user),
    queryFn: async (): Promise<ChannelActivity[]> => {
      const { data, error } = await supabase.rpc('chat_overview')

      if (error) throw error
      return data ?? []
    },
  })
}

/**
 * The nav badge: everything unread outside the channels this person muted.
 * A muted channel still counts on its own row in the list — mute silences the
 * shell, not the channel.
 */
export function useChatUnread(): number {
  const overview = useChatOverview()

  return (overview.data ?? []).reduce(
    (total, channel) => (channel.muted ? total : total + channel.unread),
    0,
  )
}

/** A DM has no name of its own: it is named by the people in it. */
export function useDmMembers(channelIds: string[]) {
  const ids = [...channelIds].sort()

  return useQuery({
    queryKey: chatKeys.dmMembers(ids),
    enabled: ids.length > 0,
    queryFn: async (): Promise<DmMember[]> => {
      const { data, error } = await supabase
        .from('channel_members')
        .select('channel_id, user_id, profiles(full_name, email)')
        .in('channel_id', ids)

      if (error) throw error

      return data.map((member) => ({
        channel_id: member.channel_id,
        user_id: member.user_id,
        full_name: member.profiles?.full_name ?? null,
        email: member.profiles?.email ?? '',
      }))
    },
  })
}
