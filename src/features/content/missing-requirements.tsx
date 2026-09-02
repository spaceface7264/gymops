/**
 * What still stands between a form and a saved record, listed above the
 * buttons. A control disabled without a reason is a dead end — the checklist
 * editor shipped that way and cost someone a puzzled minute (P4-03 fix).
 *
 * Callers pass translated sentences, not keys, so each feature keeps its own
 * wording in its own namespace.
 */
export function MissingRequirements({ reasons }: { reasons: string[] }) {
  if (reasons.length === 0) return null

  return (
    <ul className="text-muted-foreground space-y-0.5 text-sm">
      {reasons.map((reason) => (
        <li key={reason}>{reason}</li>
      ))}
    </ul>
  )
}
