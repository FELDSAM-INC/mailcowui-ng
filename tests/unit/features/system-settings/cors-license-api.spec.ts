import { expect, it } from 'vitest'
import { fetchCors, updateCors } from '@/features/system-settings/api/cors'
import { fetchLicense, verifyLicense } from '@/features/system-settings/api/license'
import { mockState, useScenario } from '../../../mocks/node'
it('saves normalized CORS lists with a version and refuses a stale write', async () => {
  useScenario('settings-admin-defaults')
  const original = await fetchCors()
  const saved = await updateCors(
    {
      allowedOrigins: ['HTTPS://PORTAL.EXAMPLE.ORG', 'https://portal.example.org', '*'],
      allowedMethods: ['GET', 'POST'],
    },
    original.etag,
  )
  expect(saved.allowedOrigins).toEqual(['https://portal.example.org', '*'])
  expect(saved.etag).not.toBe(original.etag)
  await expect(updateCors({ allowedOrigins: [] }, original.etag)).rejects.toMatchObject({
    status: 412,
  })
  expect(mockState().violations.list()).toEqual([])
})
it('validates stored legacy origins even when only methods change', async () => {
  useScenario('cors-legacy-bare-host')
  const original = await fetchCors()
  await expect(updateCors({ allowedMethods: ['POST'] }, original.etag)).rejects.toMatchObject({
    status: 422,
  })
  expect(mockState().settings.cors.etag).toBe(original.etag)
})
it.each(['settings-domain-admin', 'settings-mailbox-user'])(
  'refuses CORS and license for %s',
  async (name) => {
    useScenario(name)
    await expect(fetchCors()).rejects.toMatchObject({ status: 403 })
    await expect(fetchLicense()).rejects.toMatchObject({ status: 403 })
  },
)
it('reads license without verification and returns unreachable as data', async () => {
  useScenario('settings-license-unreachable')
  expect((await fetchLicense()).lastVerification.result).toBe('valid')
  expect(mockState().requests.some((r) => r.operationId === 'verifyLicense')).toBe(false)
  expect((await verifyLicense()).lastVerification.result).toBe('unreachable')
})
it('refuses disabled license reads and verification', async () => {
  useScenario('settings-license-disabled')
  await expect(fetchLicense()).rejects.toMatchObject({
    status: 403,
    type: '/api/v2/problems/feature-disabled',
  })
  await expect(verifyLicense()).rejects.toMatchObject({
    status: 403,
    type: '/api/v2/problems/feature-disabled',
  })
})
