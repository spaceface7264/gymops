import { ScrollText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { EmptyState, LoadingState, LoadError } from '@/components'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAdminUsers, useAuditLog, type AuditEntry } from './queries'

/** The jsonb values are booleans or short strings; anything else is a bug. */
function label(value: unknown) {
  return value === null || value === undefined ? '—' : JSON.stringify(value)
}

/** `role` for a membership entry, the privilege flags for a profile entry. */
function summarise(entry: AuditEntry) {
  const before = entry.before as Record<string, unknown> | null
  const after = entry.after as Record<string, unknown> | null
  const keys =
    entry.entity_type === 'gym_membership'
      ? ['role']
      : ['is_superadmin', 'is_admin', 'active']

  return keys
    .filter((key) => before?.[key] !== after?.[key])
    .map((key) => `${key}: ${label(before?.[key])} → ${label(after?.[key])}`)
    .join(', ')
}

/**
 * The audit log (P2-05). Superadmin-only in `audit_log_select` and in the
 * route; actor names come from the user list, which a superadmin can read in
 * full, because `actor_id` points at `auth.users` and cannot be embedded.
 */
export function AuditPanel() {
  const { t, i18n } = useTranslation()
  const entries = useAuditLog()
  const users = useAdminUsers(null)

  const nameFor = (actorId: string | null) => {
    const actor = users.data?.find((user) => user.id === actorId)
    return actor?.full_name ?? actor?.email ?? t('admin.audit.system')
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">{t('admin.audit.title')}</h2>

      {entries.isPending && <LoadingState rows={6} />}
      {entries.isError && (
        <LoadError
          message={t('admin.loadFailed')}
          onRetry={() => void entries.refetch()}
        />
      )}

      {entries.data?.length === 0 && (
        <EmptyState icon={ScrollText} title={t('admin.audit.empty')} />
      )}

      {entries.data && entries.data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('admin.audit.when')}</TableHead>
              <TableHead>{t('admin.audit.who')}</TableHead>
              <TableHead>{t('admin.audit.what')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.data.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                  {new Date(entry.created_at).toLocaleString(i18n.language)}
                </TableCell>
                <TableCell>{nameFor(entry.actor_id)}</TableCell>
                <TableCell>
                  <span className="font-medium">{entry.action}</span>
                  <span className="text-muted-foreground block text-xs">
                    {summarise(entry)}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  )
}
