import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

/**
 * A list or a screen that did not load: what happened, in one active line,
 * and a 44 px way to try again on the same screen (P7M-07). On gym wifi this
 * is the failure that matters, and a paragraph that says "try again" with
 * nothing to press is a dead end. The page keeps its shape around it.
 */
export function LoadError({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  const { t } = useTranslation()
  return (
    <div role="alert" className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <p className="text-destructive text-sm">{message}</p>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        {t('app.tryAgain')}
      </Button>
    </div>
  )
}
