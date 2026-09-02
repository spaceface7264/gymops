// P2-03 — the only way a person enters GymOps.
//
// Sign-ups are off (spec §2.1), so an account is created here: the caller's
// rights are checked, an `invites` row records what the person becomes, Supabase
// Auth mails the link, and the membership is applied straight away — the invited
// user already exists at that point and only lacks a password.
//
// Deployment and the settings this depends on: PROJECT_STATE.md, "Hosted
// project cutover".
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import type { Database } from '../../../src/lib/database.types.ts'

type GymRole = Database['public']['Enums']['gym_role']

type InviteRequest = {
  email: string
  fullName?: string
  locale?: 'en' | 'da'
  /** Company-wide admin: no gym, no gym role. Superadmins only. */
  asAdmin?: boolean
  gymId?: string
  role?: GymRole
}

type Caller = {
  id: string
  isAdmin: boolean
  isSuperadmin: boolean
  managedGymIds: string[]
}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

const fail = (status: number, error: string) => json({ error }, status)

function parse(body: unknown): InviteRequest | null {
  if (typeof body !== 'object' || body === null) return null
  const input = body as Record<string, unknown>
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
  if (!email.includes('@')) return null

  const asAdmin = input.asAdmin === true
  const gymId = typeof input.gymId === 'string' ? input.gymId : undefined
  const role = input.role === 'manager' || input.role === 'staff' ? input.role : undefined

  // Mirrors `invites_scope_check`: an admin invite carries no gym, a gym invite
  // carries both gym and role.
  if (asAdmin ? gymId || role : !(gymId && role)) return null

  return {
    email,
    fullName: typeof input.fullName === 'string' ? input.fullName.trim() : undefined,
    locale: input.locale === 'en' ? 'en' : 'da',
    asAdmin,
    gymId,
    role,
  }
}

/** Who is asking, read with their own token so RLS applies. */
async function readCaller(
  service: SupabaseClient<Database>,
  token: string,
): Promise<Caller | null> {
  const { data, error } = await service.auth.getUser(token)
  if (error || !data.user) return null

  const { data: profile } = await service
    .from('profiles')
    .select('id, is_admin, is_superadmin, active, gym_memberships(gym_id, role)')
    .eq('id', data.user.id)
    .single()

  if (!profile?.active) return null

  return {
    id: profile.id,
    isAdmin: profile.is_admin || profile.is_superadmin,
    isSuperadmin: profile.is_superadmin,
    managedGymIds: profile.gym_memberships
      .filter((membership) => membership.role === 'manager')
      .map((membership) => membership.gym_id),
  }
}

/** The "invite users, assign to gyms" row of the permission matrix (§2.1). */
function mayInvite(caller: Caller, request: InviteRequest): boolean {
  if (request.asAdmin) return caller.isSuperadmin
  if (caller.isAdmin) return true
  return request.role === 'staff' && caller.managedGymIds.includes(request.gymId ?? '')
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return fail(405, 'method_not_allowed')

  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return fail(401, 'unauthenticated')

  const service = createClient<Database>(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  )

  const caller = await readCaller(service, token)
  if (!caller) return fail(401, 'unauthenticated')

  const invite = parse(await request.json().catch(() => null))
  if (!invite) return fail(400, 'invalid_request')
  if (!mayInvite(caller, invite)) return fail(403, 'forbidden')

  const { data: existing } = await service
    .from('profiles')
    .select('id')
    .eq('email', invite.email)
    .maybeSingle()
  if (existing) return fail(409, 'already_a_user')

  const { data: inviteRow, error: inviteError } = await service
    .from('invites')
    .insert({
      email: invite.email,
      gym_id: invite.gymId ?? null,
      role: invite.role ?? null,
      as_admin: invite.asAdmin ?? false,
      created_by: caller.id,
    })
    .select('id')
    .single()

  // The partial unique index allows one pending invite per address.
  if (inviteError) {
    return fail(inviteError.code === '23505' ? 409 : 500, 'invite_not_recorded')
  }

  const siteUrl = Deno.env.get('SITE_URL') ?? 'http://localhost:5173'
  const { data: invited, error: mailError } = await service.auth.admin.inviteUserByEmail(
    invite.email,
    {
      redirectTo: `${siteUrl}/accept-invite`,
      data: { full_name: invite.fullName ?? null, locale: invite.locale },
    },
  )

  if (mailError || !invited.user) {
    // Nothing was sent, so the row must not block the next attempt.
    await service.from('invites').delete().eq('id', inviteRow.id)
    return fail(502, 'invite_not_sent')
  }

  // inviteUserByEmail creates the account immediately; it just has no password
  // yet. So the rights the invite promises can be applied now, and the
  // accept-invite screen stays about the password (P1-07).
  const applyError = invite.asAdmin
    ? (
        await service
          .from('profiles')
          .update({ is_admin: true })
          .eq('id', invited.user.id)
      ).error
    : (
        await service.from('gym_memberships').insert({
          user_id: invited.user.id,
          gym_id: invite.gymId ?? '',
          role: invite.role ?? 'staff',
          created_by: caller.id,
        })
      ).error

  if (applyError) return fail(500, 'rights_not_applied')

  return json({ userId: invited.user.id, inviteId: inviteRow.id }, 201)
})
