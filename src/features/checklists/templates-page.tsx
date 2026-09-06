import { LayoutTemplate, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Link } from 'react-router'
import {
  EmptyState,
  LoadingState,
  PageHeader,
  StatusBadge,
  LoadError,
} from '@/components'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { usePublishScope } from '@/features/content'
import { useChecklistTemplates, useSetTemplateActive } from './queries'
import { summariseWeekdays } from './weekdays'

/** `/checklists/templates`: the checklists a gym runs, and who they run for. */
export function ChecklistTemplatesPage() {
  const { t, i18n } = useTranslation()
  const scope = usePublishScope()
  const templates = useChecklistTemplates()
  const setActive = useSetTemplateActive()

  const newTemplateAction = scope.canPublishSomewhere && (
    <Button asChild>
      <Link to="/checklists/templates/new">
        <Plus className="size-4" />
        {t('checklists.newTemplate')}
      </Link>
    </Button>
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('checklists.templates')}
        description={t('checklists.generatedAt')}
        action={newTemplateAction}
      />

      {templates.isPending && <LoadingState rows={5} />}
      {templates.isError && (
        <LoadError
          message={t('checklists.loadFailed')}
          onRetry={() => void templates.refetch()}
        />
      )}
      {templates.data?.length === 0 && (
        <EmptyState
          icon={LayoutTemplate}
          title={t('checklists.empty')}
          action={newTemplateAction}
        />
      )}

      <ul aria-label={t('checklists.templates')} className="space-y-3">
        {(templates.data ?? []).map((template) => {
          const days = summariseWeekdays(template.weekdays, i18n.language)
          const canEdit = scope.canPublishIn(template.gym_id)

          return (
            <li key={template.id}>
              <Card className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge tone="neutral">
                      {template.gyms?.name ?? t('checklists.companyWide')}
                    </StatusBadge>
                    <StatusBadge tone="neutral">
                      {t(`checklists.kind.${template.kind}`)}
                    </StatusBadge>
                    {!template.active && (
                      <StatusBadge tone="neutral">{t('checklists.inactive')}</StatusBadge>
                    )}
                  </div>
                  <h2 className="text-lg font-semibold">{template.name}</h2>
                  <p className="text-muted-foreground text-sm">
                    {days ?? t('checklists.everyDay')} ·{' '}
                    {t('checklists.itemCount', {
                      count: template.checklist_template_items.length,
                    })}
                  </p>
                </div>

                {canEdit && (
                  <div className="flex gap-2">
                    <Button asChild variant="outline">
                      <Link to={`/checklists/templates/${template.id}/edit`}>
                        {t('checklists.edit')}
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={setActive.isPending}
                      onClick={() =>
                        setActive.mutate(
                          { id: template.id, active: !template.active },
                          { onError: () => toast.error(t('checklists.saveFailed')) },
                        )
                      }
                    >
                      {template.active
                        ? t('checklists.deactivate')
                        : t('checklists.activate')}
                    </Button>
                  </div>
                )}
              </Card>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
