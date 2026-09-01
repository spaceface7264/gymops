import { useTranslation } from 'react-i18next'

export function NotFoundPage() {
  const { t } = useTranslation()

  return (
    <div className="space-y-1">
      <h1 className="text-lg font-medium">{t('notFound.title')}</h1>
      <p className="text-muted-foreground text-sm">{t('notFound.body')}</p>
    </div>
  )
}
