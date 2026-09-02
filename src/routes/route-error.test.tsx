import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { i18next } from '@/lib/i18n'
import { RouteError } from '@/routes/route-error'

function Exploding(): never {
  throw new Error('the body could not be rendered')
}

describe('RouteError', () => {
  it('catches a throw from any screen instead of leaving a blank document', () => {
    // React Router logs the caught error; the test asserts what the user sees.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const router = createMemoryRouter(
      [
        {
          element: <Outlet />,
          errorElement: <RouteError />,
          children: [{ path: '/', element: <Exploding /> }],
        },
      ],
      { initialEntries: ['/'] },
    )

    render(
      <I18nextProvider i18n={i18next}>
        <RouterProvider router={router} />
      </I18nextProvider>,
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
    // The message is for whoever is debugging, and only outside production.
    expect(screen.getByText(/the body could not be rendered/)).toBeInTheDocument()

    consoleError.mockRestore()
  })
})
