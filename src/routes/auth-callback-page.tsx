import { useTranslation } from 'react-i18next'
import { Link, Navigate, useLocation } from 'react-router'
import { Button } from '@/components/ui/button'
import { parseAuthCallback, useExchangeCode } from '@/features/auth'
import { isDesktop } from '@/lib/platform'
import { AuthLayout } from '@/routes/auth-layout'

/**
 * Where an auth mail link lands (P7-02). Invite mails point here on the web,
 * and the screen offers to hand the invite to the desktop app — or to finish
 * in the browser, for a phone or a machine without the app. Inside the desktop
 * app the deep link routes here too, and the screen goes straight on: a PKCE
 * `code` (a recovery link the app asked for) is exchanged for a session, an
 * invite's fragment is carried on to the accept-invite screen.
 */
export function AuthCallbackPage() {
  const { t } = useTranslation()
  const location = useLocation()
  const callback = parseAuthCallback(
    `${window.location.origin}${location.pathname}${location.search}${location.hash}`,
  )
  const code = new URLSearchParams(location.search).get('code')
  const exchange = useExchangeCode(code)

  if (code) {
    if (exchange.isSuccess) return <Navigate to="/reset-password" replace />
    if (!exchange.isError) return null
    return (
      <AuthLayout title={t('auth.resetPassword.title')}>
        <div className="space-y-4">
          <p className="text-sm">{t('auth.resetPassword.expired')}</p>
          <Link to="/forgot-password" className="text-sm underline underline-offset-4">
            {t('auth.resetPassword.requestNew')}
          </Link>
        </div>
      </AuthLayout>
    )
  }

  if (callback?.kind === 'session') {
    const target = { pathname: '/accept-invite', hash: location.hash }
    if (isDesktop()) return <Navigate to={target} replace />
    return (
      <AuthLayout
        title={t('auth.callback.title')}
        description={t('auth.callback.description')}
      >
        <div className="space-y-4">
          <Button asChild className="w-full">
            <a href={`gymops://auth/callback${location.hash}`}>
              {t('auth.callback.openApp')}
            </a>
          </Button>
          <Link
            to={target}
            className="block text-center text-sm underline underline-offset-4"
          >
            {t('auth.callback.continueInBrowser')}
          </Link>
        </div>
      </AuthLayout>
    )
  }

  if (callback?.kind === 'error') {
    return (
      <AuthLayout title={t('auth.acceptInvite.title')}>
        <div className="space-y-4">
          <p className="text-sm">{t('auth.acceptInvite.expired')}</p>
          <Link to="/login" className="text-sm underline underline-offset-4">
            {t('auth.forgotPassword.backToSignIn')}
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return <Navigate to="/login" replace />
}
