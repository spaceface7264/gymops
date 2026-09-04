import { SearchX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components'

export function NotFoundPage() {
  const { t } = useTranslation()

  return (
    <EmptyState icon={SearchX} title={t('notFound.title')} body={t('notFound.body')} />
  )
}
