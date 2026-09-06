import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePullToRefresh } from './use-pull-to-refresh'

function touch(type: 'touchstart' | 'touchmove' | 'touchend', y: number, fingers = 1) {
  const list = Array.from({ length: fingers }, () => ({ clientY: y }))
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'touches', { value: type === 'touchend' ? [] : list })
  Object.defineProperty(event, 'changedTouches', { value: list })
  document.dispatchEvent(event)
}

function setScrollTop(value: number) {
  Object.defineProperty(document.documentElement, 'scrollTop', {
    configurable: true,
    value,
  })
}

describe('usePullToRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setScrollTop(0)
  })
  afterEach(() => vi.useRealTimers())

  it('refreshes after a long pull from the top', async () => {
    const onRefresh = vi.fn(() => Promise.resolve())
    const { result } = renderHook(() => usePullToRefresh({ enabled: true, onRefresh }))

    act(() => touch('touchstart', 100))
    act(() => touch('touchmove', 250))
    expect(result.current.state).toBe('armed')
    expect(result.current.pull).toBe(75)

    act(() => touch('touchend', 250))
    expect(result.current.state).toBe('refreshing')
    expect(onRefresh).toHaveBeenCalledTimes(1)

    await act(() => vi.advanceTimersByTimeAsync(400))
    expect(result.current.state).toBe('idle')
    expect(result.current.pull).toBe(0)
  })

  it('does nothing on a short pull', () => {
    const onRefresh = vi.fn(() => Promise.resolve())
    const { result } = renderHook(() => usePullToRefresh({ enabled: true, onRefresh }))

    act(() => touch('touchstart', 100))
    act(() => touch('touchmove', 140))
    expect(result.current.state).toBe('pulling')
    act(() => touch('touchend', 140))
    expect(result.current.state).toBe('idle')
    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('ignores a pull when the page is scrolled', () => {
    setScrollTop(120)
    const onRefresh = vi.fn(() => Promise.resolve())
    const { result } = renderHook(() => usePullToRefresh({ enabled: true, onRefresh }))

    act(() => touch('touchstart', 100))
    act(() => touch('touchmove', 300))
    act(() => touch('touchend', 300))
    expect(result.current.state).toBe('idle')
    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('cancels when the finger moves back up', () => {
    const onRefresh = vi.fn(() => Promise.resolve())
    const { result } = renderHook(() => usePullToRefresh({ enabled: true, onRefresh }))

    act(() => touch('touchstart', 100))
    act(() => touch('touchmove', 250))
    act(() => touch('touchmove', 90))
    expect(result.current.state).toBe('idle')
    act(() => touch('touchend', 90))
    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('ignores two fingers', () => {
    const onRefresh = vi.fn(() => Promise.resolve())
    const { result } = renderHook(() => usePullToRefresh({ enabled: true, onRefresh }))

    act(() => touch('touchstart', 100, 2))
    act(() => touch('touchmove', 300, 2))
    act(() => touch('touchend', 300, 2))
    expect(result.current.state).toBe('idle')
    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('listens to nothing while disabled', () => {
    const onRefresh = vi.fn(() => Promise.resolve())
    const { result } = renderHook(() => usePullToRefresh({ enabled: false, onRefresh }))

    act(() => touch('touchstart', 100))
    act(() => touch('touchmove', 300))
    act(() => touch('touchend', 300))
    expect(result.current.state).toBe('idle')
    expect(onRefresh).not.toHaveBeenCalled()
  })
})
