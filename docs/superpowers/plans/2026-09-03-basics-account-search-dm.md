# Basics pass — account screen, search ranking, staff → admin DMs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a signed-in person change their own name, language and password; order search results by relevance; let staff message admins and see admins by name.

**Architecture:** Three independent tasks on one branch. The account screen is a route plus three mutation hooks in the auth feature, no schema change. Search ranking replaces two client queries with one `security invoker` SQL function returning ranked rows. The DM gap is one policy branch on `profiles_select`; every client path already reads through it.

**Tech Stack:** Vite + React 19 + TS strict, TanStack Query 5, React Router 7, react-i18next (en/da), Supabase (Postgres 17, RLS, pgTAP), Vitest + RTL.

## Global Constraints

- Spec §5 is binding: TypeScript strict, no `any`; components never call Supabase directly — hooks in `features/<x>/queries.ts`; no cross-feature imports except through `@/features/<name>` indexes or `@/lib`; no hard-coded UI strings — every key in both `src/locales/en/common.json` and `src/locales/da/common.json` (keys sorted alphabetically inside each object, `ensure_ascii` off); schema changes only as files in `supabase/migrations/` named `YYYYMMDDHHMMSS_<name>.sql`; every policy change has a pgTAP assertion.
- Gates before every commit: `npm run typecheck && npm run lint && npm run format:check && npm test`; after any migration also `npm run db:reset && npm run db:test` and `npm run db:types` (commit `src/lib/database.types.ts`).
- Conventional commits referencing the task id, e.g. `feat(auth): … (P7B-01)`. Each task's last commit also updates `PROJECT_STATE.md` (task row ✅ with the commit's substance, phase table) per `CLAUDE.md`.
- Commit trailer: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_017Ea1VhKH4BnbZhQb5kz3Mv`.
- Local stack must be up (`npm run db:start`; needs OrbStack) for pgTAP; `npm run db:reset` re-applies migrations and seeds.
- Branch: `basics-account-search-dm` from `main` if PR #9 is merged, else from `phase-7-desktop`. Add rows P7B-01…03 to the "Task status" table of `PROJECT_STATE.md` as 🔄 when starting each task.

---

### Task 1: Account hooks — `useUpdateName`, `useUpdateLocale`, `useChangePassword` (P7B-01)

**Files:**

- Modify: `src/features/auth/queries.ts` (append after `useCompleteInvite`)
- Modify: `src/features/auth/index.ts` (export the three hooks)
- Test: `src/features/auth/account.test.tsx` (new)

**Interfaces:**

- Consumes: `supabase` (`@/lib/supabase`), `useAuth()` → `{ user }` with `user.id`, `user.email`; `Profile['locale']` is `'en' | 'da'`.
- Produces:
  - `useUpdateName(): UseMutationResult<void, Error, string>` — variable is the new full name (already trimmed by the caller).
  - `useUpdateLocale(): UseMutationResult<void, Error, Profile['locale']>`.
  - `useChangePassword(): UseMutationResult<void, Error, { current: string; next: string }>` — throws `Error('wrong_password')` when the current password is refused; anything else rethrows the Supabase error.
  - All three invalidate `['auth']` on success.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/features/auth/account.test.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AuthProvider,
  useChangePassword,
  useUpdateLocale,
  useUpdateName,
} from '@/features/auth'

type Err = { message: string } | null
const signInWithPassword = vi.fn<() => Promise<{ error: Err }>>()
const updateUser = vi.fn<(attrs: Record<string, unknown>) => Promise<{ error: Err }>>()
const update = vi.fn<(values: Record<string, unknown>) => void>()
const session = {
  access_token: 't',
  user: { id: 'user-1', email: 'staff@gymops.test' },
} as Session

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signInWithPassword: () => signInWithPassword(),
      updateUser: (attrs: Record<string, unknown>) => updateUser(attrs),
    },
    from: () => ({
      update: (values: Record<string, unknown>) => {
        update(values)
        return { eq: () => Promise.resolve({ error: null }) }
      },
      select: () => ({
        eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }),
      }),
    }),
  },
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  signInWithPassword.mockResolvedValue({ error: null })
  updateUser.mockResolvedValue({ error: null })
})

describe('account hooks', () => {
  it('writes a new name to the profile and the auth user', async () => {
    const { result } = renderHook(() => useUpdateName(), { wrapper })
    await waitFor(() => expect(result.current.mutate).toBeDefined())
    result.current.mutate('Sam Stone')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(update).toHaveBeenCalledWith({ full_name: 'Sam Stone' })
    expect(updateUser).toHaveBeenCalledWith({ data: { full_name: 'Sam Stone' } })
  })

  it('writes a new locale to the profile and the auth user', async () => {
    const { result } = renderHook(() => useUpdateLocale(), { wrapper })
    await waitFor(() => expect(result.current.mutate).toBeDefined())
    result.current.mutate('en')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(update).toHaveBeenCalledWith({ locale: 'en' })
    expect(updateUser).toHaveBeenCalledWith({ data: { locale: 'en' } })
  })

  it('checks the current password before setting the new one', async () => {
    const { result } = renderHook(() => useChangePassword(), { wrapper })
    await waitFor(() => expect(result.current.mutate).toBeDefined())
    result.current.mutate({ current: 'Password123', next: 'Bouldering2026' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(signInWithPassword).toHaveBeenCalledTimes(1)
    expect(updateUser).toHaveBeenCalledWith({ password: 'Bouldering2026' })
  })

  it('refuses a wrong current password without touching the account', async () => {
    signInWithPassword.mockResolvedValue({
      error: { message: 'Invalid login credentials' },
    })
    const { result } = renderHook(() => useChangePassword(), { wrapper })
    await waitFor(() => expect(result.current.mutate).toBeDefined())
    result.current.mutate({ current: 'nope', next: 'Bouldering2026' })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('wrong_password')
    expect(updateUser).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/features/auth/account.test.tsx`
Expected: FAIL — `useUpdateName` (etc.) is not exported from `@/features/auth`.

- [ ] **Step 3: Implement the hooks**

Append to `src/features/auth/queries.ts`:

```ts
/**
 * P7B-01 — the account screen. Name and language are written to both the
 * profile row (what the app reads) and the auth user's metadata (what the
 * invite flow wrote there), the way `useCompleteInvite` does.
 */
function useOwnProfileWrite<T>(
  toProfile: (value: T) => Partial<Pick<Profile, 'full_name' | 'locale'>>,
) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (value: T) => {
      if (!user) throw new Error('not signed in')
      const values = toProfile(value)

      const { error } = await supabase.auth.updateUser({ data: values })
      if (error) throw error

      const { error: profileError } = await supabase
        .from('profiles')
        .update(values)
        .eq('id', user.id)
      if (profileError) throw profileError
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['auth'] }),
  })
}

export function useUpdateName() {
  return useOwnProfileWrite((fullName: string) => ({ full_name: fullName }))
}

export function useUpdateLocale() {
  return useOwnProfileWrite((locale: Profile['locale']) => ({ locale }))
}

export type PasswordChange = { current: string; next: string }

/**
 * A live session proves access, not ownership: the current password is
 * checked first, by signing in again with it, so somebody at an unlocked
 * front-desk machine cannot take the account over. A wrong one is reported
 * as `wrong_password`; nothing has been changed at that point.
 */
export function useChangePassword() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ current, next }: PasswordChange) => {
      if (!user?.email) throw new Error('not signed in')

      const check = await supabase.auth.signInWithPassword({
        email: user.email,
        password: current,
      })
      if (check.error) throw new Error('wrong_password')

      const { error } = await supabase.auth.updateUser({ password: next })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['auth'] }),
  })
}
```

In `src/features/auth/index.ts`, extend the `queries` export block:

```ts
  useChangePassword,
  useUpdateLocale,
  useUpdateName,
  type PasswordChange,
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/features/auth/account.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Gates and commit**

```bash
npm run typecheck && npm run lint && npm run format:check && npm test
git add src/features/auth
git commit -m "feat(auth): own name, language and password hooks (P7B-01)"
```

---

### Task 2: The account screen — route, header link, strings (P7B-01)

**Files:**

- Create: `src/routes/account-page.tsx`
- Test: `src/routes/account-page.test.tsx`
- Modify: `src/routes/router.tsx` (add `{ path: 'account', element: <AccountPage /> }` among the shell's children, next to `install`)
- Modify: `src/routes/app-shell.tsx:82-86` (the email `<span>` becomes a `<Link to="/account">`)
- Modify: `src/locales/en/common.json`, `src/locales/da/common.json` (`auth.account.*`)
- Modify: `PROJECT_STATE.md` (P7B-01 row ✅)

**Interfaces:**

- Consumes: Task 1's hooks; `useProfile()` → `data.full_name`, `data.locale`; `PasswordFields` props `{ passwordLabel, confirmLabel, password, confirm, onPasswordChange, onConfirmChange }`; `checkPassword(password, confirm): PasswordProblem | null`; `supportedLocales`, `Locale` from `@/lib/i18n`; shadcn `Button`, `Input`, `Label`, `Card`, `CardHeader`, `CardTitle`, `CardContent` from `@/components/ui/*`.
- Produces: `AccountPage` (named export).

- [ ] **Step 1: Add the strings**

In `en/common.json` under `auth`, a new `account` object (keep `auth`'s keys sorted: `acceptInvite`, `account`, `callback`, …):

```json
"account": {
  "current": "Current password",
  "language": "Language",
  "languageSaved": "Language saved.",
  "name": "Full name",
  "nameEmpty": "Enter your name.",
  "nameSaved": "Name saved.",
  "newPassword": "New password",
  "password": "Password",
  "passwordSaved": "Password changed.",
  "repeat": "Repeat new password",
  "save": "Save",
  "saveFailed": "The change could not be saved. Try again.",
  "saving": "Saving…",
  "title": "Your account",
  "wrongPassword": "That is not your current password."
}
```

`da/common.json`:

```json
"account": {
  "current": "Nuværende adgangskode",
  "language": "Sprog",
  "languageSaved": "Sprog gemt.",
  "name": "Fulde navn",
  "nameEmpty": "Skriv dit navn.",
  "nameSaved": "Navn gemt.",
  "newPassword": "Ny adgangskode",
  "password": "Adgangskode",
  "passwordSaved": "Adgangskoden er ændret.",
  "repeat": "Gentag ny adgangskode",
  "save": "Gem",
  "saveFailed": "Ændringen kunne ikke gemmes. Prøv igen.",
  "saving": "Gemmer…",
  "title": "Din konto",
  "wrongPassword": "Det er ikke din nuværende adgangskode."
}
```

- [ ] **Step 2: Write the failing page test**

```tsx
// src/routes/account-page.test.tsx
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/features/auth'
import { i18next } from '@/lib/i18n'
import { AccountPage } from '@/routes/account-page'
import { renderWithProviders } from '@/test/render'

type Err = { message: string } | null
const signInWithPassword = vi.fn<() => Promise<{ error: Err }>>()
const updateUser = vi.fn<(attrs: Record<string, unknown>) => Promise<{ error: Err }>>()
const update = vi.fn<(values: Record<string, unknown>) => void>()
const profile = {
  id: 'user-1',
  full_name: 'Sam Staff',
  locale: 'en',
  gym_memberships: [],
}
const session = {
  access_token: 't',
  user: { id: 'user-1', email: 'staff@gymops.test' },
} as Session

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signInWithPassword: () => signInWithPassword(),
      updateUser: (attrs: Record<string, unknown>) => updateUser(attrs),
    },
    from: () => ({
      update: (values: Record<string, unknown>) => {
        update(values)
        return { eq: () => Promise.resolve({ error: null }) }
      },
      select: () => ({
        eq: () => ({ single: () => Promise.resolve({ data: profile, error: null }) }),
      }),
    }),
  },
}))

function renderPage() {
  return renderWithProviders(
    <AuthProvider>
      <AccountPage />
    </AuthProvider>,
    { path: '/account' },
  )
}

beforeEach(async () => {
  vi.clearAllMocks()
  signInWithPassword.mockResolvedValue({ error: null })
  updateUser.mockResolvedValue({ error: null })
  await i18next.changeLanguage('en')
})

describe('AccountPage', () => {
  it('starts from the stored name and saves a new one', async () => {
    const user = userEvent.setup()
    renderPage()
    const name = await screen.findByLabelText('Full name')
    await waitFor(() => expect(name).toHaveValue('Sam Staff'))

    await user.clear(name)
    await user.type(name, 'Sam Stone')
    await user.click(screen.getAllByRole('button', { name: 'Save' })[0]!)

    expect(await screen.findByText('Name saved.')).toBeInTheDocument()
    expect(update).toHaveBeenCalledWith({ full_name: 'Sam Stone' })
  })

  it('refuses an empty name without saving', async () => {
    const user = userEvent.setup()
    renderPage()
    const name = await screen.findByLabelText('Full name')
    await waitFor(() => expect(name).toHaveValue('Sam Staff'))

    await user.clear(name)
    await user.click(screen.getAllByRole('button', { name: 'Save' })[0]!)

    expect(await screen.findByText('Enter your name.')).toBeInTheDocument()
    expect(update).not.toHaveBeenCalled()
  })

  it('saves a new language', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByLabelText('Full name')

    await user.selectOptions(screen.getByLabelText('Language'), 'da')
    await user.click(screen.getAllByRole('button', { name: 'Save' })[1]!)

    await waitFor(() => expect(update).toHaveBeenCalledWith({ locale: 'da' }))
  })

  it('changes the password when the current one is right', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByLabelText('Full name')

    await user.type(screen.getByLabelText('Current password'), 'Password123')
    await user.type(screen.getByLabelText('New password'), 'Bouldering2026')
    await user.type(screen.getByLabelText('Repeat new password'), 'Bouldering2026')
    await user.click(screen.getAllByRole('button', { name: 'Save' })[2]!)

    expect(await screen.findByText('Password changed.')).toBeInTheDocument()
    expect(updateUser).toHaveBeenCalledWith({ password: 'Bouldering2026' })
  })

  it('says so when the current password is wrong', async () => {
    signInWithPassword.mockResolvedValue({
      error: { message: 'Invalid login credentials' },
    })
    const user = userEvent.setup()
    renderPage()
    await screen.findByLabelText('Full name')

    await user.type(screen.getByLabelText('Current password'), 'nope')
    await user.type(screen.getByLabelText('New password'), 'Bouldering2026')
    await user.type(screen.getByLabelText('Repeat new password'), 'Bouldering2026')
    await user.click(screen.getAllByRole('button', { name: 'Save' })[2]!)

    expect(
      await screen.findByText('That is not your current password.'),
    ).toBeInTheDocument()
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('refuses a weak or mismatched new password before asking the server', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByLabelText('Full name')

    await user.type(screen.getByLabelText('Current password'), 'Password123')
    await user.type(screen.getByLabelText('New password'), 'Bouldering2026')
    await user.type(screen.getByLabelText('Repeat new password'), 'Bouldering2027')
    await user.click(screen.getAllByRole('button', { name: 'Save' })[2]!)

    expect(await screen.findByText('The two passwords do not match.')).toBeInTheDocument()
    expect(signInWithPassword).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/routes/account-page.test.tsx`
Expected: FAIL — cannot resolve `@/routes/account-page`.

- [ ] **Step 4: Write the page**

```tsx
// src/routes/account-page.tsx
import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  PasswordFields,
  checkPassword,
  useChangePassword,
  useProfile,
  useUpdateLocale,
  useUpdateName,
  type PasswordProblem,
} from '@/features/auth'
import { supportedLocales, type Locale } from '@/lib/i18n'

/**
 * `/account` (P7B-01): the person's own name, language and password, each a
 * card with its own save. Nothing here is a permission — `profiles_update`
 * lets a person edit their own row and `guard_profile_privileges()` keeps
 * the role flags out of reach.
 */
export function AccountPage() {
  const { t } = useTranslation()

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold">{t('auth.account.title')}</h1>
      <NameCard />
      <LanguageCard />
      <PasswordCard />
    </div>
  )
}

function Feedback({
  saved,
  failed,
  savedText,
  failedText,
}: {
  saved: boolean
  failed: boolean
  savedText: string
  failedText: string
}) {
  if (failed)
    return (
      <p role="alert" className="text-destructive text-sm">
        {failedText}
      </p>
    )
  if (saved) return <p className="text-muted-foreground text-sm">{savedText}</p>
  return null
}

function NameCard() {
  const { t } = useTranslation()
  const { data: profile } = useProfile()
  const updateName = useUpdateName()
  // null until the person types: the profile arrives after the first render.
  const [typed, setTyped] = useState<string | null>(null)
  const [empty, setEmpty] = useState(false)
  const value = typed ?? profile?.full_name ?? ''

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = value.trim()
    setEmpty(name === '')
    if (name === '') return
    updateName.mutate(name)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('auth.account.name')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={handleSubmit} noValidate>
          <div className="space-y-2">
            <Label htmlFor="account-name">{t('auth.account.name')}</Label>
            <Input
              id="account-name"
              autoComplete="name"
              value={value}
              onChange={(event) => setTyped(event.target.value)}
            />
          </div>
          {empty && (
            <p role="alert" className="text-destructive text-sm">
              {t('auth.account.nameEmpty')}
            </p>
          )}
          <Feedback
            saved={updateName.isSuccess}
            failed={updateName.isError}
            savedText={t('auth.account.nameSaved')}
            failedText={t('auth.account.saveFailed')}
          />
          <Button type="submit" disabled={updateName.isPending}>
            {updateName.isPending ? t('auth.account.saving') : t('auth.account.save')}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function LanguageCard() {
  const { t } = useTranslation()
  const { data: profile } = useProfile()
  const updateLocale = useUpdateLocale()
  const [locale, setLocale] = useState<Locale>('da')

  useEffect(() => {
    if (profile?.locale && supportedLocales.includes(profile.locale as Locale)) {
      setLocale(profile.locale as Locale)
    }
  }, [profile?.locale])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    updateLocale.mutate(locale)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('auth.account.language')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="account-locale">{t('auth.account.language')}</Label>
            <select
              id="account-locale"
              className="border-input bg-background h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs"
              value={locale}
              onChange={(event) => setLocale(event.target.value as Locale)}
            >
              {supportedLocales.map((option) => (
                <option key={option} value={option}>
                  {t(`language.${option}`)}
                </option>
              ))}
            </select>
          </div>
          <Feedback
            saved={updateLocale.isSuccess}
            failed={updateLocale.isError}
            savedText={t('auth.account.languageSaved')}
            failedText={t('auth.account.saveFailed')}
          />
          <Button type="submit" disabled={updateLocale.isPending}>
            {updateLocale.isPending ? t('auth.account.saving') : t('auth.account.save')}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function PasswordCard() {
  const { t } = useTranslation()
  const changePassword = useChangePassword()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [problem, setProblem] = useState<PasswordProblem | null>(null)
  const wrongCurrent = changePassword.error?.message === 'wrong_password'

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextProblem = checkPassword(next, confirm)
    setProblem(nextProblem)
    if (nextProblem) return
    changePassword.mutate(
      { current, next },
      {
        onSuccess: () => {
          setCurrent('')
          setNext('')
          setConfirm('')
        },
      },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('auth.account.password')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={handleSubmit} noValidate>
          <div className="space-y-2">
            <Label htmlFor="account-current">{t('auth.account.current')}</Label>
            <Input
              id="account-current"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
            />
          </div>
          <PasswordFields
            passwordLabel={t('auth.account.newPassword')}
            confirmLabel={t('auth.account.repeat')}
            password={next}
            confirm={confirm}
            onPasswordChange={setNext}
            onConfirmChange={setConfirm}
          />
          {(problem ?? changePassword.isError) && (
            <p role="alert" className="text-destructive text-sm">
              {problem
                ? t(`auth.${problem}`)
                : wrongCurrent
                  ? t('auth.account.wrongPassword')
                  : t('auth.account.saveFailed')}
            </p>
          )}
          {changePassword.isSuccess && !problem && (
            <p className="text-muted-foreground text-sm">
              {t('auth.account.passwordSaved')}
            </p>
          )}
          <Button type="submit" disabled={changePassword.isPending}>
            {changePassword.isPending ? t('auth.account.saving') : t('auth.account.save')}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
```

Check what `PasswordFields` renders for its inputs' `id`s: if both the reset screen and this one mount it once per page, its fixed ids are fine; the test finds them by label.

- [ ] **Step 5: Route and header link**

`src/routes/router.tsx` — add the import `import { AccountPage } from '@/routes/account-page'` (alphabetical among the `@/routes/*` imports) and the child route after `{ path: 'install', element: <InstallPage /> }`:

```tsx
          { path: 'account', element: <AccountPage /> },
```

`src/routes/app-shell.tsx` — `Link` is already imported? It imports `NavLink`; add `Link` to the `react-router` import. Replace the email span:

```tsx
{
  user?.email && (
    <Link
      to="/account"
      className="text-muted-foreground hidden text-sm hover:underline sm:inline"
    >
      {user.email}
    </Link>
  )
}
```

On phone widths the email is hidden; there add the same link as an icon-only button next to the bell so `/account` is reachable on a phone:

```tsx
<Button variant="ghost" size="icon" className="sm:hidden" asChild>
  <Link to="/account" aria-label={t('auth.account.title')}>
    <UserRound className="size-5" />
  </Link>
</Button>
```

with `UserRound` from `lucide-react`. Update `src/routes/app-shell.test.tsx` if it asserts on the email span's element type (check by running it).

- [ ] **Step 6: Run the tests**

Run: `npx vitest run src/routes/account-page.test.tsx src/routes/app-shell.test.tsx`
Expected: PASS.

- [ ] **Step 7: Check it in the browser**

`npm run dev`, sign in as `staff@gymops.test`, click the email in the header: change the name (header/"by" labels follow), switch language to Danish (UI switches at once), change the password with a wrong current password (message, nothing changes), then with the right one; sign out and in with the new password. Run `npm run db:reset` afterwards so the seed password is back.

- [ ] **Step 8: Docs, gates, commit**

`PROJECT_STATE.md`: P7B-01 row ✅ (what was built, the browser check, test count); phase table row for P7b. Then:

```bash
npm run typecheck && npm run lint && npm run format:check && npm test
git add -A
git commit -m "feat(auth): the account screen — own name, language and password (P7B-01)"
```

---

### Task 3: `content_search()` — ranked search in the database (P7B-02)

**Files:**

- Create: `supabase/migrations/20260904090000_content_search.sql`
- Create: `supabase/tests/230-content-search.test.sql`
- Modify: `src/lib/database.types.ts` (regenerated by `npm run db:types`)

**Interfaces:**

- Consumes: `public.posts` and `public.guides` (columns `id uuid, title text, body_text text, status content_status, gym_id uuid, deleted_at timestamptz, search_vector tsvector`), `public.gyms(id, name)`; the existing select policies on both tables.
- Produces: `public.content_search(query text) returns table (kind text, id uuid, title text, body_text text, status text, gym_name text, rank real)`, `security invoker`, granted to `authenticated`. `kind` is `'news'` or `'guide'`.

- [ ] **Step 1: Write the failing pgTAP test**

```sql
-- supabase/tests/230-content-search.test.sql
-- P7B-02 — content_search(): one ranked list over news and guides, and no
-- more than the caller could read table by table.
begin;
select plan(7);

insert into public.gyms (id, name, slug)
values
  ('11111111-1111-1111-1111-111111111111', 'Gym A', 'gym-a'),
  ('22222222-2222-2222-2222-222222222222', 'Gym B', 'gym-b');

select tests.create_user('admin');
select tests.create_user('staff_a');
update public.profiles set is_admin = true where id = tests.get_user_id('admin');
insert into public.gym_memberships (user_id, gym_id, role)
values (tests.get_user_id('staff_a'), '11111111-1111-1111-1111-111111111111', 'staff');

select tests.authenticate_as('admin');
-- A Tiptap document with one paragraph; `tiptap_text()` flattens it.
insert into public.posts (id, gym_id, title, body, status, published_at)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', null, 'Chalk policy',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Only liquid chalk from Monday."}]}]}',
   'published', now()),
  ('aaaaaaaa-0000-0000-0000-000000000002', null, 'Opening hours',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"We mention chalk once, in passing."}]}]}',
   'published', now()),
  ('aaaaaaaa-0000-0000-0000-000000000003', null, 'Draft about chalk',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Not published."}]}]}',
   'draft', null);
insert into public.guides (id, gym_id, title, body, status, published_at)
values
  ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Chalk in Gym B',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Gym B only."}]}]}',
   'published', now());

select has_function('public', 'content_search', array['text'], 'content_search exists');
select is(
  (select prosecdef from pg_proc where oid = 'public.content_search(text)'::regprocedure),
  false,
  'and runs as the caller'
);

select tests.authenticate_as('staff_a');
select results_eq(
  $$ select id from public.content_search('chalk') $$,
  $$ values ('aaaaaaaa-0000-0000-0000-000000000001'::uuid),
            ('aaaaaaaa-0000-0000-0000-000000000002'::uuid) $$,
  'staff get the published posts they may read, title hit first, and nothing from Gym B or a draft'
);
select is(
  (select kind from public.content_search('chalk') limit 1),
  'news',
  'rows say what they are'
);
select is(
  (select count(*)::int from public.content_search('liquid')),
  1,
  'a body-only word still matches'
);

select tests.authenticate_as('admin');
select is(
  (select count(*)::int from public.content_search('chalk')),
  4,
  'the admin sees the draft and the other gym too'
);
select is(
  (select gym_name from public.content_search('chalk') where kind = 'guide'),
  'Gym B',
  'the gym name rides along'
);

select * from finish();
rollback;
```

Check the `posts`/`guides` insert column lists against `20260902090000_content_schema.sql` before running (whether `published_at` is set by a trigger — if the insert above fails on a column, follow the columns the schema actually has; `040-content-permissions.test.sql` shows working inserts).

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run db:reset && npm run db:test`
Expected: `230-content-search` fails on `has_function` (function does not exist).

- [ ] **Step 3: Write the migration**

```sql
-- supabase/migrations/20260904090000_content_search.sql
-- P7B-02 — one ranked search over news and guides. `security invoker`: the
-- select policies on posts and guides decide what can match, exactly as the
-- two direct queries the client ran until now. `ts_rank` on the generated
-- search_vector puts a title hit above a passing mention.

create function public.content_search(query text)
returns table (
  kind text,
  id uuid,
  title text,
  body_text text,
  status text,
  gym_name text,
  rank real
)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (select websearch_to_tsquery('simple', query) as tsq)
  select * from (
    select 'news'::text as kind, p.id, p.title, p.body_text, p.status::text,
           g.name as gym_name, ts_rank(p.search_vector, q.tsq) as rank
    from public.posts p
    left join public.gyms g on g.id = p.gym_id
    cross join q
    where p.deleted_at is null and p.search_vector @@ q.tsq
    union all
    select 'guide'::text, d.id, d.title, d.body_text, d.status::text,
           g.name, ts_rank(d.search_vector, q.tsq)
    from public.guides d
    left join public.gyms g on g.id = d.gym_id
    cross join q
    where d.deleted_at is null and d.search_vector @@ q.tsq
  ) hits
  order by rank desc, title
  limit 40;
$$;

comment on function public.content_search(text) is
  'Ranked full-text search over posts and guides the caller may read (P7B-02).';

grant execute on function public.content_search(text) to authenticated;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run db:reset && npm run db:test`
Expected: all files pass, `230-content-search` 7/7. If the ordering assertion fails because two ranks tie, make the title-hit post's body mention chalk twice instead of once.

- [ ] **Step 5: Regenerate types, lint SQL, commit**

```bash
npm run db:types && npm run db:lint
git add supabase/migrations/20260904090000_content_search.sql supabase/tests/230-content-search.test.sql src/lib/database.types.ts
git commit -m "db: content_search() — ranked search over news and guides (P7B-02)"
```

---

### Task 4: The client uses `content_search()` (P7B-02)

**Files:**

- Modify: `src/features/content/search.ts:44-90` (`useContentSearch` body)
- Modify: `src/features/content/search.test.tsx:1-55` (the mock)
- Modify: `PROJECT_STATE.md` (P7B-02 row ✅; strike "Search has no ranking" from the Known-gaps row), `PROJECT_SPEC.md` §4 (one line: why a SQL function rather than ordering in the client)

**Interfaces:**

- Consumes: `supabase.rpc('content_search', { query })` typed from `database.types.ts` as rows `{ kind: string; id: string; title: string; body_text: string | null; status: string; gym_name: string | null; rank: number }`.
- Produces: unchanged `useContentSearch(query): UseQueryResult<SearchHit[]>`; results arrive in rank order.

- [ ] **Step 1: Update the test mock**

Replace the `builder`/`from` mock at the top of `search.test.tsx` with an rpc mock that returns rows in rank order, and keep every existing assertion:

```tsx
type Row = Record<string, unknown>
const rpc = vi.fn<(fn: string, args: Row) => Promise<{ data: Row[]; error: null }>>()

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: (fn: string, args: Row) => rpc(fn, args) },
}))

beforeEach(() => {
  vi.clearAllMocks()
  rpc.mockResolvedValue({
    data: [
      {
        kind: 'guide',
        id: 'guide-1',
        title: 'Evacuation',
        body_text: 'Gather everyone by the front door.',
        status: 'draft',
        gym_name: 'Copenhagen Nord',
        rank: 0.6,
      },
      {
        kind: 'news',
        id: 'post-1',
        title: 'New chalk policy',
        body_text: 'From Monday only liquid chalk is allowed in the whole gym.',
        status: 'published',
        gym_name: null,
        rank: 0.3,
      },
    ],
    error: null,
  })
})
```

Then adjust: the assertion that used `textSearch` becomes `expect(rpc).toHaveBeenCalledWith('content_search', { query: 'chalk' })` (or whatever term the test types); add one assertion that the first listed result is _Evacuation_ (rank order, not alphabetical):

```tsx
it('lists results in the order the database ranked them', async () => {
  const user = userEvent.setup()
  renderWithProviders(<ContentSearch />)
  await user.type(screen.getByRole('searchbox'), 'door')
  const list = await screen.findByRole('list', { name: 'Search results' })
  const items = within(list).getAllByRole('listitem')
  expect(items[0]).toHaveTextContent('Evacuation')
  expect(items[1]).toHaveTextContent('New chalk policy')
})
```

(`content.results` is "Search results" in `en/common.json`.)

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/features/content/search.test.tsx`
Expected: FAIL — `supabase.from is not a function` / rpc never called.

- [ ] **Step 3: Rewrite `useContentSearch`**

```ts
/**
 * One search over news and guides (P3-06, ranked in P7B-02).
 * `content_search()` runs `websearch_to_tsquery` with the `simple`
 * configuration against the generated `search_vector` columns — quoted
 * phrases and `-word` work, neither language is stemmed into the other — and
 * orders by `ts_rank`, so a title hit comes before a passing mention. It is
 * `security invoker`: RLS decides what can match at all.
 */
export function useContentSearch(query: string) {
  const text = query.trim()

  return useQuery({
    queryKey: searchKeys.query(text),
    enabled: text.length >= minSearchLength,
    queryFn: async (): Promise<SearchHit[]> => {
      const { data, error } = await supabase.rpc('content_search', { query: text })
      if (error) throw error

      return data.map((row) => ({
        kind: row.kind === 'guide' ? ('guide' as const) : ('news' as const),
        id: row.id,
        title: row.title,
        snippet: snippet(row.body_text, text),
        scopeName: row.gym_name,
        isDraft: row.status === 'draft',
      }))
    },
  })
}
```

Remove the now-unused `.sort(...)`; nothing else in the file changes.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/features/content`
Expected: PASS.

- [ ] **Step 5: Check it in the browser**

`npm run dev`, open `/guides`, search a word that appears in one guide's title and another's body: the title hit is first.

- [ ] **Step 6: Docs, gates, commit**

`PROJECT_STATE.md`: P7B-02 ✅; in Known gaps, change "Search has no ranking; …" to strike that clause. `PROJECT_SPEC.md` §4 rejected-options table, one row: "Ranking in the client (sorting the two lists by a score computed in JS) | The score lives with the vector; two queries cannot be ranked against each other without the database's `ts_rank`, and one function is also one round trip."

```bash
npm run typecheck && npm run lint && npm run format:check && npm test
git add -A
git commit -m "feat(content): search results in rank order through content_search() (P7B-02)"
```

---

### Task 5: Admins visible to everyone — staff → admin DMs (P7B-03)

**Files:**

- Create: `supabase/migrations/20260904100000_profiles_see_admins.sql`
- Modify: `supabase/tests/010-core-permissions.test.sql:95-105` (staff visibility assertion) and its `plan()` count
- Modify: `supabase/tests/210-chat-dm.test.sql` (fixtures + three assertions, `plan()` count)
- Modify: `PROJECT_STATE.md` (P7B-03 ✅; strike the "Staff cannot start a DM with an admin" gap; decisions log), `PROJECT_SPEC.md` §2.1 (one bullet: admins are visible to everyone)

**Interfaces:**

- Consumes: `profiles_select` as defined in `20260902180000_daily_log.sql:38-50` (copy its body verbatim, then add the branch); `tests.create_user`, `tests.authenticate_as`, `tests.get_user_id`.
- Produces: the policy with the extra branch; no client change.

- [ ] **Step 1: Write the failing assertions**

`010-core-permissions.test.sql` — replace the staff assertion at lines ~100-105:

```sql
-- Colleagues, since P4-06, and — since P7B-03 — every active admin: `#company`
-- puts them in the same channel, and a name has to come from somewhere.
select results_eq(
  $$ select id from public.profiles order by id $$,
  $$ select id from (values (tests.get_user_id('staff_a')),
                            (tests.get_user_id('manager_a')),
                            (tests.get_user_id('admin')),
                            (tests.get_user_id('super'))) v(id) order by id $$,
  'staff see themselves, the people they share a gym with, and the admins'
);
```

The manager assertion ("manager sees themselves and the members of their gyms", count 2) becomes count 4 with the text "… and the admins". `plan(33)` stays 33 (assertions replaced, not added) — recount after editing.

`210-chat-dm.test.sql` — fixtures: add `select tests.create_user('admin'); select tests.create_user('old_admin');` and

```sql
update public.profiles set is_admin = true
where id in (tests.get_user_id('admin'), tests.get_user_id('old_admin'));
update public.profiles set active = false where id = tests.get_user_id('old_admin');
```

Assertions, appended before `select * from finish();` while authenticated as `staff_a`:

```sql
-- ------------------------------------------------------- reaching an admin --
select tests.authenticate_as('staff_a');
select lives_ok(
  $$ select public.start_dm(array[tests.get_user_id('admin')]) $$,
  'staff can open a DM with an admin (P7B-03)'
);
select throws_ok(
  $$ select public.start_dm(array[tests.get_user_id('old_admin')]) $$,
  'P0001',
  'Cannot start a conversation with somebody you cannot see',
  'but not with a deactivated admin'
);
select throws_ok(
  $$ select public.start_dm(array[tests.get_user_id('staff_b')]) $$,
  'P0001',
  'Cannot start a conversation with somebody you cannot see',
  'and still not with staff at another gym'
);
```

Raise `plan(17)` to `plan(20)`. If an earlier assertion in this file counts DMs or channels for `staff_a`, check whether the new DM with the admin changes it (the new assertions run last, so it should not).

- [ ] **Step 2: Run to verify they fail**

Run: `npm run db:reset && npm run db:test`
Expected: `010` fails on the two visibility assertions; `210` fails "staff can open a DM with an admin".

- [ ] **Step 3: Write the migration**

```sql
-- supabase/migrations/20260904100000_profiles_see_admins.sql
-- P7B-03 — every active person sees the active admins. `#company` already
-- seats staff and admins together, and `start_dm()`, the member lists and
-- the @mention picker all read names through this policy: without the
-- branch an admin was a nameless row to staff and could not be messaged.
-- A superadmin is also `is_admin`, and is reachable too (decided 2026-09-03).
-- A deactivated admin stays invisible, like anybody deactivated.

drop policy profiles_select on public.profiles;

create policy profiles_select on public.profiles
  for select to authenticated using (
    id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.gym_memberships m
      where m.user_id = profiles.id and m.gym_id in (select public.managed_gym_ids())
    )
    -- Colleagues: somebody you share a gym with.
    or public.shares_gym_with(profiles.id)
    -- The admins: the people #company puts you in a room with.
    or (profiles.active and (profiles.is_admin or profiles.is_superadmin))
  );
```

Before writing it, open `20260902180000_daily_log.sql:38-50` and copy the _current_ policy body exactly (the colleague branch may read differently from the line above); only the last `or (...)` is new.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run db:reset && npm run db:test`
Expected: every file passes. If another file's count of visible profiles moves (grep `from public.profiles` in `supabase/tests/`), update that assertion's expected number and its message to say "and the admins".

- [ ] **Step 5: Check it in the browser**

`npm run dev`, sign in as `staff@gymops.test`: Chat → new DM → the picker lists `admin@gymops.test` and `super@gymops.test`; open the DM and send a line; in `#company` the member list shows the admin's name. Sign in as `admin@` and see the DM.

- [ ] **Step 6: Docs, types, gates, commit**

`npm run db:types` (no change expected; commit if it moves). `PROJECT_STATE.md`: P7B-03 ✅; strike the "Staff cannot start a DM with an admin (P6-06)" gap row with a note pointing at this task; decisions log: "P7B-03: admins are visible to everyone (option 1 of the three in the P6-06 note) — one policy fixes the DM and the blank names, and #company already implied it." `PROJECT_SPEC.md` §2.1: add a bullet "Every active person can see the active admins and superadmins (name, email, phone); gym members see each other; managers see their gyms' members; admins see everyone."

```bash
npm run typecheck && npm run lint && npm run format:check && npm test
git add -A
git commit -m "db: admins are visible to everyone — staff can DM an admin (P7B-03)"
```

---

### Task 6: Finish the branch

**Files:**

- Modify: `PROJECT_STATE.md` ("Currently working on", phase table), `PROJECT_TASKS.md` (nothing unless a task changed shape)

- [ ] **Step 1: Full gates once more**

```bash
npm run typecheck && npm run lint && npm run format:check && npm test && npm run build
npm run db:reset && npm run db:test && npm run db:types && git diff --exit-code src/lib/database.types.ts
npm run e2e
```

Expected: all green; the e2e sign-in flow still passes with the header change.

- [ ] **Step 2: State and push**

`PROJECT_STATE.md`: phase table row "P7b Basics — ✅ Complete — P7B-01…03, PR #N"; "Currently working on" mentions the PR. Commit `docs: the basics pass is on its branch (P7B)`, push, open a PR against `main` titled "Basics pass — account screen, ranked search, staff → admin DMs (P7B-01 … P7B-03)" with a body listing the three changes and how each was verified.
