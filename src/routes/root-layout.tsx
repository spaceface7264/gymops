import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router'
import { Button } from '@/components/ui/button'
import { useAuth, useSignOut } from '@/features/auth'

/**
 * Frame for every signed-in screen. Nav, the gym switcher and the responsive
 * layout arrive with the real shell in P1-08; the header carries who is signed
 * in and the way out, because these machines are shared between shifts and a
 * stale session is the wrong person's session.
 */
export function RootLayout() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const signOut = useSignOut()

  return (
    <div className="bg-background text-foreground min-h-dvh">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 p-4">
          <span className="font-semibold tracking-tight">{t('app.name')}</span>
          <div className="flex items-center gap-3">
            {user?.email && (
              <span className="text-muted-foreground text-sm">{user.email}</span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => signOut.mutate()}
              disabled={signOut.isPending}
            >
              {signOut.isPending ? t('auth.signingOut') : t('auth.signOut')}
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl p-6">
        <Outlet />
      </main>
    </div>
  )
}
