import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useSignOut } from './queries'

/**
 * What a deactivated person sees if they were signed in when it happened. RLS
 * already returns them nothing, so the app would otherwise look empty and
 * broken rather than closed.
 */
export function DeactivatedNotice() {
  const { t } = useTranslation()
  const signOut = useSignOut()

  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>{t('auth.deactivated.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">{t('auth.deactivated.body')}</p>
          <Button onClick={() => signOut.mutate()} disabled={signOut.isPending}>
            {t('auth.signOut')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
