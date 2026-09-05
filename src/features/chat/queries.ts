import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query'
import { useAuth, useProfile } from '@/features/auth'
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

/** The four reactions a line can take (P6C-18); the database checks the same set. */
export const reactionEmojis = ['👍', '✅', '👀', '❤️'] as const
export type ReactionEmoji = (typeof reactionEmojis)[number]

/** One person's one reaction on a line, with the name to list. */
export type Reaction = {
  emoji: string
  user_id: string
  reactor: { full_name: string | null; email: string } | null
}

/** The line a reply quotes (P6C-17): enough to show the quote and jump to it. */
export type QuotedMessage = Pick<
  MessageRow,
  'id' | 'body' | 'deleted_at' | 'created_by' | 'from_assistant'
> & {
  author: { full_name: string | null; email: string } | null
}

/** What a send carries; a failed line keeps it to go again. */
export type Outgoing = {
  body: string
  mentions?: string[]
  files?: File[]
  replyTo?: QuotedMessage | null
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
  | 'from_assistant'
  | 'reply_to'
> & {
  author: { full_name: string | null; email: string } | null
  quoted: QuotedMessage | null
  message_attachments: ChatAttachment[]
  message_reactions: Reaction[]
  /** Not in the channel yet: the sender's own line while it goes up (P6C-10). */
  pending?: boolean
  /** The channel refused it (or the network did); what to send again. */
  failed?: Outgoing
}

export type ChatAttachment = {
  id: string
  path: string
  file_name: string | null
  mime_type: string | null
  size_bytes: number | null
}

/** Somebody who can be messaged or put in a channel: what `profiles_select` shows. */
export type Colleague = {
  id: string
  full_name: string | null
  email: string
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
  colleagues: ['chat', 'colleagues'] as const,
  joinable: ['chat', 'joinable'] as const,
  messages: (channelId: string) => ['chat', 'messages', channelId] as const,
  signedUrl: (path: string) => ['chat', 'signed-url', path] as const,
}

/** How many messages a page of the list holds, and asks for again. */
export const messagePageSize = 30

// One literal, however long: supabase-js infers the row type from the string
// itself, and a concatenated one infers nothing.
const messageColumns =
  'id, channel_id, body, mentions, created_at, edited_at, deleted_at, created_by, from_assistant, reply_to, author:created_by(full_name, email), quoted:reply_to(id, body, deleted_at, created_by, from_assistant, author:created_by(full_name, email)), message_attachments(id, path, file_name, mime_type, size_bytes), message_reactions(emoji, user_id, reactor:user_id(full_name, email))'

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

/**
 * The people this person can name: every active colleague but themselves.
 * `profiles_select` is the whole of the filter — staff see the people they
 * share a gym with, a manager their gyms, an admin everybody — and `start_dm()`
 * asks the same question again on the way in. It fills the DM picker and the
 * channel's member list alike.
 */
export function useColleagues() {
  const { user } = useAuth()
  const userId = user?.id

  return useQuery({
    queryKey: [...chatKeys.colleagues, userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<Colleague[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('active', true)
        .order('full_name', { nullsFirst: false })

      if (error) throw error
      return data.filter((profile) => profile.id !== userId)
    },
  })
}

/**
 * Opening a conversation with these people, or reopening the one that is
 * already there: the dedupe is `start_dm()`'s, because the fingerprint that
 * answers "is this the same conversation" is derived from the member set after
 * the fact and a browser cannot compute it (P6-06).
 */
export function useStartDm() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (userIds: string[]): Promise<string> => {
      const { data, error } = await supabase.rpc('start_dm', { target_ids: userIds })

      if (error) throw error
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chatKeys.all }),
  })
}

/** What a custom channel is made of, as the create and edit dialog holds it. */
export type ChannelInput = {
  name: string
  description: string | null
  gymId: string | null
  isPrivate: boolean
}

/** A channel this person could be in but is not, with how many people are. */
export type JoinableChannel = Pick<
  Channel,
  'id' | 'gym_id' | 'name' | 'description' | 'is_private'
> & { members: number }

/**
 * The custom channels this person may see and has not joined: `channels_select`
 * decides the list — a public one in a gym they read, or a private one they
 * moderate — and the ones they are already in are dropped here, because the
 * sidebar is already showing those.
 */
export function useJoinableChannels() {
  const { user } = useAuth()
  const userId = user?.id

  return useQuery({
    queryKey: [...chatKeys.joinable, userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<JoinableChannel[]> => {
      const { data, error } = await supabase
        .from('channels')
        .select('id, gym_id, name, description, is_private, channel_members(user_id)')
        .eq('kind', 'custom')
        .order('name')

      if (error) throw error

      return data
        .filter((channel) => !channel.channel_members.some((m) => m.user_id === userId))
        .map(({ channel_members: members, ...channel }) => ({
          ...channel,
          members: members.length,
        }))
    },
  })
}

/** Everything a channel write invalidates: the list, the badges, the browse. */
function useChannelWrite<TVariables, TData = void>(
  mutationFn: (variables: TVariables) => Promise<TData>,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chatKeys.all }),
  })
}

/**
 * A custom channel and its first member: whoever made it. The two statements
 * are the same shape as a DM's (P6-06) minus the dedupe — there is nothing to
 * deduplicate, two channels of the same name being two channels — and the
 * id *can* be read back here, because `can_moderate_channel()` shows the
 * creator a channel with no members yet.
 */
export function useCreateChannel() {
  const { user } = useAuth()

  return useChannelWrite(async (input: ChannelInput): Promise<string> => {
    if (!user) throw new Error('not signed in')

    const { data, error } = await supabase
      .from('channels')
      .insert({
        kind: 'custom',
        name: input.name,
        description: input.description,
        gym_id: input.gymId,
        is_private: input.isPrivate,
      })
      .select('id')
      .single()

    if (error) throw error

    const seated = await supabase
      .from('channel_members')
      .insert({ channel_id: data.id, user_id: user.id })

    if (seated.error) throw seated.error
    return data.id
  })
}

/**
 * Renaming and describing. Not the scope and not the privacy: both are what
 * the people in the channel joined, and `channels_update`'s check is on the
 * new row, so moving one out of a gym would be a channel its own manager can
 * no longer administer.
 */
export function useUpdateChannel() {
  return useChannelWrite(
    async ({
      id,
      name,
      description,
    }: {
      id: string
      name: string
      description: string | null
    }) => {
      const { error } = await supabase
        .from('channels')
        .update({ name, description })
        .eq('id', id)

      if (error) throw error
    },
  )
}

/** Deleting takes the messages with it: `messages.channel_id` cascades. */
export function useDeleteChannel() {
  return useChannelWrite(async (id: string) => {
    const { error } = await supabase.from('channels').delete().eq('id', id)
    if (error) throw error
  })
}

/** Joining a channel you can see, which is what makes you able to post in it. */
export function useJoinChannel() {
  const { user } = useAuth()

  return useChannelWrite(async (channelId: string) => {
    if (!user) throw new Error('not signed in')

    const { error } = await supabase
      .from('channel_members')
      .insert({ channel_id: channelId, user_id: user.id })

    if (error) throw error
  })
}

/** Leaving one. A gym channel and a DM have no such button (P6-01). */
export function useLeaveChannel() {
  const { user } = useAuth()

  return useChannelWrite(async (channelId: string) => {
    if (!user) throw new Error('not signed in')

    const { error } = await supabase
      .from('channel_members')
      .delete()
      .eq('channel_id', channelId)
      .eq('user_id', user.id)

    if (error) throw error
  })
}

/** Seating people in a channel you manage; removing one again is below. */
export function useAddChannelMembers() {
  return useChannelWrite(
    async ({ channelId, userIds }: { channelId: string; userIds: string[] }) => {
      const { error } = await supabase
        .from('channel_members')
        .insert(userIds.map((userId) => ({ channel_id: channelId, user_id: userId })))

      if (error) throw error
    },
  )
}

export function useRemoveChannelMember() {
  return useChannelWrite(
    async ({ channelId, userId }: { channelId: string; userId: string }) => {
      const { error } = await supabase
        .from('channel_members')
        .delete()
        .eq('channel_id', channelId)
        .eq('user_id', userId)

      if (error) throw error
    },
  )
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
 * Saying something. The files go up first and the message row after them: a
 * message that is in the channel with its file missing, and a box that then
 * says it could not be sent, is worse than a file in the bucket nobody points
 * at. (Incident photographs, P4-07, go the other way: the report exists
 * before the photograph is taken.)
 *
 * `mentions` is resolved by the composer from the people actually in the
 * channel, never parsed out of the text here: an @name is a string, and the
 * notification P6-08 raises has to be aimed at a person.
 */
export function useSendMessage(channelId: string) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { data: profile } = useProfile()

  return useMutation({
    // The line goes into the list at once, marked pending, so the sender sees
    // it where it will be rather than a spinner beside an empty box. The
    // refetch on success replaces it with the row as the database has it.
    onMutate: ({ body, mentions = [], files = [], replyTo = null }) => {
      const key = chatKeys.messages(channelId)
      const previous = queryClient.getQueryData<InfiniteData<Message[]>>(key)
      const pending: Message = {
        id: `pending-${crypto.randomUUID()}`,
        channel_id: channelId,
        body,
        mentions,
        created_at: new Date().toISOString(),
        edited_at: null,
        deleted_at: null,
        created_by: user?.id ?? null,
        from_assistant: false,
        reply_to: replyTo?.id ?? null,
        quoted: replyTo,
        author: { full_name: profile?.full_name ?? null, email: user?.email ?? '' },
        message_reactions: [],
        message_attachments: files.map((file, index) => ({
          id: `pending-${index}`,
          path: '',
          file_name: file.name,
          mime_type: file.type,
          size_bytes: file.size,
        })),
        pending: true,
      }
      if (previous)
        queryClient.setQueryData<InfiniteData<Message[]>>(key, {
          ...previous,
          // Pages are newest-first, and the newest line is the first of the first.
          pages: previous.pages.map((page, index) =>
            index === 0 ? [pending, ...page] : page,
          ),
        })
      return { previous, pendingId: pending.id }
    },
    // A line that could not be sent stays in the stream, marked, with what
    // it takes to send it again: the sender watched it appear, and a line
    // that vanishes is the worst thing a chat can do to them.
    onError: (_error, variables, context) => {
      const key = chatKeys.messages(channelId)
      const pendingId = context?.pendingId
      queryClient.setQueryData<InfiniteData<Message[]>>(
        key,
        (current) =>
          current && {
            ...current,
            pages: current.pages.map((page) =>
              page.map((message) =>
                message.id === pendingId
                  ? {
                      ...message,
                      pending: false,
                      failed: {
                        body: variables.body,
                        mentions: variables.mentions ?? [],
                        files: variables.files ?? [],
                        replyTo: variables.replyTo ?? null,
                      },
                    }
                  : message,
              ),
            ),
          },
      )
    },
    mutationFn: async ({
      body,
      mentions = [],
      files = [],
      replyTo = null,
    }: Outgoing): Promise<string> => {
      const uploaded: { path: string; file: File }[] = []
      for (const file of files) {
        const path = chatAttachmentPath(channelId, file.name)
        const upload = await supabase.storage
          .from('chat')
          .upload(path, file, { contentType: file.type, upsert: false })
        if (upload.error) throw upload.error
        uploaded.push({ path, file })
      }

      const { data, error } = await supabase
        .from('messages')
        .insert({ channel_id: channelId, body, mentions, reply_to: replyTo?.id ?? null })
        .select('id')
        .single()

      if (error) throw error

      if (uploaded.length > 0) {
        const attached = await supabase.from('message_attachments').insert(
          uploaded.map(({ path, file }) => ({
            message_id: data.id,
            path,
            file_name: file.name,
            mime_type: file.type,
            size_bytes: file.size,
          })),
        )
        if (attached.error) throw attached.error
      }

      // The id, so a message that names the assistant can be answered (P8-05).
      return data.id
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: chatKeys.messages(channelId) })
      void queryClient.invalidateQueries({ queryKey: chatKeys.overview })
    },
  })
}

/**
 * A reaction, added or taken away, shown at once and put back if the channel
 * refuses it. The row is the person's own, so it is a plain insert or delete;
 * nothing is ever edited.
 */
export function useToggleReaction(channelId: string) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const key = chatKeys.messages(channelId)

  return useMutation({
    onMutate: ({
      messageId,
      emoji,
      on,
    }: {
      messageId: string
      emoji: ReactionEmoji
      on: boolean
    }) => {
      const previous = queryClient.getQueryData<InfiniteData<Message[]>>(key)
      const mine: Reaction = {
        emoji,
        user_id: user?.id ?? '',
        reactor: { full_name: profile?.full_name ?? null, email: user?.email ?? '' },
      }
      const without = (reactions: Reaction[]) =>
        reactions.filter((r) => !(r.user_id === mine.user_id && r.emoji === emoji))
      queryClient.setQueryData<InfiniteData<Message[]>>(
        key,
        (current) =>
          current && {
            ...current,
            pages: current.pages.map((page) =>
              page.map((message) =>
                message.id === messageId
                  ? {
                      ...message,
                      message_reactions: on
                        ? [...without(message.message_reactions), mine]
                        : without(message.message_reactions),
                    }
                  : message,
              ),
            ),
          },
      )
      return { previous }
    },
    mutationFn: async ({ messageId, emoji, on }) => {
      if (!user) throw new Error('not signed in')
      if (on) {
        const { error } = await supabase
          .from('message_reactions')
          .insert({ message_id: messageId, channel_id: channelId, emoji })
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('message_reactions')
          .delete()
          .eq('message_id', messageId)
          .eq('user_id', user.id)
          .eq('emoji', emoji)
        if (error) throw error
      }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}

/** Takes a line that failed out of the stream, before it is sent again. */
export function useForgetFailed(channelId: string) {
  const queryClient = useQueryClient()
  return (id: string) =>
    queryClient.setQueryData<InfiniteData<Message[]>>(
      chatKeys.messages(channelId),
      (current) =>
        current && {
          ...current,
          pages: current.pages.map((page) => page.filter((message) => message.id !== id)),
        },
    )
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
