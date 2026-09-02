import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import type { Database } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

type EventRow = Database['public']['Tables']['events']['Row']

export type EventType = Database['public']['Enums']['event_type']

/** The enum's own order, which is the order the filter and the form offer. */
export const eventTypes: EventType[] = [
  'community',
  'campaign',
  'groups',
  'offer',
  'other',
]

const eventColumns =
  'id, event_type, title, description, link, starts_on, start_time, ends_on, end_time, last_on, event_gyms(gym_id, gyms(id, name))'

export type GymEvent = Pick<
  EventRow,
  | 'id'
  | 'event_type'
  | 'title'
  | 'description'
  | 'link'
  | 'starts_on'
  | 'start_time'
  | 'ends_on'
  | 'end_time'
  | 'last_on'
> & { event_gyms: { gym_id: string; gyms: { id: string; name: string } | null }[] }

/** What the form collects; the rest of the row is defaulted or audited. */
export type EventInput = {
  /** The gyms it runs at. Empty is company-wide. */
  gymIds: string[]
  eventType: EventType
  title: string
  description: string
  link: string | null
  startsOn: string
  startTime: string | null
  endsOn: string | null
  endTime: string | null
}

/**
 * Which slice of the calendar to read: the list wants what is still to come or
 * what is over, the month grid wants one month of it.
 */
export type EventWindow = 'upcoming' | 'past' | { from: string; to: string }

const windowKey = (window: EventWindow) =>
  typeof window === 'string' ? window : `${window.from}..${window.to}`

export const eventKeys = {
  all: ['events'] as const,
  list: (gymId: string | null, window: EventWindow) =>
    ['events', 'list', gymId, windowKey(window)] as const,
}

const toRow = (input: EventInput) => ({
  event_type: input.eventType,
  title: input.title.trim(),
  description: input.description.trim(),
  link: input.link?.trim() || null,
  starts_on: input.startsOn,
  start_time: input.startTime || null,
  ends_on: input.endsOn || null,
  end_time: input.endTime || null,
})

/** An event with no gyms of its own runs everywhere. */
export const isCompanyWide = (event: Pick<GymEvent, 'event_gyms'>) =>
  event.event_gyms.length === 0

/** The gyms an event runs at, by name, for the badges. */
export const eventGymNames = (event: Pick<GymEvent, 'event_gyms'>) =>
  event.event_gyms
    .map((scope) => scope.gyms?.name)
    .filter((name): name is string => Boolean(name))
    .sort((a, b) => a.localeCompare(b))

/**
 * The events for the gym in the switcher plus the company-wide ones, or
 * everything the viewer may see when the scope is "all gyms". `last_on` is
 * what decides whether an event is over: a range that started last week is
 * still upcoming while it is still running.
 *
 * The gym filter is applied here rather than in the query, because the scope
 * now lives in a second table: RLS has already narrowed the rows to the ones
 * this user may read, and the date window bounds how many that is.
 */
export function useEvents(gymId: string | null, window: EventWindow) {
  return useQuery({
    queryKey: eventKeys.list(gymId, window),
    // Paging the calendar keeps the previous month on screen rather than
    // blanking the grid between months.
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10)

      let query = supabase.from('events').select(eventColumns).is('deleted_at', null)

      if (window === 'upcoming') {
        query = query
          .gte('last_on', today)
          .order('starts_on', { ascending: true })
          .order('start_time', { ascending: true, nullsFirst: true })
      } else if (window === 'past') {
        query = query
          .lt('last_on', today)
          .order('starts_on', { ascending: false })
          .order('start_time', { ascending: false, nullsFirst: false })
      } else {
        // Overlapping the month, so an event that began before the first of it
        // still fills its days in the grid.
        query = query
          .gte('last_on', window.from)
          .lte('starts_on', window.to)
          .order('starts_on', { ascending: true })
          .order('start_time', { ascending: true, nullsFirst: true })
      }

      const { data, error } = await query
      if (error) throw error

      if (!gymId) return data
      return data.filter(
        (event) =>
          isCompanyWide(event) ||
          event.event_gyms.some((scope) => scope.gym_id === gymId),
      )
    },
  })
}

/**
 * Events are written by admins and superadmins only (`events_insert`), unlike
 * news and guides, which managers publish in their own gyms. The UI hides the
 * controls from everyone else and RLS refuses them if it does not.
 */
function useEventWrite<TVariables>(mutationFn: (variables: TVariables) => Promise<void>) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: eventKeys.all }),
  })
}

async function setEventGyms(eventId: string, gymIds: string[]) {
  if (gymIds.length === 0) return

  const { error } = await supabase
    .from('event_gyms')
    .insert(gymIds.map((gymId) => ({ event_id: eventId, gym_id: gymId })))

  if (error) throw error
}

export function useCreateEvent() {
  return useEventWrite(async (input: EventInput) => {
    const { data, error } = await supabase
      .from('events')
      .insert(toRow(input))
      .select('id')
      .single()

    if (error) throw error
    await setEventGyms(data.id, input.gymIds)
  })
}

export function useUpdateEvent() {
  return useEventWrite(async ({ id, ...input }: EventInput & { id: string }) => {
    const { error } = await supabase.from('events').update(toRow(input)).eq('id', id)
    if (error) throw error

    // The scope is rewritten rather than diffed: it is a handful of rows, and
    // a diff would have to be right about a gym the editor cannot even see.
    const cleared = await supabase.from('event_gyms').delete().eq('event_id', id)
    if (cleared.error) throw cleared.error

    await setEventGyms(id, input.gymIds)
  })
}

/** Removing an event is stamping `deleted_at`: there is no delete policy. */
export function useDeleteEvent() {
  return useEventWrite(async (id: string) => {
    const { error } = await supabase
      .from('events')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw error
  })
}
