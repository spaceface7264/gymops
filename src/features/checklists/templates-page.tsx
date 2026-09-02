import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
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

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">{t('checklists.templates')}</h1>
          <p className="text-muted-foreground text-sm">{t('checklists.generatedAt')}</p>
        </div>
        {scope.canPublishSomewhere && (
          <Button asChild>
            <Link to="/checklists/templates/new">
              <Plus className="size-4" />
              {t('checklists.newTemplate')}
            </Link>
          </Button>
        )}
      </header>

      {templates.isPending && (
        <p className="text-muted-foreground text-sm">{t('checklists.loading')}</p>
      )}
      {templates.isError && (
        <p role="alert" className="text-destructive text-sm">
          {t('checklists.loadFailed')}
        </p>
      )}
      {templates.data?.length === 0 && (
        <p className="text-muted-foreground text-sm">{t('checklists.empty')}</p>
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
                    <Badge variant="outline">
                      {template.gyms?.name ?? t('checklists.companyWide')}
                    </Badge>
                    <Badge variant="outline">
                      {t(`checklists.kind.${template.kind}`)}
                    </Badge>
                    {!template.active && (
                      <Badge variant="secondary">{t('checklists.inactive')}</Badge>
                    )}
                  </div>
                  <h2 className="text-lg font-medium">{template.name}</h2>
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
                        setActive.mutate({ id: template.id, active: !template.active })
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
