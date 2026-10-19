// The results of a generation or copy run (T015, data-model §7, research R8): one row per name with
// its outcome and translated reason, the counts, the publication outcome and a link for created
// keys, "Retry" for refused, unknown and not processed names only, the progress bar, and polite
// announcements at the start, at each 10 % step and at the end.
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent } from 'vue'

import { ApiProblem, type DkimKeyChangeResult } from '@/api'
import RunResultList from '@/features/dns/components/RunResultList.vue'
import type { RunRow } from '@/features/dns/dkim/generate-run'
import { liveMessages } from '@/shared/composables/useAnnouncer'

import { mountWithApp } from '../../support/mount'

const Stub = defineComponent({ render: () => null })
const router = () =>
  createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: Stub },
      { path: '/dns/dkim-keys/:dkimName', name: 'dkim-key', component: Stub },
    ],
  })

function created(name: string): DkimKeyChangeResult {
  return {
    name,
    displayName: name,
    kind: 'domain',
    targetDomain: null,
    state: 'valid',
    key: {
      selector: 'dkim',
      keyLength: 2048,
      publicKey: 'AAAA',
      record: {
        name: `dkim._domainkey.${name}`,
        type: 'TXT',
        value: 'v=DKIM1;k=rsa;t=s;s=email;p=AAAA',
        valueParts: ['v=DKIM1;k=rsa;t=s;s=email;p=AAAA'],
      },
      complete: true,
      missingParts: [],
    },
    etag: '"1"',
    dnsPublication: { status: 'failed', recordName: null, reason: { code: 'timeout', detail: null } },
  }
}

const rows: RunRow[] = [
  { name: 'a.example', label: 'a.example', outcome: 'created', result: created('a.example') },
  {
    name: 'b.example',
    label: 'b.example',
    outcome: 'refused',
    problem: ApiProblem.fromParts({
      kind: 'problem',
      status: 409,
      type: '/api/v2/problems/dkim-key-exists',
    }),
  },
  {
    name: 'c.example',
    label: 'c.example',
    outcome: 'unknown',
    problem: ApiProblem.fromParts({ kind: 'network' }),
  },
  { name: 'd.example', label: 'd.example', outcome: 'notProcessed' },
]

describe('RunResultList', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }))
  afterEach(() => vi.useRealTimers())

  it('lists every name with its outcome, reason, publication outcome and link, and the counts', async () => {
    const r = router()
    const wrapper = mountWithApp(RunResultList, {
      props: { rows, total: 4, current: 0, running: false, mode: 'generate', publication: true },
      global: { plugins: [r] },
    })
    await flushPromises()
    const items = wrapper.findAll('[data-run-row]')
    expect(items).toHaveLength(4)
    expect(items[0]!.text()).toContain('DKIM key a.example has been saved')
    expect(items[0]!.find('[data-publication-outcome]').exists()).toBe(true)
    expect(items[0]!.get('a').attributes('href')).toBe('/dns/dkim-keys/a.example')
    expect(items[1]!.text()).toContain('A DKIM key for "b.example" exists and will not be overwritten')
    expect(items[2]!.text()).toContain('Outcome unknown')
    expect(items[3]!.text()).toContain('Not processed')
    expect(wrapper.text()).toContain('1 done')
    const retry = wrapper.get('[data-run-retry]')
    await retry.trigger('click')
    expect(wrapper.emitted('retry')?.[0]).toEqual([['b.example', 'c.example', 'd.example']])
  })

  it('offers no retry when every name was created', () => {
    const wrapper = mountWithApp(RunResultList, {
      props: { rows: [rows[0]!], total: 1, current: 0, running: false, mode: 'generate' },
      global: { plugins: [router()] },
    })
    expect(wrapper.find('[data-run-retry]').exists()).toBe(false)
  })

  it('shows the progress and announces the start, each 10 % step and the end', async () => {
    const said: string[] = []
    const record = () => {
      vi.advanceTimersByTime(60)
      const value = liveMessages.polite.value
      if (value && value !== said.at(-1)) said.push(value)
    }
    const wrapper = mountWithApp(RunResultList, {
      props: { rows: [], total: 20, current: 1, running: true, mode: 'generate' },
      global: { plugins: [router()] },
    })
    await flushPromises()
    record()
    const bar = wrapper.get('[role="progressbar"]')
    expect(bar.attributes('aria-valuenow')).toBe('0')
    expect(bar.attributes('aria-valuemax')).toBe('20')
    for (let current = 2; current <= 20; current += 1) {
      await wrapper.setProps({ current })
      record()
    }
    await wrapper.setProps({ running: false, current: 0, rows: [rows[0]!] })
    record()
    expect(said[0]).toContain('Started')
    const steps = said.filter((text) => text.includes('%'))
    expect(steps.length).toBeLessThanOrEqual(10)
    expect(steps.length).toBeGreaterThanOrEqual(8)
    expect(said.at(-1)).toContain('1 done')
  })
})
