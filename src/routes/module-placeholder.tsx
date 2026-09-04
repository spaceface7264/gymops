import { Construction } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components'
import type { NavEntry } from '@/routes/nav'

/**
 * Stands in for a V1 module until its phase lands, so the shell is navigable
 * and each phase replaces one placeholder with the real page.
 */
export function ModulePlaceholder({ entry }: { entry: NavEntry }) {
  const { t } = useTranslation()

  const body = entry.phase
    ? `${t('module.notYet')} ${t('module.comingIn', { phase: entry.phase })}`
    : t('module.notYet')

  return <EmptyState icon={Construction} title={t(entry.labelKey)} body={body} />
}
