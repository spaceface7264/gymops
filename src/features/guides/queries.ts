import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { JSONContent } from '@tiptap/react'
import type { Database } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

type GuideRow = Database['public']['Tables']['guides']['Row']

const guideColumns =
  'id, gym_id, category_id, title, body, status, published_at, requires_ack, version, created_at, updated_at, gyms(id, name), guide_categories(id, name)'

export type Guide = Pick<
  GuideRow,
  | 'id'
  | 'gym_id'
  | 'category_id'
  | 'title'
  | 'body'
  | 'status'
  | 'published_at'
  | 'requires_ack'
  | 'version'
  | 'created_at'
  | 'updated_at'
> & {
  gyms: { id: string; name: string } | null
  guide_categories: { id: string; name: string } | null
}

export type GuideCategory = Pick<
  Database['public']['Tables']['guide_categories']['Row'],
  'id' | 'gym_id' | 'parent_id' | 'name' | 'position'
>

export type GuideInput = {
  gymId: string | null
  categoryId: string | null
  title: string
  body: JSONContent
  requiresAck: boolean
  status: Database['public']['Enums']['content_status']
}

export const guideKeys = {
  all: ['guides'] as const,
  categories: ['guides', 'categories'] as const,
  list: ['guides', 'list'] as const,
  detail: (guideId: string) => ['guides', 'detail', guideId] as const,
  myAck: (guideId: string, userId: string) => ['guides', 'ack', guideId, userId] as const,
}

/**
 * One tree mixing company and gym categories (spec §2.2). RLS decides which
 * gyms' categories come back, so the tree is already the viewer's tree.
 */
export function useGuideCategories() {
  return useQuery({
    queryKey: guideKeys.categories,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('guide_categories')
        .select('id, gym_id, parent_id, name, position')
        .order('position')
        .order('name')

      if (error) throw error
      return data
    },
  })
}

/**
 * Every guide the viewer may see, ordered by title. Guides are browsed by
 * category rather than by date, and a chain this size fits in one query — the
 * tree filters the list in the client.
 */
export function useGuides() {
  return useQuery({
    queryKey: guideKeys.list,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('guides')
        .select(guideColumns)
        .order('title')
      if (error) throw error
      return data
    },
  })
}

export function useGuide(guideId: string | undefined) {
  return useQuery({
    queryKey: guideKeys.detail(guideId ?? ''),
    enabled: Boolean(guideId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('guides')
        .select(guideColumns)
        .eq('id', guideId ?? '')
        .single()

      if (error) throw error
      return data
    },
  })
}

function useGuideWrite<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: guideKeys.all }),
  })
}

const toRow = (input: GuideInput) => ({
  gym_id: input.gymId,
  category_id: input.categoryId,
  title: input.title.trim(),
  body: input.body as unknown as Database['public']['Tables']['guides']['Insert']['body'],
  requires_ack: input.requiresAck,
  status: input.status,
})

export function useCreateGuide() {
  return useGuideWrite(async (input: GuideInput) => {
    const { data, error } = await supabase
      .from('guides')
      .insert(toRow(input))
      .select('id')
      .single()

    if (error) throw error
    return data.id
  })
}

/**
 * `version` is bumped only when the author says the change is significant:
 * everyone who confirmed the old version has to confirm again (spec §2.2), and
 * a typo fix should not send 200 people back to the guide.
 */
export function useUpdateGuide() {
  return useGuideWrite(
    async ({
      id,
      version,
      ...input
    }: GuideInput & { id: string; version: number | null }) => {
      const { error } = await supabase
        .from('guides')
        .update(version === null ? toRow(input) : { ...toRow(input), version })
        .eq('id', id)

      if (error) throw error
      return id
    },
  )
}

export function useSetGuideStatus() {
  return useGuideWrite(
    async ({
      id,
      status,
    }: {
      id: string
      status: Database['public']['Enums']['content_status']
    }) => {
      const { error } = await supabase.from('guides').update({ status }).eq('id', id)
      if (error) throw error
    },
  )
}

/** Soft delete (spec §2.5). */
export function useDeleteGuide() {
  return useGuideWrite(async (id: string) => {
    const { error } = await supabase
      .from('guides')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw error
  })
}

export type CategoryInput = {
  gymId: string | null
  parentId: string | null
  name: string
}

export function useCreateCategory() {
  return useGuideWrite(async (input: CategoryInput) => {
    const { error } = await supabase
      .from('guide_categories')
      .insert({ gym_id: input.gymId, parent_id: input.parentId, name: input.name.trim() })

    if (error) throw error
  })
}

export function useRenameCategory() {
  return useGuideWrite(async ({ id, name }: { id: string; name: string }) => {
    const { error } = await supabase
      .from('guide_categories')
      .update({ name: name.trim() })
      .eq('id', id)

    if (error) throw error
  })
}

/**
 * Categories are deleted outright, not soft-deleted: they hold no content of
 * their own. `on delete restrict` on both the guides and the child categories
 * means an emptied category is the only one that goes.
 */
export function useDeleteCategory() {
  return useGuideWrite(async (id: string) => {
    const { error } = await supabase.from('guide_categories').delete().eq('id', id)
    if (error) throw error
  })
}

/** Which version of a guide this person has confirmed, if any. */
export function useMyGuideAck(guideId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: guideKeys.myAck(guideId ?? '', userId ?? ''),
    enabled: Boolean(guideId && userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('guide_acks')
        .select('version, acknowledged_at')
        .eq('guide_id', guideId ?? '')
        .eq('user_id', userId ?? '')
        .maybeSingle()

      if (error) throw error
      return data
    },
  })
}

export function useAcknowledgeGuide() {
  return useGuideWrite(
    async ({
      guideId,
      userId,
      version,
    }: {
      guideId: string
      userId: string
      version: number
    }) => {
      const { error } = await supabase.from('guide_acks').upsert(
        {
          guide_id: guideId,
          user_id: userId,
          version,
          acknowledged_at: new Date().toISOString(),
        },
        { onConflict: 'guide_id,user_id' },
      )

      if (error) throw error
    },
  )
}
