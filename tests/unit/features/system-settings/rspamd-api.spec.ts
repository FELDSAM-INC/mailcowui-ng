import { describe, expect, it } from 'vitest'

import { setRspamdUiPassword } from '@/features/system-settings/api/rspamd'
import { mockState, useScenario } from '../../../mocks/node'

describe('Rspamd UI direct API request and contract mock', () => {
  it('confirms the action without storing the submitted value', async () => {
    useScenario('settings-admin-defaults')
    await expect(setRspamdUiPassword({ password: 'Exactly " six " spaces' })).resolves.toBe(true)
    const record = mockState().requests.find(
      (request) => request.operationId === 'setRspamdUiPassword',
    )!
    expect(record.status).toBe(204)
    expect(record.body).toEqual({ password: '[redacted]' })
    expect(JSON.stringify(mockState().settings)).not.toContain('Exactly " six " spaces')
  })

  it.each(['settings-domain-admin', 'settings-mailbox-user'])(
    'refuses non-admin credentials (%s)',
    async (scenario) => {
      useScenario(scenario)
      await expect(setRspamdUiPassword({ password: 'Valid-password' })).rejects.toMatchObject({
        status: 403,
        type: '/api/v2/problems/forbidden',
      })
    },
  )

  it('refuses control characters with a password field violation', async () => {
    useScenario('settings-admin-defaults')
    await expect(setRspamdUiPassword({ password: 'abc\tdef' })).rejects.toMatchObject({
      status: 422,
      fieldErrors: new Map([
        [
          'password',
          [
            {
              code: 'invalidFormat',
              message: 'Control characters are not allowed.',
              params: { format: 'singleLine' },
            },
          ],
        ],
      ]),
    })
  })
})
