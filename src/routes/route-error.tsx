import { TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useRouteError } from 'react-router'
import { EmptyState } from '@/components'
import { Button } from '@/components/ui/button'

/**
 * The last line of defence: anything thrown while rendering a route lands here
 * instead of white-screening the app. These screens run unattended on a front
 * desk, so the way out has to be on the page.
 */
export function RouteError() {
  const { t } = useTranslation()
  const error = useRouteError()

  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4">
        <EmptyState
          icon={TriangleAlert}
          title={t('app.error.title')}
          body={t('app.error.body')}
          action={
            <div className="flex gap-2">
              <Button onClick={() => window.location.reload()}>
                {t('app.error.reload')}
              </Button>
              <Button variant="outline" onClick={() => (window.location.href = '/')}>
                {t('app.error.home')}
              </Button>
            </div>
          }
        />
        {import.meta.env.DEV && (
          <pre className="bg-muted max-h-40 overflow-auto rounded-md p-2 text-xs">
            {error instanceof Error ? error.message : String(error)}
          </pre>
        )}
      </div>
    </div>
  )
}
