import { describe, expect, it, vi } from 'vitest'
import { api, ApiProblem, queryKeys } from '@/api'
import { useProfileDownload } from '@/features/account/composables/useProfileDownload'
import * as downloads from '@/shared/platform/download'
import { withSetup } from '../../support/composable'
import { testPlugins } from '../../support/mount'
import { useScenario } from '../../../mocks/node'

describe('Apple profile downloads', () => {
  it('fetches a blob without caching, saves the supplied name and invalidates password metadata', async () => {
    useScenario('account-mailbox')
    const blob = new Blob(['<plist>secret</plist>'])
    const post = vi.spyOn(api, 'POST').mockResolvedValue({
      data: blob,
      response: new Response('', {
        status: 201,
        headers: { 'Content-Disposition': 'attachment; filename="My profile.mobileconfig"' },
      }),
    })
    const save = vi.spyOn(downloads, 'saveBlob').mockImplementation(() => {})
    const client = testPlugins().queryClient
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    const { result, unmount } = withSetup(() => useProfileDownload(() => 'anna@example.org'))
    await result.download('email', true)
    expect(post).toHaveBeenCalledWith('/me/mailbox/apple-profile', {
      body: { variant: 'email' },
      parseAs: 'blob',
    })
    expect(save).toHaveBeenCalledWith(blob, 'My profile.mobileconfig')
    expect(result.createdAppPassword.value).toBe(true)
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.selfService.appPasswords('anna@example.org'),
    })
    expect(client.getMutationCache().getAll()).toEqual([])
    expect(JSON.stringify(client.getQueryCache().getAll())).not.toContain('<plist>')
    unmount()
  })
  it('discards a late response after navigation without saving a file', async () => {
    let release!: (value: never) => void
    vi.spyOn(api, 'GET').mockReturnValue(
      new Promise((resolve) => {
        release = resolve
      }),
    )
    const save = vi.spyOn(downloads, 'saveBlob').mockImplementation(() => {})
    const { result, unmount } = withSetup(() => useProfileDownload(() => 'anna@example.org'))
    const running = result.download('email', false)
    unmount()
    release({ data: new Blob(['secret']), response: new Response() } as never)
    await running
    expect(save).not.toHaveBeenCalled()
  })
  it('exposes a permission refusal without saving and remembers withdrawal', async () => {
    vi.spyOn(api, 'POST').mockRejectedValue(
      ApiProblem.fromParts({
        kind: 'problem',
        status: 403,
        type: '/api/v2/problems/permission-flag-required',
      }),
    )
    const save = vi.spyOn(downloads, 'saveBlob').mockImplementation(() => {})
    const { result, unmount } = withSetup(() => useProfileDownload(() => 'anna@example.org'))
    await result.download('email', true)
    expect(result.problem.value?.status).toBe(403)
    expect(result.flagWithdrawn.value).toBe(true)
    expect(save).not.toHaveBeenCalled()
    unmount()
  })
})
