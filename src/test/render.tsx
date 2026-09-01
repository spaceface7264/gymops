import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderOptions } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { MemoryRouter, Route, Routes } from 'react-router'
import { i18next } from '@/lib/i18n'

type ProviderOptions = RenderOptions & {
  /** Extra routes rendered next to the component, e.g. a redirect target. */
  routes?: { path: string; element: ReactElement }[]
}

/**
 * Renders a component with the providers the app supplies at runtime.
 * Retries are off so failing queries surface immediately in tests.
 */
export function renderWithProviders(ui: ReactElement, options?: ProviderOptions) {
  const { routes = [], ...renderOptions } = options ?? {}
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <I18nextProvider i18n={i18next}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <Routes>
              <Route path="/" element={children} />
              {routes.map((route) => (
                <Route key={route.path} path={route.path} element={route.element} />
              ))}
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </I18nextProvider>
    )
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions })
}
