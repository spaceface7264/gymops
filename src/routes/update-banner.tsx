import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { checkForUpdate, isDesktop, relaunchApp } from '@/lib/platform'

/**
 * P7-04: one line above the header when a newer desktop build is out. The
 * check runs once per launch and never blocks anything; installing is a click,
 * because a front-desk machine mid-shift should not restart on its own.
 */
export function UpdateBanner() {
  const { t } = useTranslation()
  const update = useQuery({
    queryKey: ['app', 'update'],
    queryFn: checkForUpdate,
    enabled: isDesktop(),
    staleTime: Infinity,
    retry: false,
  })
  const install = useMutation({
    mutationFn: async () => {
      await update.data?.install()
      await relaunchApp()
    },
  })

  if (!update.data) return null

  return (
    <div
      role="status"
      className="bg-primary text-primary-foreground flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
    >
      <span>
        {install.isError
          ? t('app.update.failed')
          : t('app.update.available', { version: update.data.version })}
      </span>
      {!install.isError && (
        <Button
          size="sm"
          variant="secondary"
          disabled={install.isPending}
          onClick={() => install.mutate()}
        >
          {install.isPending ? t('app.update.installing') : t('app.update.install')}
        </Button>
      )}
    </div>
  )
}
