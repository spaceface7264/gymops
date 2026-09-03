import type { Channel, DmMember } from './queries'

/**
 * What a channel is called in the list. Everything but a DM carries its own
 * name; a DM is named by whoever else is in it, and falls back to the email
 * when a colleague has not filled in their name yet.
 */
export function channelName(
  channel: Pick<Channel, 'id' | 'kind' | 'name'>,
  dmMembers: DmMember[],
  currentUserId: string | undefined,
): string {
  if (channel.kind !== 'dm') return channel.name ?? ''

  const others = dmMembers
    .filter(
      (member) => member.channel_id === channel.id && member.user_id !== currentUserId,
    )
    .map((member) => member.full_name?.trim() || member.email)
    .filter(Boolean)

  return others.join(', ')
}
