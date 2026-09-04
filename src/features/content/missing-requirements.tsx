import { Info } from 'lucide-react'

/**
 * What still stands between a form and a saved record, listed above the
 * buttons. A control disabled without a reason is a dead end — the checklist
 * editor shipped that way and cost someone a puzzled minute (P4-03 fix).
 *
 * Callers pass translated sentences, not keys, so each feature keeps its own
 * wording in its own namespace. It is information, not an error: the form is
 * not wrong yet, it is unfinished.
 */
export function MissingRequirements({ reasons }: { reasons: string[] }) {
  if (reasons.length === 0) return null

  return (
    <ul role="status" className="text-secondary-foreground space-y-1 text-sm">
      {reasons.map((reason) => (
        <li key={reason} className="flex items-start gap-2">
          <Info
            className="text-muted-foreground mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          {reason}
        </li>
      ))}
    </ul>
  )
}
