import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * Placeholder home page. Replaced by the real home in P3-07 / P4-10.
 */
export function HomePage() {
  const { t } = useTranslation()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('app.name')}</CardTitle>
      </CardHeader>
      <CardContent className="text-muted-foreground text-sm">
        {t('home.placeholder')}
      </CardContent>
    </Card>
  )
}
