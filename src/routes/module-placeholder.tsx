import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { NavEntry } from '@/routes/nav'

/**
 * Stands in for a V1 module until its phase lands, so the shell is navigable
 * and each phase replaces one placeholder with the real page.
 */
export function ModulePlaceholder({ entry }: { entry: NavEntry }) {
  const { t } = useTranslation()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t(entry.labelKey)}</CardTitle>
      </CardHeader>
      <CardContent className="text-muted-foreground space-y-1 text-sm">
        <p>{t('module.notYet')}</p>
        {entry.phase && <p>{t('module.comingIn', { phase: entry.phase })}</p>}
      </CardContent>
    </Card>
  )
}
