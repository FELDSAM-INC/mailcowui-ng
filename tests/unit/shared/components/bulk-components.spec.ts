// The bulk action bar and the per-item result summary (UI 002 T014, research D22).
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { ApiProblem } from '@/api'
import BulkActionBar from '@/shared/components/BulkActionBar.vue'
import BulkResultSummary from '@/shared/components/BulkResultSummary.vue'
import type { BulkRow } from '@/shared/components/bulk-row'
import * as announcer from '@/shared/composables/useAnnouncer'

import { mountWithApp } from '../../support/mount'

describe('BulkActionBar', () => {
  const actions = [
    { id: 'activate', label: 'Activate' },
    { id: 'delete', label: 'Delete', destructive: true },
  ]

  it('names the number selected and lists the actions with 44 px targets', () => {
    const wrapper = mountWithApp(BulkActionBar, { props: { count: 3, actions } })
    expect(wrapper.text()).toContain('3 selected')
    const buttons = wrapper.findAll('button')
    expect(buttons.map((b) => b.text())).toEqual(expect.arrayContaining(['Activate', 'Delete']))
    for (const button of buttons)
      expect(button.classes().join(' ')).toMatch(/\b(h-11|size-11|min-h-11)\b/)
    expect(wrapper.get('[role="region"]').attributes('aria-label')).toBe('Bulk actions')
  })

  it('emits the chosen action from the keyboard and disables the actions with nothing selected', async () => {
    const wrapper = mountWithApp(BulkActionBar, { props: { count: 1, actions } })
    const activate = wrapper.findAll('button').find((b) => b.text() === 'Activate')!
    await activate.trigger('click')
    expect(wrapper.emitted('action')).toEqual([['activate']])
    await wrapper.setProps({ count: 0 })
    expect(
      wrapper
        .findAll('button')
        .find((b) => b.text() === 'Activate')!
        .attributes('disabled'),
    ).toBeDefined()
  })

  it('shows the limit message when given', () => {
    const wrapper = mountWithApp(BulkActionBar, {
      props: {
        count: 20,
        actions,
        limitMessage: 'You can select at most 20 items for one action.',
      },
    })
    expect(wrapper.text()).toContain('at most 20')
  })
})

describe('BulkResultSummary', () => {
  const problem = ApiProblem.fromParts({
    kind: 'problem',
    type: '/api/v2/problems/temporary-failure',
    status: 503,
    requestId: 'a'.repeat(32),
  })
  const rows: BulkRow[] = [
    { id: 'a', label: 'a.example', outcome: 'done' },
    { id: 'b', label: 'b.example', outcome: 'notFound' },
    { id: 'c', label: 'c.example', outcome: 'refused', problem },
    { id: 'd', label: 'd.example', outcome: 'outdated' },
    { id: 'e', label: 'e.example', outcome: 'failed', problem },
    { id: 'f', label: 'f.example', outcome: 'skipped' },
    { id: 'g', label: 'g.example', outcome: 'unknown' },
    { id: 'h', label: 'h.example', outcome: 'notProcessed' },
  ]

  it('shows one row per item with a translated outcome as text and icon', () => {
    const wrapper = mountWithApp(BulkResultSummary, { props: { rows } })
    const items = wrapper.findAll('li')
    expect(items).toHaveLength(8)
    const texts = items.map((item) => item.text())
    expect(texts[0]).toContain('a.example')
    expect(texts[0]).toContain('Done')
    expect(texts[1]).toContain('Not found')
    expect(texts[2]).toContain('Refused')
    expect(texts[3]).toContain('Changed in the meantime')
    expect(texts[4]).toContain('Failed')
    expect(texts[5]).toContain('Skipped')
    expect(texts[6]).toContain('Outcome unknown')
    expect(texts[7]).toContain('Not processed')
    for (const item of items) expect(item.find('svg').exists()).toBe(true)
  })

  it('shows the problem message of a row', () => {
    const wrapper = mountWithApp(BulkResultSummary, { props: { rows } })
    expect(wrapper.findAll('li')[4]!.text()).toContain('temporarily unavailable')
  })

  it('announces the counts per outcome politely', async () => {
    const announce = vi.spyOn(announcer, 'announce')
    mountWithApp(BulkResultSummary, { props: { rows } })
    await flushPromises()
    expect(announce).toHaveBeenCalled()
    const [message, options] = announce.mock.calls.at(-1)!
    expect(message).toContain('1 done')
    expect(message).toContain('1 failed')
    expect(options?.assertive).toBeFalsy()
  })

  it('offers a retry only when failed, refused or outdated rows exist', async () => {
    const wrapper = mountWithApp(BulkResultSummary, { props: { rows } })
    const retry = wrapper.findAll('button').find((b) => b.text().includes('Retry'))
    expect(retry).toBeDefined()
    await retry!.trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
    const done = mountWithApp(BulkResultSummary, { props: { rows: [rows[0]!, rows[6]!] } })
    expect(done.findAll('button').some((b) => b.text().includes('Retry'))).toBe(false)
  })
})
