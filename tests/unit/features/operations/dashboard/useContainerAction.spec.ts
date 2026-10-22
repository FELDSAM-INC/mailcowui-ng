// UI 011 (FR-012–FR-016, data-model §7, T063): the container action runner: a confirmation for stop
// and restart only, the outcome written into the list, "Outcome unknown" with one read of the
// container and no repeat, refusals as translated messages, the missing audit record, and the
// outcome as a status message when the card is gone.
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { nextTick } from 'vue'

import { type Container } from '@/api'
import { containersOptions } from '@/features/operations/dashboard/api'
import { useContainerAction } from '@/features/operations/dashboard/composables/useContainerAction'
import { confirmState, settleConfirm } from '@/shared/composables/useConfirm'
import { clearStatusMessages, useStatusMessage } from '@/shared/composables/useStatusMessage'

import { mockState, useScenario } from '../../../../mocks/node'
import { withSetup } from '../../../support/composable'
import { testPlugins } from '../../../support/mount'
import { operationsKeys } from '@/features/operations/query-keys'
import { invalidateSessionScope } from '@/api/session-scope'
import { server } from '../../../../mocks/node'

afterEach(() => {
  settleConfirm(false)
  clearStatusMessages()
})

async function setup(name: string, scenario = 'ops-container-actions') {
  useScenario(scenario)
  const { queryClient } = testPlugins()
  const list = await queryClient.fetchQuery(containersOptions())
  const mounted = withSetup(() =>
    useContainerAction(
      () =>
        queryClient
          .getQueryData<Container[]>(operationsKeys.monitoring.containers())!
          .find((item) => item.name === name) ?? list.find((item) => item.name === name)!,
    ),
  )
  return { ...mounted, queryClient }
}

const calls = (operationId: string) =>
  mockState().requests.filter((request) => request.operationId === operationId)

async function settle() {
  for (let i = 0; i < 5; i += 1) {
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

describe('useContainerAction', () => {
  it('discards an old action outcome instead of announcing it after an account switch', async () => {
    const { result, unmount, queryClient } = await setup('sogo-mailcow')
    let release!: () => void
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    const received = vi.fn()
    server.use(
      http.post('*/api/v2/containers/sogo-mailcow/start', async () => {
        received()
        await pending
        return HttpResponse.error()
      }),
    )
    const running = result.run('start')
    await vi.waitFor(() => expect(received).toHaveBeenCalledOnce())
    unmount()
    invalidateSessionScope()
    queryClient.clear()
    release()
    await running
    expect(useStatusMessage().messages.value).toHaveLength(0)
    expect(result.outcome.value).toBeNull()
    expect(queryClient.getQueryData(operationsKeys.monitoring.containers())).toBeUndefined()
  })
  it('starts without a confirmation and writes the container into the list', async () => {
    const { result, queryClient } = await setup('sogo-mailcow', 'admin-operations')
    const run = result.run('start')
    await nextTick()
    expect(confirmState.value).toBeNull()
    expect(result.pending.value).toBe(true)
    await run
    expect(result.outcome.value).toMatchObject({ tone: 'success', text: 'OK' })
    const list = queryClient.getQueryData<Container[]>(operationsKeys.monitoring.containers())!
    expect(list.find((item) => item.name === 'sogo-mailcow')!.running).toBe(true)
  })

  it('asks before a restart with legacy texts, and sends nothing when cancelled', async () => {
    const { result } = await setup('dovecot-mailcow')
    const run = result.run('restart')
    await nextTick()
    expect(confirmState.value).toMatchObject({
      title: 'Restart container (dovecot-mailcow)',
      confirmLabel: 'Restart now',
      cancelLabel: 'Cancel',
    })
    settleConfirm(false)
    await run
    expect(calls('restartContainer')).toHaveLength(0)
    expect(result.outcome.value).toBeNull()
  })

  it('asks before a stop and reports "Not running" when nothing changed', async () => {
    const { result } = await setup('sogo-mailcow', 'admin-operations')
    const run = result.run('stop')
    await nextTick()
    expect(confirmState.value).toMatchObject({
      title: 'Stop container (sogo-mailcow)',
      confirmLabel: 'Stop now',
      destructive: true,
    })
    settleConfirm(true)
    await run
    expect(result.outcome.value?.text).toBe('Not running')
  })

  it('reports an unknown outcome, reads the container once and never repeats', async () => {
    const { result } = await setup('olefy-mailcow')
    const run = result.run('restart')
    await nextTick()
    settleConfirm(true)
    await run
    await settle()
    expect(result.outcome.value).toMatchObject({ text: 'Outcome unknown', tone: 'warning' })
    expect(result.outcome.value?.detail).toContain('It is unknown whether the action was completed')
    expect(calls('restartContainer')).toHaveLength(1)
    expect(calls('getContainer')).toHaveLength(1)
  })

  it("shows the service's refusal with its message and reads the container", async () => {
    const { result } = await setup('memcached-mailcow')
    const run = result.run('stop')
    await nextTick()
    settleConfirm(true)
    await run
    expect(result.outcome.value).toMatchObject({
      tone: 'danger',
      text: 'Error: Cannot kill container: memcached-mailcow is busy',
    })
    expect(calls('getContainer')).toHaveLength(1)
  })

  it('warns when the action has no audit record', async () => {
    const { result } = await setup('redis-mailcow')
    const run = result.run('restart')
    await nextTick()
    settleConfirm(true)
    await run
    expect(result.outcome.value).toMatchObject({ text: 'OK', auditRecorded: false })
  })

  it('reports a removed container and refreshes the list', async () => {
    const { result, queryClient } = await setup('acme-mailcow')
    const run = result.run('restart')
    await nextTick()
    settleConfirm(true)
    await run
    expect(result.outcome.value?.text).toBe('This item could not be found.')
    expect(queryClient.getQueryState(operationsKeys.monitoring.containers())?.isInvalidated).toBe(
      true,
    )
  })

  it('shows the outcome as a status message when the card is gone', async () => {
    const { result, unmount } = await setup('sogo-mailcow')
    const run = result.run('restart')
    await nextTick()
    settleConfirm(true)
    await nextTick()
    unmount()
    await run
    expect(useStatusMessage().messages.value.map((message) => message.text)).toEqual([
      'sogo-mailcow: OK',
    ])
  })
})
