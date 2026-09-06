import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useRefetchOnResume } from './use-refetch-on-resume'

function setVisibility(value: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('useRefetchOnResume', () => {
  it('refetches the stale active queries when the app comes back', () => {
    const queryClient = new QueryClient()
    const refetch = vi.spyOn(queryClient, 'refetchQueries').mockResolvedValue()
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    renderHook(() => useRefetchOnResume(), { wrapper })

    act(() => setVisibility('hidden'))
    expect(refetch).not.toHaveBeenCalled()
    act(() => setVisibility('visible'))
    expect(refetch).toHaveBeenCalledWith({ type: 'active', stale: true })
  })
})
