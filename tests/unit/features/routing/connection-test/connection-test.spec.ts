// The connection test (UI 009 T069, T070, T071): the summary and the eight steps in words, the
// transcript's markers and plain text, the watchdog that ends a test without answer, and the page
// with its form, verdict, steps, transcript and copy action.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, effectScope, h } from 'vue'

import type { RoutingConnectionTestResult } from '@/api'
import { stepTimeline, testSummary } from '@/features/routing/logic/test-summary'
import { MARKERS, toPlainText } from '@/features/routing/logic/transcript'
import {
  useConnectionTest,
  WATCHDOG_MARGIN_SECONDS,
} from '@/features/routing/composables/useConnectionTest'
import * as clipboard from '@/shared/platform/clipboard'

import { mockState, useScenario } from '../../../../mocks/node'
import { TEST_TRANSPORTS } from '../../../../mocks/scenarios/routing/connection-tests'
import { mountWithApp, testPlugins } from '../../../support/mount'
import { mountRoute, settle, until } from '../pages/mount-route'

const base: RoutingConnectionTestResult = {
  accepted: true,
  step: 'message',
  failure: null,
  lastReply: { code: 250, text: '2.0.0 Ok: queued' },
  host: 'smtp.example.net',
  hostSource: 'nextHop',
  port: 587,
  nextHop: '[smtp.example.net]:587',
  tls: true,
  login: 'succeeded',
  sender: 'relay@example.org',
  recipient: 'null@hosted.mailcow.de',
  startedAt: '2026-10-19T08:00:00Z',
  durationMs: 1234,
  transcript: [
    { direction: 'server', text: '220 smtp.example.net ESMTP' },
    { direction: 'client', text: 'EHLO mail.example.org' },
    { direction: 'info', text: 'TLS started' },
  ],
}

describe('testSummary and stepTimeline', () => {
  it('reads an accepted test: every step passed, time rounded to tenths', () => {
    const summary = testSummary(base)
    expect(summary).toMatchObject({
      verdict: 'accepted',
      step: 'message',
      reasonKey: null,
      unknownReason: null,
      server: { host: 'smtp.example.net', port: 587, viaMx: false },
      tls: true,
      durationSeconds: 1.2,
    })
    expect(stepTimeline(base).every((item) => item.state === 'passed')).toBe(true)
  })

  it('reads a failure with its reason, the steps after it not reached, TLS and login not used', () => {
    const failed = {
      ...base,
      accepted: false,
      step: 'recipient',
      failure: { reason: 'rejected', message: 'x' },
      tls: false,
      login: 'notConfigured',
      hostSource: 'mailExchanger',
    } as RoutingConnectionTestResult
    expect(testSummary(failed)).toMatchObject({
      verdict: 'notAccepted',
      reasonKey: 'routing.connectionTest.reason.rejected',
      server: { viaMx: true },
    })
    const states = Object.fromEntries(stepTimeline(failed).map((item) => [item.step, item.state]))
    expect(states).toEqual({
      resolve: 'passed',
      connect: 'passed',
      greeting: 'passed',
      tls: 'notOffered',
      login: 'notConfigured',
      sender: 'passed',
      recipient: 'failed',
      message: 'notReached',
    })
  })

  it('shows an unknown reason with the generic text and no server without a host', () => {
    const unknown = {
      ...base,
      accepted: false,
      step: 'resolve',
      host: null,
      failure: { reason: 'somethingNew', message: 'x' },
    } as unknown as RoutingConnectionTestResult
    expect(testSummary(unknown)).toMatchObject({
      reasonKey: 'routing.connectionTest.reasonUnknown',
      unknownReason: 'somethingNew',
      server: null,
    })
  })
})

describe('transcript', () => {
  it('marks each direction and copies one line per entry', () => {
    expect(MARKERS).toEqual({ client: 'C:', server: 'S:', info: '*' })
    expect(toPlainText(base.transcript)).toBe(
      'S: 220 smtp.example.net ESMTP\nC: EHLO mail.example.org\n* TLS started',
    )
  })
})

describe('useConnectionTest', () => {
  function harness(total: number | undefined) {
    let api!: ReturnType<typeof useConnectionTest>
    const Host = defineComponent({
      setup() {
        api = useConnectionTest({
          kind: () => 'transport',
          id: () => TEST_TRANSPORTS.never,
          totalTimeoutSeconds: () => total,
        })
        return () => h('div')
      },
    })
    const wrapper = mountWithApp(Host)
    return { api: () => api, wrapper }
  }

  it('ends a test without answer after the server timeout plus the margin', async () => {
    useScenario('routing-tests')
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const { api } = harness(1)
      const running = api().run({})
      await flushPromises()
      expect(api().state.value).toBe('running')
      await vi.advanceTimersByTimeAsync((1 + WATCHDOG_MARGIN_SECONDS) * 1000 + 100)
      await running
      expect(api().state.value).toBe('noResult')
      expect(api().result.value).toBeNull()
      // Nothing of the test is kept in the mutation cache.
      expect(testPlugins().queryClient.getMutationCache().getAll()).toEqual([])
    } finally {
      vi.useRealTimers()
    }
  })

  it('reports a refusal as a problem and forgets everything on reset', async () => {
    useScenario('routing-tests')
    const scope = effectScope()
    const { api } = scope.run(() => harness(undefined))!
    // An unknown transport: the request is refused with 404.
    mockState().routing.transports = mockState().routing.transports.filter(
      (item) => item.id !== TEST_TRANSPORTS.never,
    )
    await api().run({})
    expect(api().state.value).toBe('idle')
    expect(api().problem.value?.status).toBe(404)
    expect(testPlugins().queryClient.getMutationCache().getAll()).toEqual([])
    api().reset()
    expect(api().problem.value).toBeNull()
    scope.stop()
  })
})

describe('ConnectionTestPage', { timeout: 60_000 }, () => {
  it('runs a relayhost test and shows the verdict, the steps and the transcript', async () => {
    const copy = vi.spyOn(clipboard, 'copyText').mockResolvedValue('copied')
    const { wrapper } = await mountRoute('/routing/relayhosts/1/test', {
      scenario: 'routing-tests',
    })
    const recipient = await until(() => wrapper.get<HTMLInputElement>('#connection-test-recipient'))
    await until(() => expect(recipient.element.value).toBe('null@hosted.mailcow.de'))
    await wrapper.get('#connection-test-sender').setValue('not an address')
    await wrapper.get('form[data-test-form]').trigger('submit')
    await settle()
    expect(wrapper.find('#connection-test-sender-error').exists()).toBe(true)
    await wrapper.get('#connection-test-sender').setValue('relay@example.org')
    await wrapper.get('form[data-test-form]').trigger('submit')
    await until(() => expect(wrapper.text()).toContain('Accepted'))
    expect(wrapper.text()).toContain('Reached: Message')
    expect(wrapper.find('[data-transcript]').exists()).toBe(true)
    const copyButton = wrapper.findAll('button').find((item) => item.text().includes('Copy'))
    if (copyButton) {
      await copyButton.trigger('click')
      await settle()
      expect(copy).toHaveBeenCalled()
    }
  })

  it('shows each failed step with its reason', async () => {
    const { wrapper } = await mountRoute(`/routing/transports/${TEST_TRANSPORTS.login}/test`, {
      scenario: 'routing-tests',
    })
    await until(() => wrapper.get('form[data-test-form]'))
    await wrapper.get('form[data-test-form]').trigger('submit')
    await until(() => expect(wrapper.text()).toContain('Not accepted'))
    expect(wrapper.text()).toContain('Failed at: Login')
    expect(wrapper.text()).toContain('535')
  })

  it('shows "not found" for an entry that does not exist', async () => {
    const { wrapper } = await mountRoute('/routing/transports/999/test', {
      scenario: 'routing-tests',
    })
    await until(() => expect(wrapper.text()).toContain('Back to the list'))
  })
})
