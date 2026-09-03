import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UpdateBanner } from '@/routes/update-banner'
import { renderWithProviders } from '@/test/render'

const check =
  vi.fn<() => Promise<{ version: string; install: () => Promise<void> } | null>>()
const install = vi.fn<() => Promise<void>>()
const relaunch = vi.fn<() => Promise<void>>()

vi.mock('@/lib/platform', () => ({
  isDesktop: () => true,
  checkForUpdate: () => check(),
  relaunchApp: () => relaunch(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  install.mockResolvedValue()
  relaunch.mockResolvedValue()
})

describe('UpdateBanner', () => {
  it('shows nothing when the build is current', async () => {
    check.mockResolvedValue(null)
    renderWithProviders(<UpdateBanner />)
    await waitFor(() => expect(check).toHaveBeenCalled())
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('offers the new version and relaunches once it is installed', async () => {
    check.mockResolvedValue({ version: '0.2.0', install })
    const user = userEvent.setup()
    renderWithProviders(<UpdateBanner />)

    expect(await screen.findByText('GymOps 0.2.0 is ready.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Restart to update' }))

    await waitFor(() => expect(relaunch).toHaveBeenCalled())
    expect(install).toHaveBeenCalledTimes(1)
  })

  it('says so when installing fails, and does not relaunch', async () => {
    check.mockResolvedValue({ version: '0.2.0', install })
    install.mockRejectedValue(new Error('signature'))
    const user = userEvent.setup()
    renderWithProviders(<UpdateBanner />)

    await user.click(await screen.findByRole('button', { name: 'Restart to update' }))

    expect(await screen.findByText(/could not be installed/)).toBeInTheDocument()
    expect(relaunch).not.toHaveBeenCalled()
  })
})
