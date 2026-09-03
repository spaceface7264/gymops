import type { Channel, ChannelMember, Colleague } from './queries'

/** What a colleague is called in a picker: their name, or the email they signed
 *  up with until they have filled one in. */
export const personName = (person: Colleague) => person.full_name?.trim() || person.email

/**
 * What a channel is called in the list. Everything but a DM carries its own
 * name; a DM is named by whoever else is in it, and falls back to the email
 * when a colleague has not filled in their name yet.
 */
export function channelName(
  channel: Pick<Channel, 'id' | 'kind' | 'name'>,
  dmMembers: ChannelMember[],
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
