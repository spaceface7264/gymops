import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './confirm-dialog'
import { renderWithProviders } from '@/test/render'

describe('ConfirmDialog', () => {
  it('runs the action on confirm and only then', async () => {
    const onConfirm = vi.fn()
    const onOpenChange = vi.fn()
    renderWithProviders(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Delete this post?"
        body="It disappears from the feed."
        confirmLabel="Delete"
        onConfirm={onConfirm}
      />,
    )
    expect(
      screen.getByRole('alertdialog', { name: 'Delete this post?' }),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onConfirm).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('shows the error where the decision was made and holds the buttons while pending', () => {
    renderWithProviders(
      <ConfirmDialog
        open
        onOpenChange={() => {}}
        title="Delete this post?"
        confirmLabel="Delete"
        pending
        error="The post could not be deleted."
        onConfirm={() => {}}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('The post could not be deleted.')
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })
})
