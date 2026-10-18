// The mailbox data layer (UI 003 T034, research R5, R16, data-model §3): query keys and freshness,
// the detail seeded from a cached list page and refetched (FR-017), the address key in lower case,
// the capabilities and password policy reads, the templates of the create form (Default first),
// and the cache rules of a change.
import { QueryClient } from '@tanstack/vue-query'
import { beforeEach, describe, expect, it } from 'vitest'

import { queryKeys } from '@/api'
import {
  capabilitiesOptions,
  fetchMailbox,
  mailboxListOptions,
  mailboxOptions,
  passwordPolicyOptions,
  updateMailbox,
} from '@/features/mailboxes/api'
import { allTemplatesOptions, templateOptions } from '@/features/mailboxes/templates-api'
import type { Mailbox } from '@/features/mailboxes/types'

import { mockMailboxTemplate } from '../../../mocks/factories/mailbox-template'
import { useScenario } from '../../../mocks/node'

let client: QueryClient

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})

describe('queries', () => {
  it('keeps list pages 30 s and keys the detail by the lower-cased address', () => {
    expect(mailboxListOptions({ limit: 25, offset: 0 }).staleTime).toBe(30_000)
    expect(mailboxOptions(client, 'Anna@A.Example').queryKey).toEqual(
      queryKeys.mailboxes.detail('anna@a.example'),
    )
    expect(capabilitiesOptions().staleTime).toBe(300_000)
    const policy = passwordPolicyOptions()
    expect(policy.staleTime).toBe(0)
    expect(policy.refetchOnMount).toBe('always')
  })

  it('seeds the detail from a cached list page and marks it stale, so it refetches (FR-017)', async () => {
    useScenario('admin-mailboxes-small')
    const page = await client.fetchQuery(mailboxListOptions({ limit: 25, offset: 0 }))
    const options = mailboxOptions(client, 'ANNA@a.example')
    const initial = (options.initialData as () => Mailbox | undefined)()
    expect(initial?.address).toBe('anna@a.example')
    expect(initial).toEqual(page.data.find((item) => item.address === 'anna@a.example'))
    expect((options.initialDataUpdatedAt as () => number | undefined)()).toBe(0)
  })

  it('reads every template in one request, the Default template first', async () => {
    const state = useScenario('admin-mailboxes-small')
    state.mailboxTemplates.push(mockMailboxTemplate({ id: 3, name: 'Aardvark' }))
    const page = await client.fetchQuery(allTemplatesOptions(1000))
    expect(page.data.map((item) => item.name)).toEqual(['Default', 'Aardvark', 'Small'])
    const one = await client.fetchQuery(templateOptions(client, 2))
    expect(one.name).toBe('Small')
  })
})

describe('updateMailbox', () => {
  it('writes the detail and every cached list entry, and refreshes the lists', async () => {
    useScenario('admin-mailboxes-small')
    const listKey = mailboxListOptions({ limit: 25, offset: 0 }).queryKey
    await client.fetchQuery(mailboxListOptions({ limit: 25, offset: 0 }))
    const anna = await fetchMailbox('anna@a.example')
    const saved = await updateMailbox(client, anna.address, { displayName: 'Anna S' }, anna.etag)
    expect(saved.displayName).toBe('Anna S')
    expect(
      client.getQueryData<Mailbox>(queryKeys.mailboxes.detail('anna@a.example'))?.displayName,
    ).toBe('Anna S')
    const cached = client.getQueryData<{ data: Mailbox[] }>(listKey)
    expect(cached?.data.find((item) => item.address === 'anna@a.example')?.displayName).toBe(
      'Anna S',
    )
    expect(client.getQueryState(listKey)?.isInvalidated).toBe(true)
  })
})
