// The audit log page (FR-072, FR-073): the list from the address, the table from md up, the chips
// and the empty state that clears the filters.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import AuditLogPage from '@/features/audit-log/pages/AuditLogPage.vue'

import { mockState, useScenario } from '../../../mocks/node'
import { installMatchMedia } from '../../support/media'
import { mountWithApp } from '../../support/mount'
import { createTestRouter } from '../../support/router'

async function mountPage(path: string, wide = true) {
  installMatchMedia({ '(min-width: 768px)': wide })
  useScenario('audit-records')
  const router = createTestRouter()
  await router.push(path)
  const wrapper = mountWithApp(AuditLogPage, {
    global: { plugins: [router] },
    attachTo: document.body,
  })
  await vi.waitFor(() =>
    expect(wrapper.text()).toMatch(/Showing \d+ to \d+ of \d+ entries|No matching records found/),
  )
  await flushPromises()
  return { wrapper, router }
}

const button = (wrapper: Awaited<ReturnType<typeof mountPage>>['wrapper'], name: string) =>
  wrapper.findAll('button').find((b) => (b.attributes('aria-label') ?? b.text()) === name)

describe('AuditLogPage', () => {
  it('shows 25 records in a table from md up, with the total', async () => {
    const { wrapper } = await mountPage('/audit-log')
    expect(wrapper.text()).toContain('Showing 1 to 25 of 41 entries')
    expect(wrapper.findAll('tbody tr[data-record]')).toHaveLength(25)
    const toggle = wrapper.get('tbody tr[data-record] button')
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(wrapper.find(`#${toggle.attributes('aria-controls')}`).text()).toContain('Request ID')
    const request = mockState().requests.find((r) => r.operationId === 'listAuditEvents')
    expect(request?.path).toContain('sort=occurredAt')
    expect(request?.path).toContain('order=desc')
  })

  it('shows cards below md', async () => {
    const { wrapper } = await mountPage('/audit-log', false)
    expect(wrapper.find('table').exists()).toBe(false)
    expect(wrapper.findAll('ul[aria-label="Audit records"] > li')).toHaveLength(25)
  })

  it('removes a chip and clears all filters', async () => {
    const { wrapper, router } = await mountPage(
      '/audit-log?event=signOut&event=signIn&outcome=success',
    )
    expect(button(wrapper, 'Remove filter: Sign-out')).toBeDefined()
    await button(wrapper, 'Remove filter: Sign-out')!.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ event: ['signIn'], outcome: 'success' })
    await button(wrapper, 'Clear all filters')!.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({})
  })

  it('offers to clear filters that match nothing', async () => {
    const { wrapper, router } = await mountPage('/audit-log?actor=nobody')
    // DataTables' texts of the classic log tables (`datatables.zeroRecords`).
    expect(wrapper.text()).toContain('No matching records found')
    const clears = wrapper.findAll('button').filter((b) => b.text() === 'Clear filters')
    await clears[clears.length - 1]!.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({})
  })

  it('notes that filtering by one object is not available yet', async () => {
    const { wrapper } = await mountPage('/audit-log?targetType=apiKey&targetId=K1')
    expect(wrapper.get('[role="note"]').text()).toContain('comes with a later version')
    const request = mockState().requests.find((r) => r.operationId === 'listAuditEvents')
    expect(request?.path).not.toContain('target')
  })
})
