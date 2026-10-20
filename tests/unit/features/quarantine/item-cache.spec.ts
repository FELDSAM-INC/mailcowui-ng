import { QueryObserver } from '@tanstack/vue-query'
import { afterEach, expect, it, vi } from 'vitest'
import { queryKeys } from '@/api'
import { quarantineItemOptions } from '@/features/quarantine/api'
import { useScenario } from '../../../mocks/node'
import { testPlugins } from '../../support/mount'

afterEach(() => vi.useRealTimers())
it('releases message content from the cache one minute after the last observer leaves', async () => {
  useScenario('quarantine-mailbox-user')
  const client = testPlugins().queryClient
  const observer = new QueryObserver(client, quarantineItemOptions(11))
  const leave = observer.subscribe(() => {})
  await vi.waitFor(() => expect(observer.getCurrentResult().isSuccess).toBe(true))
  expect(client.getQueryData(queryKeys.quarantine.detail(11))).toBeDefined()
  vi.useFakeTimers()
  leave()
  await vi.advanceTimersByTimeAsync(59_999)
  expect(client.getQueryData(queryKeys.quarantine.detail(11))).toBeDefined()
  await vi.advanceTimersByTimeAsync(1)
  expect(client.getQueryData(queryKeys.quarantine.detail(11))).toBeUndefined()
  client.clear()
})
