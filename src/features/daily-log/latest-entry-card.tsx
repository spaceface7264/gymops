import { NotebookPen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { EmptyState, LoadingState, StatusBadge } from '@/components'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useGymScope } from '@/features/gyms'
import { useLatestLogEntry } from './queries'

/**
 * The home page's daily log block (P4-10): the last thing written here, which
 * on a shift handover is the one entry somebody arriving needs to have read.
 */
export function LatestLogEntryCard() {
  const { t, i18n } = useTranslation()
  const { gymId } = useGymScope()
  const latest = useLatestLogEntry(gymId)

  const entry = latest.data

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('home.dailyLog.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {latest.isPending && <LoadingState rows={3} />}
        {latest.isError && (
          <p role="alert" className="text-destructive text-sm">
            {t('dailyLog.loadFailed')}
          </p>
        )}
        {latest.data === null && (
          <EmptyState
            bordered={false}
            icon={NotebookPen}
            title={t('home.dailyLog.empty')}
          />
        )}

        {entry && (
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={entry.kind === 'issue' ? 'warning' : 'neutral'}>
                {t(`dailyLog.kind.${entry.kind}`)}
              </StatusBadge>
              {gymId === null && entry.gyms && (
                <StatusBadge tone="neutral">{entry.gyms.name}</StatusBadge>
              )}
              <span className="text-muted-foreground text-xs">
                {t('dailyLog.writtenBy', {
                  who: entry.author?.full_name ?? t('dailyLog.someone'),
                  when: new Date(entry.created_at).toLocaleString(i18n.language, {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                })}
              </span>
            </div>
            <p className="line-clamp-3 text-sm whitespace-pre-line">{entry.body}</p>
          </div>
        )}

        <Button asChild variant="link" className="h-auto p-0">
          <Link to="/daily-log">{t('home.dailyLog.wholeLog')}</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
