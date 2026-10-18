// T127: the address parameters of the API key list (data-model §5) and their mapping to the query.
import { describe, expect, it } from 'vitest'

import { apiKeyListSchema, toApiKeyListParams } from '@/features/api-keys/list-state'
import { useListState } from '@/shared/composables/useListState'

import { withSetup } from '../../support/composable'
import { createTestRouter } from '../../support/router'

async function stateAt(path: string) {
  const router = createTestRouter()
  await router.push(path)
  const { result } = withSetup(() => useListState(apiKeyListSchema), { router })
  return { router, list: result }
}

describe('toApiKeyListParams', () => {
  it('maps the defaults: newest first, 25 per page', async () => {
    const { list } = await stateAt('/api-keys')
    expect(toApiKeyListParams(list.state.value)).toEqual({
      limit: 25,
      offset: 0,
      sort: 'createdAt',
      order: 'desc',
    })
  })

  it('maps owner, status, access, sort, order, page and size', async () => {
    const { list } = await stateAt(
      '/api-keys?owner=reseller&status=active&access=readOnly&sort=name&order=desc&page=3&size=50',
    )
    expect(toApiKeyListParams(list.state.value)).toEqual({
      limit: 50,
      offset: 100,
      sort: 'name',
      order: 'desc',
      ownerUsername: 'reseller',
      status: 'active',
      accessLevel: 'readOnly',
    })
  })

  it('sorts other fields ascending by default and drops invalid values from the address', async () => {
    const { list, router } = await stateAt('/api-keys?sort=expiresAt&status=unknown&size=7')
    expect(list.state.value).toMatchObject({ sort: 'expiresAt', order: 'asc', size: 25 })
    expect(list.state.value.filters.status).toBeUndefined()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(router.currentRoute.value.query).toEqual({ sort: 'expiresAt' })
  })

  it('ignores an owner longer than 255 characters', async () => {
    const { list } = await stateAt(`/api-keys?owner=${'x'.repeat(256)}`)
    expect(list.state.value.filters.owner).toBeUndefined()
  })
})
