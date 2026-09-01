import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * Placeholder home page. Replaced by the real home in P3-07 / P4-10; strings
 * move to `src/locales` in P1-03.
 */
export function HomePage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>GymOps</CardTitle>
      </CardHeader>
      <CardContent className="text-muted-foreground text-sm">
        Scaffold ready. Auth and the app shell land in phase 1.
      </CardContent>
    </Card>
  )
}
