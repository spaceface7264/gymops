import { Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState, LoadingState } from '@/components'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  summariseUsage,
  useAssistantSettings,
  useAssistantUsage,
  useSetDailyCap,
  type UsageLine,
} from './queries'

/**
 * The assistant's two dials for head office (P8-06): the daily cap, and who
 * has been using it. Superadmin-only in `app_settings_update`, in
 * `assistant_usage_select`, and in the route.
 */
export function AssistantUsagePanel() {
  const { t, i18n } = useTranslation()
  const settings = useAssistantSettings()
  const usage = useAssistantUsage()

  const lines = usage.data ? summariseUsage(usage.data) : []
  const total = lines.reduce<Omit<UsageLine, 'userId' | 'name'>>(
    (sum, line) => ({
      calls: sum.calls + line.calls,
      inputTokens: sum.inputTokens + line.inputTokens,
      outputTokens: sum.outputTokens + line.outputTokens,
      cacheReadTokens: sum.cacheReadTokens + line.cacheReadTokens,
    }),
    { calls: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 },
  )
  const count = (value: number) => value.toLocaleString(i18n.language)

  return (
    <section className="space-y-6">
      <h2 className="text-lg font-semibold">{t('admin.usage.title')}</h2>

      <Card>
        <CardHeader>
          <CardTitle as="h3">{t('admin.usage.capTitle')}</CardTitle>
          <CardDescription>{t('admin.usage.capHint')}</CardDescription>
        </CardHeader>
        <CardContent>
          {settings.isPending && <LoadingState rows={1} />}
          {settings.isError && (
            <p role="alert" className="text-destructive text-sm">
              {t('admin.loadFailed')}
            </p>
          )}
          {settings.data && <CapForm dailyCap={settings.data.dailyCap} />}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="font-semibold">{t('admin.usage.last30Days')}</h3>

        {usage.isPending && <LoadingState rows={4} />}
        {usage.isError && (
          <p role="alert" className="text-destructive text-sm">
            {t('admin.loadFailed')}
          </p>
        )}
        {usage.data && lines.length === 0 && (
          <EmptyState icon={Sparkles} title={t('admin.usage.empty')} />
        )}

        {lines.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin.usage.user')}</TableHead>
                <TableHead className="text-right">{t('admin.usage.calls')}</TableHead>
                <TableHead className="text-right">
                  {t('admin.usage.inputTokens')}
                </TableHead>
                <TableHead className="text-right">
                  {t('admin.usage.outputTokens')}
                </TableHead>
                <TableHead className="text-right">{t('admin.usage.cacheRead')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line) => (
                <TableRow key={line.userId}>
                  <TableCell className="font-medium">{line.name}</TableCell>
                  <TableCell className="text-right">{count(line.calls)}</TableCell>
                  <TableCell className="text-right">{count(line.inputTokens)}</TableCell>
                  <TableCell className="text-right">{count(line.outputTokens)}</TableCell>
                  <TableCell className="text-right">
                    {count(line.cacheReadTokens)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="font-medium">
                <TableCell>{t('admin.usage.total')}</TableCell>
                <TableCell className="text-right">{count(total.calls)}</TableCell>
                <TableCell className="text-right">{count(total.inputTokens)}</TableCell>
                <TableCell className="text-right">{count(total.outputTokens)}</TableCell>
                <TableCell className="text-right">
                  {count(total.cacheReadTokens)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </div>
    </section>
  )
}

function CapForm({ dailyCap }: { dailyCap: number }) {
  const { t } = useTranslation()
  const save = useSetDailyCap()
  const [value, setValue] = useState(String(dailyCap))

  const cap = Number(value)
  const valid = Number.isInteger(cap) && cap >= 1 && cap <= 1000

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        if (valid) save.mutate(cap)
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="assistant-daily-cap">{t('admin.usage.cap')}</Label>
        <Input
          id="assistant-daily-cap"
          type="number"
          inputMode="numeric"
          min={1}
          max={1000}
          className="w-32"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </div>
      <Button type="submit" disabled={!valid || cap === dailyCap || save.isPending}>
        {save.isPending ? t('admin.saving') : t('admin.save')}
      </Button>
      {save.isSuccess && (
        <p role="status" className="text-muted-foreground text-sm">
          {t('admin.usage.saved')}
        </p>
      )}
      {save.isError && (
        <p role="alert" className="text-destructive text-sm">
          {t('admin.usage.saveFailed')}
        </p>
      )}
    </form>
  )
}
