// UI 006 (T019, research R8): the capabilities are read once, under one key, fresh for ten minutes,
// with loading and error states and a retry, and shared by two consumers without a second request.
import { flushPromises } from '@vue/test-utils'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'

import { queryKeys } from '@/api'
import {
  CAPABILITIES_STALE_TIME,
  quarantineCapabilitiesOptions,
  useQuarantineCapabilities,
} from '@/features/quarantine/capabilities'

import { mountWithApp, testPlugins } from '../../support/mount'
import { server } from '../../../mocks/node'

const CAPS = {
  bulkLimit: 100,
  defaultPageSize: 25,
  maxPageSize: 1000,
  contentSizeLimit: 10_485_760,
  pipelineMaxMessageSize: 10_485_760,
  spamScore: { min: 0, max: 5000, step: 0.1 },
  senderPattern: { maxLength: 100, allowedCharacters: 'a-z0-9@_.*-', wildcard: '*' },
  rateLimit: { min: 1, max: 2147483647, frames: ['second', 'minute', 'hour', 'day'] },
  settings: {
    maxRetentionPerMailbox: 1000,
    maxMessageSizeStep: 1_048_576,
    maxMessageSize: 104_857_600,
    maxAgeDays: { min: 1, max: 3650, default: 365 },
    notificationSubjectMaxLength: 255,
    notificationTemplateMaxBytes: 1_048_576,
    templateRenderTimeoutSeconds: 5,
    releaseFormats: ['original', 'attachment'],
  },
  virusScanning: true,
}

function consumer() {
  return defineComponent({
    setup() {
      const query = useQuarantineCapabilities()
      return () =>
        h(
          'p',
          query.isPending.value
            ? 'loading'
            : query.isError.value
              ? 'error'
              : String(query.data.value?.bulkLimit),
        )
    },
  })
}

describe('useQuarantineCapabilities', () => {
  it('reads the capabilities once under one key for two consumers', async () => {
    let calls = 0
    server.use(
      http.get('*/api/v2/capabilities/quarantine', () => {
        calls += 1
        return HttpResponse.json({ data: CAPS })
      }),
    )
    const Parent = defineComponent({ setup: () => () => [h(consumer()), h(consumer())] })
    const wrapper = mountWithApp(Parent)
    expect(wrapper.text()).toContain('loading')
    await flushPromises()
    expect(wrapper.text()).toBe('100100')
    expect(calls).toBe(1)
    expect(testPlugins().queryClient.getQueryData(queryKeys.quarantine.capabilities())).toEqual(
      CAPS,
    )
    expect(quarantineCapabilitiesOptions().staleTime).toBe(CAPABILITIES_STALE_TIME)
    expect(CAPABILITIES_STALE_TIME).toBe(600_000)
  })

  it('exposes the error state and retries on request', async () => {
    let fail = true
    server.use(
      http.get('*/api/v2/capabilities/quarantine', () =>
        fail
          ? HttpResponse.json(
              { type: 'about:blank', title: 'x', status: 500, requestId: '0'.repeat(32) },
              { status: 500, headers: { 'Content-Type': 'application/problem+json' } },
            )
          : HttpResponse.json({ data: CAPS }),
      ),
    )
    let retry!: () => unknown
    const Probe = defineComponent({
      setup() {
        const query = useQuarantineCapabilities()
        retry = () => query.refetch()
        return () =>
          h('p', query.isError.value ? 'error' : String(query.data.value?.bulkLimit ?? ''))
      },
    })
    const wrapper = mountWithApp(Probe)
    await flushPromises()
    expect(wrapper.text()).toBe('error')
    fail = false
    await retry()
    await flushPromises()
    expect(wrapper.text()).toBe('100')
  })
})
