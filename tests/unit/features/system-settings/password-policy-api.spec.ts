import { describe, expect, it } from 'vitest'
import { api, requireData } from '@/api'
import {
  passwordPolicyOptions,
  updatePasswordPolicy,
} from '@/features/system-settings/api/passwords'
import { mockState, useScenario } from '../../../mocks/node'

describe('password policy write boundary', () => {
  it.each(['settings-domain-admin', 'settings-mailbox-user'])(
    'keeps the shared read available but refuses writes by %s',
    async (scenario) => {
      useScenario(scenario)
      const current = requireData(await api.GET('/password-policy')).data
      await expect(updatePasswordPolicy({ minLength: 10 }, current.etag)).rejects.toMatchObject({
        status: 403,
      })
      expect(mockState().passwordPolicy.minLength).toBe(6)
    },
  )

  it('validates a tightened capability range independently of the browser', async () => {
    useScenario('settings-admin-defaults')
    mockState().settings.capabilities.limits.passwordPolicyMaxLength = 10
    const current = requireData(await api.GET('/password-policy')).data
    await expect(updatePasswordPolicy({ minLength: 11 }, current.etag)).rejects.toMatchObject({
      status: 422,
    })
    expect(mockState().passwordPolicy.minLength).toBe(6)
    expect(passwordPolicyOptions().queryKey).toEqual(['password-policy'])
  })
})
