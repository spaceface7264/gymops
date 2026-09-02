import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Database } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

type IncidentRow = Database['public']['Tables']['incidents']['Row']

export type IncidentKind = Database['public']['Enums']['incident_kind']
export type IncidentSeverity = Database['public']['Enums']['incident_severity']
export type IncidentStatus = Database['public']['Enums']['incident_status']

export const incidentKinds: IncidentKind[] = ['injury', 'equipment', 'cleaning', 'other']
export const incidentSeverities: IncidentSeverity[] = ['low', 'medium', 'high']
/** In the order §2.2 gives them: open → in progress → resolved. */
export const incidentStatuses: IncidentStatus[] = ['open', 'in_progress', 'resolved']

export type Incident = Pick<
  IncidentRow,
  | 'id'
  | 'gym_id'
  | 'kind'
  | 'severity'
  | 'status'
  | 'title'
  | 'body'
  | 'assignee_id'
  | 'resolved_at'
  | 'created_at'
  | 'created_by'
> & {
  gyms: { id: string; name: string; timezone: string } | null
  // Named embeds: `created_by`, `updated_by` and `assignee_id` all point at
  // `profiles`, so an unqualified one would not know which is meant.
  reporter: { id: string; full_name: string | null } | null
  assignee: { id: string; full_name: string | null } | null
}

export type IncidentAttachment = {
  id: string
  path: string
  mime_type: string | null
  created_at: string
}

export type IncidentInput = {
  gymId: string
  kind: IncidentKind
  severity: IncidentSeverity
  title: string
  body: string
}

/** What a manager may move; the reporter's half is `title`, `body` and `kind`. */
export type IncidentHandling = {
  status?: IncidentStatus
  severity?: IncidentSeverity
  assignee_id?: string | null
}

const incidentColumns =
  'id, gym_id, kind, severity, status, title, body, assignee_id, resolved_at, created_at, created_by, ' +
  'gyms(id, name, timezone), ' +
  'reporter:profiles!incidents_created_by_fkey(id, full_name), ' +
  'assignee:profiles!incidents_assignee_id_fkey(id, full_name)'

export type IncidentFilters = {
  status: IncidentStatus | 'open_only' | 'all'
  kind: IncidentKind | 'all'
}

export const incidentKeys = {
  all: ['incidents'] as const,
  list: (gymId: string | null, filters: IncidentFilters) =>
    ['incidents', 'list', gymId ?? 'all', filters.status, filters.kind] as const,
  detail: (id: string) => ['incidents', 'detail', id] as const,
  comments: (id: string) => ['incidents', 'comments', id] as const,
  attachments: (id: string) => ['incidents', 'attachments', id] as const,
  members: (gymId: string) => ['incidents', 'members', gymId] as const,
  signedUrl: (path: string) => ['incidents', 'signed-url', path] as const,
}

/**
 * The gym's incidents, newest first. `open_only` is the default the list opens
 * on: what still needs somebody, which is also what the home page asks for.
 */
export function useIncidents(gymId: string | null, filters: IncidentFilters) {
  return useQuery({
    queryKey: incidentKeys.list(gymId, filters),
    queryFn: async () => {
      let query = supabase
        .from('incidents')
        .select(incidentColumns)
        .order('created_at', { ascending: false })
        .limit(100)

      if (gymId) query = query.eq('gym_id', gymId)
      if (filters.status === 'open_only') query = query.neq('status', 'resolved')
      else if (filters.status !== 'all') query = query.eq('status', filters.status)
      if (filters.kind !== 'all') query = query.eq('kind', filters.kind)

      const { data, error } = await query
      if (error) throw error
      return data as unknown as Incident[]
    },
  })
}

export function useIncident(incidentId: string) {
  return useQuery({
    queryKey: incidentKeys.detail(incidentId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('incidents')
        .select(incidentColumns)
        .eq('id', incidentId)
        .maybeSingle()

      if (error) throw error
      return data as unknown as Incident | null
    },
  })
}

function useIncidentWrite<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: incidentKeys.all }),
  })
}

/** Returns the new incident's id, which the photographs are filed under. */
export function useCreateIncident() {
  return useIncidentWrite(async (input: IncidentInput) => {
    const { data, error } = await supabase
      .from('incidents')
      .insert({
        gym_id: input.gymId,
        kind: input.kind,
        severity: input.severity,
        title: input.title.trim(),
        body: input.body.trim(),
      })
      .select('id')
      .single()

    if (error) throw error
    return data.id
  })
}

/**
 * The handling half of an incident. The triggers in 20260902190000 pin these
 * columns back for anyone `can_publish_content()` refuses, so the UI only
 * decides what is worth offering.
 */
export function useUpdateIncident() {
  return useIncidentWrite(
    async ({ id, ...changes }: { id: string } & IncidentHandling) => {
      const { error } = await supabase.from('incidents').update(changes).eq('id', id)
      if (error) throw error
    },
  )
}

export function useIncidentComments(incidentId: string) {
  return useQuery({
    queryKey: incidentKeys.comments(incidentId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('incident_comments')
        .select(
          'id, body, created_at, created_by, author:profiles!incident_comments_created_by_fkey(id, full_name)',
        )
        .eq('incident_id', incidentId)
        .order('created_at')

      if (error) throw error
      return data
    },
  })
}

export function useAddComment(incidentId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: string) => {
      const { error } = await supabase
        .from('incident_comments')
        .insert({ incident_id: incidentId, body: body.trim() })

      if (error) throw error
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: incidentKeys.comments(incidentId) }),
  })
}

export function useIncidentAttachments(incidentId: string) {
  return useQuery({
    queryKey: incidentKeys.attachments(incidentId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('incident_attachments')
        .select('id, path, mime_type, created_at')
        .eq('incident_id', incidentId)
        .order('created_at')

      if (error) throw error
      return data
    },
  })
}

/**
 * Where a photograph lives in the `incidents` bucket. The first segment is the
 * gym `incident_object_gym()` reads, so the object inherits the incident's
 * permissions; the second keeps one incident's photographs together.
 */
export function incidentPhotoPath(
  gymId: string,
  incidentId: string,
  fileName: string,
): string {
  const extension = fileName.includes('.')
    ? fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase()
    : 'jpg'
  return `${gymId}/${incidentId}/${crypto.randomUUID()}.${extension}`
}

/**
 * Uploads the photographs, then records them. The row is what the detail
 * screen lists, and it can only be written once the incident exists — which is
 * why reporting saves the incident first and attaches afterwards.
 */
export function useUploadPhotos() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      gymId,
      incidentId,
      files,
    }: {
      gymId: string
      incidentId: string
      files: File[]
    }) => {
      for (const file of files) {
        const path = incidentPhotoPath(gymId, incidentId, file.name)
        const upload = await supabase.storage
          .from('incidents')
          .upload(path, file, { contentType: file.type, upsert: false })
        if (upload.error) throw upload.error

        const { error } = await supabase.from('incident_attachments').insert({
          incident_id: incidentId,
          path,
          mime_type: file.type,
          size_bytes: file.size,
        })
        if (error) throw error
      }
    },
    onSuccess: (_result, variables) =>
      queryClient.invalidateQueries({
        queryKey: incidentKeys.attachments(variables.incidentId),
      }),
  })
}

/** Signed URLs last an hour; the query is refetched a few minutes before that. */
const signedUrlSeconds = 3600

/** The `incidents` bucket is private, so a photograph is signed to be shown. */
export function useSignedPhotoUrl(path: string) {
  return useQuery({
    queryKey: incidentKeys.signedUrl(path),
    staleTime: (signedUrlSeconds - 300) * 1000,
    gcTime: signedUrlSeconds * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from('incidents')
        .createSignedUrl(path, signedUrlSeconds)
      if (error) throw error
      return data.signedUrl
    },
  })
}

/**
 * Who an incident can be handed to: the people who work in that gym. RLS shows
 * colleagues through `shares_gym_with()`, and managers and admins see more.
 */
export function useGymMembers(gymId: string | null) {
  return useQuery({
    queryKey: incidentKeys.members(gymId ?? ''),
    enabled: gymId !== null,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gym_memberships')
        .select('user_id, profiles(id, full_name, active)')
        .eq('gym_id', gymId ?? '')

      if (error) throw error

      return (data ?? [])
        .map((membership) => membership.profiles)
        .filter(
          (person): person is { id: string; full_name: string | null; active: boolean } =>
            Boolean(person?.active),
        )
        .sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? ''))
    },
  })
}
