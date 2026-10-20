import { expect, it, vi } from 'vitest'
import { handleOwnAccountSave } from '@/features/administrators/own-account'
import { mockAdmin, adminView } from '../../../mocks/factories/admin'
import { useScenario } from '../../../mocks/node'
const { switchIdentity, endSession } = vi.hoisted(() => ({
  switchIdentity: vi.fn().mockResolvedValue(undefined),
  endSession: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/app/session/identity-switch', () => ({ switchIdentity }))
vi.mock('@/app/session/session-end', () => ({ endSession }))
vi.mock('@/app/session/context', () => ({ sessionContext: () => ({}) }))
it('switches identity after renaming the current administrator', async () => {
  const before = adminView(mockAdmin()),
    after = { ...before, username: 'renamed' }
  expect(await handleOwnAccountSave(before, after, 'admin')).toBe(true)
  expect(switchIdentity).toHaveBeenCalledWith({ reason: 'selfRenamed' })
})
it('ends the local session with the specific notice once the server reports self-deactivation', async () => {
  useScenario('anonymous-default')
  const before = adminView(mockAdmin()),
    after = { ...before, active: false }
  expect(await handleOwnAccountSave(before, after, 'admin')).toBe(true)
  expect(endSession).toHaveBeenCalledWith({}, { notice: 'selfDeactivated', broadcast: true })
})
it('does not switch or sign out after changing another account', async () => {
  const before = adminView(mockAdmin({ username: 'other' })),
    after = { ...before, username: 'next' }
  expect(await handleOwnAccountSave(before, after, 'admin')).toBe(false)
})
