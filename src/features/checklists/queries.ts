import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Database } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import { localDate, possibleLocalDates } from './local-date'

type TemplateRow = Database['public']['Tables']['checklist_templates']['Row']
type ItemRow = Database['public']['Tables']['checklist_template_items']['Row']

export type ChecklistKind = Database['public']['Enums']['checklist_kind']

export type ChecklistTemplateItem = Pick<
  ItemRow,
  'id' | 'position' | 'label' | 'required'
>

export type ChecklistTemplate = Pick<
  TemplateRow,
  'id' | 'gym_id' | 'kind' | 'name' | 'weekdays' | 'active' | 'created_at' | 'updated_at'
> & {
  gyms: { id: string; name: string } | null
  checklist_template_items: ChecklistTemplateItem[]
}

/** An item as the editor holds it: no id until it has been saved once. */
export type TemplateItemInput = { id?: string; label: string; required: boolean }

export type TemplateInput = {
  gymId: string | null
  kind: ChecklistKind
  name: string
  weekdays: number[]
  active: boolean
  items: TemplateItemInput[]
}

const templateColumns =
  'id, gym_id, kind, name, weekdays, active, created_at, updated_at, gyms(id, name), checklist_template_items(id, position, label, required)'

export const checklistKeys = {
  all: ['checklists'] as const,
  templates: ['checklists', 'templates'] as const,
  template: (templateId: string) => ['checklists', 'templates', templateId] as const,
  runs: (gymId: string | null, from: string, to: string) =>
    ['checklists', 'runs', gymId ?? 'all', from, to] as const,
}

/**
 * Every template the viewer may see, company-wide ones included. RLS decides
 * which gyms come back, so this is already the viewer's list.
 */
export function useChecklistTemplates() {
  return useQuery({
    queryKey: checklistKeys.templates,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checklist_templates')
        .select(templateColumns)
        .order('name')
        .order('position', { referencedTable: 'checklist_template_items' })

      if (error) throw error
      return data
    },
  })
}

export function useChecklistTemplate(templateId: string | undefined) {
  return useQuery({
    queryKey: checklistKeys.template(templateId ?? ''),
    enabled: Boolean(templateId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checklist_templates')
        .select(templateColumns)
        .eq('id', templateId ?? '')
        .order('position', { referencedTable: 'checklist_template_items' })
        .single()

      if (error) throw error
      return data
    },
  })
}

function useTemplateWrite<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: checklistKeys.all }),
  })
}

const toTemplateRow = (input: TemplateInput) => ({
  gym_id: input.gymId,
  kind: input.kind,
  name: input.name.trim(),
  weekdays: [...input.weekdays].sort((a, b) => a - b),
  active: input.active,
})

const toItemRow = (item: TemplateItemInput, index: number, templateId: string) => ({
  template_id: templateId,
  position: index + 1,
  label: item.label.trim(),
  required: item.required,
})

/**
 * Creates or updates a template and its items in one call.
 *
 * Items are diffed rather than replaced: a run item points at the template item
 * it came from, so deleting every row on each save would cut history loose
 * (`on delete set null`) for items that never actually changed.
 */
export function useSaveChecklistTemplate() {
  return useTemplateWrite(async ({ id, ...input }: TemplateInput & { id?: string }) => {
    const templateId = id ?? (await insertTemplate(input))

    if (id) {
      const { error } = await supabase
        .from('checklist_templates')
        .update(toTemplateRow(input))
        .eq('id', id)

      if (error) throw error
      await removeDroppedItems(id, input.items)
    }

    const kept = input.items
      .map((item, index) => ({ item, row: toItemRow(item, index, templateId) }))
      .filter(({ item }) => item.id)
      .map(({ item, row }) => ({ id: item.id as string, ...row }))

    if (kept.length > 0) {
      const { error } = await supabase.from('checklist_template_items').upsert(kept)
      if (error) throw error
    }

    const added = input.items
      .map((item, index) => ({ item, row: toItemRow(item, index, templateId) }))
      .filter(({ item }) => !item.id)
      .map(({ row }) => row)

    if (added.length > 0) {
      const { error } = await supabase.from('checklist_template_items').insert(added)
      if (error) throw error
    }

    return templateId
  })
}

async function insertTemplate(input: TemplateInput) {
  const { data, error } = await supabase
    .from('checklist_templates')
    .insert(toTemplateRow(input))
    .select('id')
    .single()

  if (error) throw error
  return data.id
}

/** Items the editor no longer lists are gone from the template for good. */
async function removeDroppedItems(templateId: string, items: TemplateItemInput[]) {
  const { data, error } = await supabase
    .from('checklist_template_items')
    .select('id')
    .eq('template_id', templateId)

  if (error) throw error

  const remaining = new Set(items.map((item) => item.id))
  const dropped = data.filter((row) => !remaining.has(row.id)).map((row) => row.id)
  if (dropped.length === 0) return

  const { error: deleteError } = await supabase
    .from('checklist_template_items')
    .delete()
    .in('id', dropped)

  if (deleteError) throw deleteError
}

/**
 * Templates are deactivated, never deleted: the runs they have already
 * generated point at them (`on delete restrict`) and stay readable.
 */
export function useSetTemplateActive() {
  return useTemplateWrite(async ({ id, active }: { id: string; active: boolean }) => {
    const { error } = await supabase
      .from('checklist_templates')
      .update({ active })
      .eq('id', id)

    if (error) throw error
  })
}

type RunRow = Database['public']['Tables']['checklist_runs']['Row']
type RunItemRow = Database['public']['Tables']['checklist_run_items']['Row']

export type ChecklistRunItem = Pick<
  RunItemRow,
  'id' | 'position' | 'label' | 'required' | 'done_at' | 'done_by' | 'note'
> & {
  // Null for staff: `profiles` is readable by yourself, admins and the
  // managers of your gyms (spec §4), so a teammate's name is not always there.
  profiles: { id: string; full_name: string | null } | null
}

export type ChecklistRun = Pick<RunRow, 'id' | 'template_id' | 'gym_id' | 'run_date'> & {
  gyms: { id: string; name: string; timezone: string } | null
  checklist_templates: { name: string; kind: ChecklistKind } | null
  checklist_run_items: ChecklistRunItem[]
}

const runColumns =
  'id, template_id, gym_id, run_date, gyms(id, name, timezone), checklist_templates(name, kind), checklist_run_items(id, position, label, required, done_at, done_by, note, profiles(id, full_name))'

/**
 * The runs due today, one gym's or every gym the viewer may see. The query
 * spans three dates because "today" depends on the gym's own clock; the rows
 * are then filtered against each gym's date.
 */
export function useTodaysRuns(gymId: string | null) {
  const [from, to] = possibleLocalDates()

  return useQuery({
    queryKey: checklistKeys.runs(gymId, from, to),
    queryFn: async () => {
      const at = new Date()
      let query = supabase
        .from('checklist_runs')
        .select(runColumns)
        .gte('run_date', from)
        .lte('run_date', to)
        .order('position', { referencedTable: 'checklist_run_items' })

      if (gymId) query = query.eq('gym_id', gymId)

      const { data, error } = await query
      if (error) throw error

      return data.filter(
        (run) => run.gyms && run.run_date === localDate(run.gyms.timezone, at),
      )
    },
  })
}

function useRunWrite<TVariables>(mutationFn: (variables: TVariables) => Promise<void>) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: checklistKeys.all }),
  })
}

/**
 * `done_at` is all the client sends: a trigger stamps `done_by` from the
 * session and keeps the first tick's time (P4-01).
 */
export function useToggleRunItem() {
  return useRunWrite(async ({ id, done }: { id: string; done: boolean }) => {
    const { error } = await supabase
      .from('checklist_run_items')
      .update({ done_at: done ? new Date().toISOString() : null })
      .eq('id', id)

    if (error) throw error
  })
}

export function useSetRunItemNote() {
  return useRunWrite(async ({ id, note }: { id: string; note: string }) => {
    const { error } = await supabase
      .from('checklist_run_items')
      .update({ note: note.trim() === '' ? null : note.trim() })
      .eq('id', id)

    if (error) throw error
  })
}

/** A run is done when every required item is ticked; the rest are optional. */
export function isRunComplete(run: ChecklistRun) {
  return run.checklist_run_items.every((item) => !item.required || item.done_at)
}

export function runProgress(run: ChecklistRun) {
  const required = run.checklist_run_items.filter((item) => item.required)
  return { done: required.filter((item) => item.done_at).length, total: required.length }
}
