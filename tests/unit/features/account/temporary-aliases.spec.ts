import { describe, expect, it, vi } from 'vitest'
import { queryKeys } from '@/api'
import {
  createTemporaryAlias,
  deleteTemporaryAlias,
  listTemporaryAliases,
  listTemporaryAliasDomains,
  updateTemporaryAlias,
} from '@/features/account/api/temporary-aliases'
import { mockState, useScenario } from '../../../mocks/node'
import { testPlugins } from '../../support/mount'

const mailbox = 'anna@example.org'
describe('temporary aliases', () => {
  it('reads all allowed domains, generates, changes validity with If-Match, and deletes', async () => {
    useScenario('temporary-aliases-empty')
    expect((await listTemporaryAliasDomains(mailbox)).map((item) => item.domain)).toEqual([
      'example.org',
      'example.com',
    ])
    expect(mockState().requests.at(-1)?.path).toContain('limit=1000')
    const client = testPlugins().queryClient
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    const started = mockState().now()
    const item = await createTemporaryAlias(client, mailbox, {
      domain: 'example.com',
      description: 'Shop',
      lifetimeHours: 24,
    })
    expect(item).toMatchObject({ mailbox, description: 'Shop', permanent: false })
    expect(item.address).toMatch(/^[a-z]{6,8}\.[a-z]{6,8}@example.com$/)
    expect(Date.parse(item.expiresAt!)).toBeGreaterThanOrEqual(started + 24 * 3600000)
    expect(Date.parse(item.expiresAt!)).toBeLessThanOrEqual(mockState().now() + 24 * 3600000)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.me.mailbox() })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.mailboxes.detail(mailbox) })
    const permanent = await updateTemporaryAlias(
      client,
      mailbox,
      item.address,
      { permanent: true },
      item.etag,
    )
    expect(permanent).toMatchObject({ permanent: true, expiresAt: null })
    await expect(
      deleteTemporaryAlias(client, mailbox, item.address, item.etag),
    ).rejects.toMatchObject({ status: 412 })
    await deleteTemporaryAlias(client, mailbox, item.address, permanent.etag)
    expect((await listTemporaryAliases(mailbox, {})).data).toEqual([])
  })
  it('filters, sorts, pages, excludes expired entries and returns 404 after expiry', async () => {
    useScenario('temporary-aliases-many')
    expect((await listTemporaryAliases(mailbox, { limit: 25 })).meta.total).toBe(30)
    expect(
      (await listTemporaryAliases(mailbox, { permanent: true })).data.every((a) => a.permanent),
    ).toBe(true)
    const page = await listTemporaryAliases(mailbox, {
      q: 'alias',
      sort: 'address',
      order: 'asc',
      limit: 1,
      offset: 1,
    })
    expect(page.data[0]?.address).toBe('alias02@example.org')
    const item = page.data[0]!
    mockState().selfService.mailboxes[mailbox]!.temporaryAliases.find(
      (a) => a.address === item.address,
    )!.expiresAt = mockState().now() - 1
    await expect(
      updateTemporaryAlias(
        testPlugins().queryClient,
        mailbox,
        item.address,
        { permanent: true },
        item.etag,
      ),
    ).rejects.toMatchObject({ status: 404 })
    expect((await listTemporaryAliases(mailbox, { q: item.address })).data).toEqual([])
  })
  it('enforces allowed domains and address-generation availability', async () => {
    useScenario('temporary-aliases-empty')
    const client = testPlugins().queryClient
    await expect(
      createTemporaryAlias(client, mailbox, { domain: 'foreign.example' }),
    ).rejects.toMatchObject({
      status: 422,
      fieldErrors: new Map([
        [
          'domain',
          [
            expect.objectContaining({
              code: 'notInList',
              params: { allowed: ['example.org', 'example.com'] },
            }),
          ],
        ],
      ]),
    })
    mockState().selfService.outages.addressGeneration = true
    await expect(
      createTemporaryAlias(client, mailbox, { domain: 'example.org' }),
    ).rejects.toMatchObject({ status: 503 })
  })
  it('enforces the mailbox user flag and own mailbox scope', async () => {
    useScenario('account-mailbox-no-flags')
    const client = testPlugins().queryClient
    await expect(
      createTemporaryAlias(client, mailbox, { domain: 'example.org' }),
    ).rejects.toMatchObject({ status: 403 })
    await expect(listTemporaryAliases('alice@example.org', {})).rejects.toMatchObject({
      status: 404,
    })
  })
  it('permits domain administrators within their assigned mailbox scope', async () => {
    useScenario('account-domain-admin-no-flags')
    const client = testPlugins().queryClient
    await expect(
      createTemporaryAlias(client, mailbox, { domain: 'example.org', permanent: true }),
    ).resolves.toMatchObject({ permanent: true })
    await expect(listTemporaryAliases('user@outside.example', {})).rejects.toMatchObject({
      status: 404,
    })
  })
})
