import { Search } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { minSearchLength, useContentSearch, useDebounced } from './search'

/**
 * The search box over news and guides. It sits on both modules it covers, so
 * "where was that written down" is answerable from either.
 */
export function ContentSearch() {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const results = useContentSearch(useDebounced(query))
  const searching = query.trim().length >= minSearchLength

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-2.5 left-2 size-4" />
        <Input
          type="search"
          className="pl-8"
          placeholder={t('content.searchPlaceholder')}
          aria-label={t('content.search')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {searching && (
        <div className="space-y-2">
          {results.isPending && (
            <p className="text-muted-foreground text-sm">{t('content.searching')}</p>
          )}
          {results.isError && (
            <p role="alert" className="text-destructive text-sm">
              {t('content.searchFailed')}
            </p>
          )}
          {results.data?.length === 0 && (
            <p className="text-muted-foreground text-sm">{t('content.noResults')}</p>
          )}

          <ul aria-label={t('content.results')} className="space-y-2">
            {results.data?.map((hit) => (
              <li key={`${hit.kind}-${hit.id}`}>
                <Card className="space-y-1 p-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary">
                      {hit.kind === 'news'
                        ? t('content.kindNews')
                        : t('content.kindGuide')}
                    </Badge>
                    <Badge variant="outline">
                      {hit.scopeName ?? t('content.companyWide')}
                    </Badge>
                    {hit.isDraft && (
                      <Badge variant="secondary">{t('content.draft')}</Badge>
                    )}
                  </div>
                  <p className="font-medium">
                    <Link
                      to={hit.kind === 'news' ? `/news/${hit.id}` : `/guides/${hit.id}`}
                      className="hover:underline"
                    >
                      {hit.title}
                    </Link>
                  </p>
                  <p className="text-muted-foreground text-sm">{hit.snippet}</p>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
