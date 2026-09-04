import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { PageHeader } from '@/components'
import { Button } from '@/components/ui/button'

/**
 * `/install` — how to put GymOps on a phone.
 *
 * It exists because iOS gives no install prompt and no web push at all until
 * the app has been added to the Home Screen (spec §3), which is not something
 * anybody guesses. Written as three short lists rather than one clever
 * auto-detecting screen: staff read it once, on whatever they happen to hold.
 */
export function InstallPage() {
  const { t } = useTranslation()

  const platforms = ['ios', 'android', 'desktop'] as const

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('install.title')}
        action={
          <Button size="sm" variant="outline" asChild>
            <Link to="/notifications/preferences">{t('install.backToPreferences')}</Link>
          </Button>
        }
      />

      <p className="text-muted-foreground">{t('install.intro')}</p>

      {platforms.map((platform) => (
        <section key={platform} className="space-y-2">
          <h2 className="text-lg font-semibold">{t(`install.${platform}.title`)}</h2>
          <ol className="text-muted-foreground list-decimal space-y-1 pl-5 text-sm">
            {t(`install.${platform}.steps`, { returnObjects: true }).map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
      ))}

      <p className="text-muted-foreground text-sm">{t('install.pushNote')}</p>
    </div>
  )
}
