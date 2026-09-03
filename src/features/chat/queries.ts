import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useAuth } from '@/features/auth'
import type { Database } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

type ChannelRow = Database['public']['Tables']['channels']['Row']
type MessageRow = Database['public']['Tables']['messages']['Row']

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

/** A message with the name to put above it. */
export type Message = Pick<
  MessageRow,
  | 'id'
  | 'channel_id'
  | 'body'
  | 'mentions'
  | 'created_at'
  | 'edited_at'
  | 'deleted_at'
  | 'created_by'
> & {
  author: { full_name: string | null; email: string } | null
  message_attachments: ChatAttachment[]
}

export type ChatAttachment = {
  id: string
  path: string
  mime_type: string | null
  size_bytes: number | null
}

export type ChannelMember = {
  channel_id: string
  user_id: string
  full_name: string | null
  email: string
}

export const chatKeys = {
  all: ['chat'] as const,
  channels: ['chat', 'channels'] as const,
  overview: ['chat', 'overview'] as const,
  members: (channelIds: string[]) => ['chat', 'members', channelIds.join(',')] as const,
  messages: (channelId: string) => ['chat', 'messages', channelId] as const,
  signedUrl: (path: string) => ['chat', 'signed-url', path] as const,
}

/** How many messages a page of the list holds, and asks for again. */
export const messagePageSize = 30

// One literal, however long: supabase-js infers the row type from the string
// itself, and a concatenated one infers nothing.
const messageColumns =
  'id, channel_id, body, mentions, created_at, edited_at, deleted_at, created_by, author:created_by(full_name, email), message_attachments(id, path, mime_type, size_bytes)'

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

/**
 * Who is in these channels. It names a DM, which has no name of its own, and
 * it is the list the composer's @mention autocomplete offers (P6-05).
 */
export function useChannelMembers(channelIds: string[]) {
  const ids = [...channelIds].sort()

  return useQuery({
    queryKey: chatKeys.members(ids),
    enabled: ids.length > 0,
    queryFn: async (): Promise<ChannelMember[]> => {
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

/** Where a page of messages stopped: the last row on it, not an offset. */
export type MessageCursor = { createdAt: string; id: string }

/**
 * One channel's messages, newest first, a page at a time.
 *
 * The cursor is a row rather than an offset — a message arriving while
 * somebody is reading would shift every offset under them and show a line
 * twice — and it is the *pair* `(created_at, id)`, because two messages can
 * share a timestamp: `now()` is the transaction's, so anything written in one
 * statement lands on the same microsecond. Ordered on `created_at` alone, a
 * tie has no defined order, and a tie straddling a page boundary drops out of
 * the list altogether.
 */
export function useMessages(channelId: string) {
  return useInfiniteQuery({
    queryKey: chatKeys.messages(channelId),
    initialPageParam: null as MessageCursor | null,
    queryFn: async ({ pageParam }): Promise<Message[]> => {
      let query = supabase
        .from('messages')
        .select(messageColumns)
        .eq('channel_id', channelId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(messagePageSize)

      if (pageParam) {
        query = query.or(
          `created_at.lt."${pageParam.createdAt}",` +
            `and(created_at.eq."${pageParam.createdAt}",id.lt.${pageParam.id})`,
        )
      }

      const { data, error } = await query
      if (error) throw error
      return data
    },
    getNextPageParam: (page): MessageCursor | undefined => {
      const last = page.at(-1)
      return page.length < messagePageSize || !last
        ? undefined
        : { createdAt: last.created_at, id: last.id }
    },
  })
}

function useMessageWrite<TVariables>(
  channelId: string,
  mutationFn: (variables: TVariables) => Promise<void>,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: chatKeys.messages(channelId) }),
  })
}

/** Your own words, and only the body: the guard trigger holds the rest (P6-01). */
export function useEditMessage(channelId: string) {
  return useMessageWrite(
    channelId,
    async ({ id, body }: { id: string; body: string }) => {
      const { error } = await supabase.from('messages').update({ body }).eq('id', id)
      if (error) throw error
    },
  )
}

/**
 * Deleting is setting `deleted_at`; the trigger empties the body. A manager
 * may do it to anybody's message in a channel they publish in, which is the
 * §2.1 row "delete any chat message (non-DM)".
 */
export function useDeleteMessage(channelId: string) {
  return useMessageWrite(channelId, async (id: string) => {
    const { error } = await supabase
      .from('messages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw error
  })
}

/**
 * Mute is per person per channel: it silences the notifications P6-08 raises
 * and takes the channel out of the shell's badge, while the channel keeps its
 * own count in the list. Being interrupted and being kept in the dark are
 * different things.
 */
export function useSetChannelMuted() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({ channelId, muted }: { channelId: string; muted: boolean }) => {
      if (!user) throw new Error('not signed in')

      const { error } = await supabase
        .from('channel_members')
        .update({ muted })
        .eq('channel_id', channelId)
        .eq('user_id', user.id)

      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chatKeys.all }),
  })
}

/**
 * Opening a channel is reading it. The marker is only ever moved forward, so
 * a second tab that is behind cannot un-read what this one has seen.
 */
export function useMarkChannelRead() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (channelId: string) => {
      if (!user) throw new Error('not signed in')

      const now = new Date().toISOString()
      const { error } = await supabase
        .from('channel_members')
        .update({ last_read_at: now })
        .eq('channel_id', channelId)
        .eq('user_id', user.id)
        .lt('last_read_at', now)

      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chatKeys.overview }),
  })
}

/**
 * Where an attachment lives: the channel first, because that is the segment
 * the storage policies resolve a permission from (P6-01).
 */
export function chatAttachmentPath(channelId: string, fileName: string): string {
  const extension = fileName.includes('.') ? `.${fileName.split('.').pop()}` : ''
  return `${channelId}/${crypto.randomUUID()}${extension}`
}

/**
 * Saying something. The message row goes first and the files after it: an
 * attachment row points at a message, so there is nothing to attach to until
 * the message exists — the same order incident photographs take (P4-07).
 *
 * `mentions` is resolved by the composer from the people actually in the
 * channel, never parsed out of the text here: an @name is a string, and the
 * notification P6-08 raises has to be aimed at a person.
 */
export function useSendMessage(channelId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      body,
      mentions = [],
      files = [],
    }: {
      body: string
      mentions?: string[]
      files?: File[]
    }) => {
      const { data, error } = await supabase
        .from('messages')
        .insert({ channel_id: channelId, body, mentions })
        .select('id')
        .single()

      if (error) throw error

      for (const file of files) {
        const path = chatAttachmentPath(channelId, file.name)
        const upload = await supabase.storage
          .from('chat')
          .upload(path, file, { contentType: file.type, upsert: false })
        if (upload.error) throw upload.error

        const attached = await supabase.from('message_attachments').insert({
          message_id: data.id,
          path,
          mime_type: file.type,
          size_bytes: file.size,
        })
        if (attached.error) throw attached.error
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: chatKeys.messages(channelId) })
      void queryClient.invalidateQueries({ queryKey: chatKeys.overview })
    },
  })
}

/** Signed URLs last an hour; the query is refetched a few minutes before that. */
const signedUrlSeconds = 3600

/** The `chat` bucket is private, so an attachment is signed to be shown. */
export function useSignedAttachmentUrl(path: string) {
  return useQuery({
    queryKey: chatKeys.signedUrl(path),
    staleTime: (signedUrlSeconds - 300) * 1000,
    gcTime: signedUrlSeconds * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from('chat')
        .createSignedUrl(path, signedUrlSeconds)

      if (error) throw error
      return data.signedUrl
    },
  })
}
