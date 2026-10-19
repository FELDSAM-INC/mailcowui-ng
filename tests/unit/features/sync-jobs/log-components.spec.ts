// The log viewer's parts (UI 008 T064): the text (text interpolation only, markers for control and
// bidi characters, wrapping classes, a chunk per 500 lines with `content-visibility`, `dir="auto"`,
// a named, focusable region) and the dialog (full screen below md, the header values, copying the
// original text with its announcements, the empty states, the running notice and Refresh).
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import SyncJobLogDialog from '@/features/sync-jobs/components/SyncJobLogDialog.vue'
import SyncJobLogText from '@/features/sync-jobs/components/SyncJobLogText.vue'
import { liveMessages } from '@/shared/composables/useAnnouncer'

import { applyOverrides } from '../../../mocks/scenarios'
import { mockState, useScenario } from '../../../mocks/node'
import { installMatchMedia } from '../../support/media'
import { mountWithApp } from '../../support/mount'

const settle = (check: () => void) => vi.waitFor(check, { timeout: 5000 })

describe('SyncJobLogText', () => {
  it('shows the text verbatim in chunks, with markers and no element from the data', () => {
    const log = `<script>alert(1)</script>\n&amp; a\u202Eb\n${'x\n'.repeat(600)}`
    const wrapper = mountWithApp(SyncJobLogText, { props: { text: log, wrap: true, label: 'Log' } })
    const region = wrapper.get('[role="region"]')
    expect(region.attributes()).toMatchObject({ 'aria-label': 'Log', tabindex: '0', dir: 'auto' })
    expect(region.classes()).toContain('whitespace-pre-wrap')
    expect(wrapper.findAll('[data-chunk]')).toHaveLength(2)
    expect(wrapper.find('script').exists()).toBe(false)
    expect(wrapper.text()).toContain('<script>alert(1)</script>')
    expect(wrapper.text()).toContain('&amp;')
    expect(wrapper.get('[data-marker]').text()).toBe('U+202E')
    const nowrap = mountWithApp(SyncJobLogText, { props: { text: 'a', wrap: false, label: 'Log' } })
    expect(nowrap.get('[role="region"]').classes()).toContain('whitespace-pre')
  })
})

async function openDialog(id: number, scenario = 'sync-jobs-admin', wide = true) {
  installMatchMedia({ '(min-width: 768px)': wide })
  useScenario(scenario)
  const router = createRouter({
    history: createMemoryHistory('/ng/'),
    routes: [{ path: '/sync-jobs', name: 'sync-jobs', component: { render: () => null } }],
  })
  await router.push('/sync-jobs')
  const wrapper = mountWithApp(SyncJobLogDialog, {
    props: { jobId: id, role: 'admin' },
    global: { plugins: [router] },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

describe('SyncJobLogDialog', () => {
  it('shows the header and copies the original text', async () => {
    const write = vi.fn(() => Promise.resolve())
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: write } })
    const wrapper = await openDialog(2)
    await settle(() => expect(document.body.textContent).toContain('Host1:'))
    const dialog = document.querySelector('[role="dialog"]')!
    expect(dialog.textContent).toContain('Log')
    expect(dialog.textContent).toContain('alice@mail.previous.example:993')
    expect(dialog.textContent).toContain('Wrong username or password')
    const copy = [...dialog.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Copy',
    )!
    copy.click()
    await settle(() =>
      expect(write).toHaveBeenCalledWith(mockState().syncJobs.jobs.find((j) => j.id === 2)!.log),
    )
    await settle(() => expect(liveMessages.polite.value).toBe('The log was copied.'))
    wrapper.unmount()
  })

  it('says when copying is not available and toggles wrapping', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined })
    const wrapper = await openDialog(2)
    await settle(() => expect(document.body.textContent).toContain('Host1:'))
    const buttons = () => [...document.querySelectorAll('[role="dialog"] button')]
    buttons()
      .find((b) => b.textContent?.trim() === 'Copy')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await settle(() =>
      expect(liveMessages.polite.value).toBe(
        'Copying is not available. Select the text to copy it.',
      ),
    )
    const wrap = buttons().find((b) => b.textContent?.trim() === 'Wrap lines')!
    expect(wrap.getAttribute('aria-pressed')).toBe('true')
    wrap.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(wrap.getAttribute('aria-pressed')).toBe('false')
    wrapper.unmount()
  })

  it('tells a job that never ran from a run without output, and notes a running job', async () => {
    let wrapper = await openDialog(1)
    await settle(() => expect(document.body.textContent).toContain('No log yet.'))
    wrapper.unmount()
    wrapper = await openDialog(18)
    await settle(() => expect(document.body.textContent).toContain('The run produced no output.'))
    wrapper.unmount()
    wrapper = await openDialog(4)
    await settle(() =>
      expect(document.body.textContent).toContain(
        'A run is in progress. This is the log of the previous run.',
      ),
    )
    const before = mockState().requests.filter((r) => r.operationId === 'getSyncJobLog').length
    applyOverrides(mockState(), {
      syncJobs: { finishRun: { id: 4, lastResult: 'succeeded', exitStatus: 'EX_OK' } },
    })
    ;[...document.querySelectorAll('[role="dialog"] button')]
      .find((b) => b.textContent?.trim() === 'Refresh')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await settle(() =>
      expect(mockState().requests.filter((r) => r.operationId === 'getSyncJobLog').length).toBe(
        before + 1,
      ),
    )
    wrapper.unmount()
  })

  it('fills the screen below md and says when the job is gone', async () => {
    const wrapper = await openDialog(999, 'sync-jobs-admin', false)
    await settle(() =>
      expect(document.body.textContent).toContain('This sync job no longer exists.'),
    )
    expect(document.querySelector('[role="dialog"]')!.className).toContain('h-dvh')
    wrapper.unmount()
  })
})
