// The "Rename mailbox" tab (UI 003 T113, data-model §7.3) and the rename report: the form only
// after the backup acknowledgement, the local part prefilled and the alias checked, an unchanged
// name refused before sending, the holder of a taken address named on the field, the alias limit,
// an inactive mailbox, a temporary failure, the success opening the new address with legacy's
// message, and the persistent report of an incomplete or unknown rename with every step.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { fetchMailbox } from '@/features/mailboxes/api'
import RenameReport from '@/features/mailboxes/components/dialogs/RenameReport.vue'
import RenameSection from '@/features/mailboxes/components/sections/RenameSection.vue'
import { takeMailboxFlash } from '@/features/mailboxes/flash'

import { mockState, useScenario } from '../../../../mocks/node'
import { mountWithApp } from '../../../support/mount'

function router() {
  return createRouter({
    history: createMemoryHistory('/ng/'),
    routes: [
      { path: '/mailboxes', name: 'mailboxes', component: { render: () => null } },
      { path: '/mailboxes/:address', name: 'mailbox-detail', component: { render: () => null } },
    ],
  })
}

async function mount(address: string) {
  useScenario('admin-rename')
  const mailbox = await fetchMailbox(address)
  const r = router()
  await r.push(`/mailboxes/${address}`)
  const wrapper = mountWithApp(RenameSection, {
    props: { mailbox },
    global: { plugins: [r] },
    attachTo: document.body,
  })
  await flushPromises()
  return { wrapper, router: r }
}

const renames = () => mockState().requests.filter((r) => r.operationId === 'renameMailbox')

async function rename(
  wrapper: Awaited<ReturnType<typeof mount>>['wrapper'],
  localPart: string,
  alias = true,
) {
  await wrapper.get('#rename-agree').setValue(true)
  await wrapper.get('#rename-local-part').setValue(localPart)
  if (!alias) await wrapper.get('#rename-alias').setValue(false)
  const before = renames().length
  await wrapper.get('form').trigger('submit')
  await flushPromises()
  if (wrapper.find('form').exists()) {
    await vi.waitFor(() => {
      expect(renames().length > before || wrapper.text().includes('same as the current')).toBe(true)
      expect(wrapper.find('button[type="submit"][disabled]').exists()).toBe(false)
    })
  }
  await flushPromises()
}

describe('RenameSection', () => {
  it('shows legacy’s warning and the form only after the acknowledgement, prefilled', async () => {
    const { wrapper } = await mount('anna@a.example')
    expect(wrapper.get('h2').text()).toBe('⚠️ Rename mailbox')
    expect(wrapper.text()).toContain('IMPORTANT! Create a backup before renaming the mailbox.')
    expect(wrapper.find('form').exists()).toBe(false)
    await wrapper.get('#rename-agree').setValue(true)
    expect((wrapper.get('#rename-local-part').element as HTMLInputElement).value).toBe('anna')
    expect(wrapper.text()).toContain('@a.example')
    expect((wrapper.get('#rename-alias').element as HTMLInputElement).checked).toBe(true)
    expect(wrapper.text()).toContain('Create alias automatically')
    expect(wrapper.get('button[type="submit"]').text()).toBe('Save changes')
  })

  it('refuses an unchanged name, including a letter-case change, without a request', async () => {
    const { wrapper } = await mount('anna@a.example')
    await rename(wrapper, 'ANNA')
    expect(wrapper.text()).toContain('The new value is the same as the current one.')
    expect(renames()).toHaveLength(0)
  })

  it('opens the new address with legacy’s message after a rename with the alias', async () => {
    const { wrapper, router: r } = await mount('anna@a.example')
    await rename(wrapper, 'anna.smith')
    await vi.waitFor(() => expect(r.currentRoute.value.params.address).toBe('anna.smith@a.example'))
    expect(renames()[0]?.body).toEqual({ newLocalPart: 'anna.smith', keepOldAddressAsAlias: true })
    const [flash] = takeMailboxFlash('anna.smith@a.example')
    expect(flash?.text).toEqual({
      legacy: 'success.mailbox_renamed',
      args: ['anna@a.example', 'anna.smith@a.example'],
    })
  })

  it('names the holder of a taken address on the field and changes nothing', async () => {
    const { wrapper, router: r } = await mount('anna@a.example')
    await rename(wrapper, 'taken')
    expect(wrapper.get('#rename-local-part-error').text()).toContain('taken@a.example')
    expect(r.currentRoute.value.params.address).toBe('anna@a.example')
  })

  it('reports the alias limit, an inactive mailbox and a temporary failure on the form', async () => {
    const full = await mount('fay@full.example')
    await rename(full.wrapper, 'faye')
    expect(full.wrapper.get('[data-form-error]').text()).toBe('Max. aliases exceeded')
    full.wrapper.unmount()
    const inactive = await mount('carl@a.example')
    await rename(inactive.wrapper, 'carlos')
    expect(inactive.wrapper.get('[data-form-error]').text()).toBe(
      'Only active mailboxes and mailboxes with login disallowed can be renamed.',
    )
    inactive.wrapper.unmount()
    const webfail = await mount('webfail@a.example')
    await rename(webfail.wrapper, 'web.new')
    expect(webfail.wrapper.get('[data-form-error]').text()).toContain('Nothing was changed')
  })

  it('keeps the report of an incomplete rename until it is dismissed', async () => {
    const { wrapper, router: r } = await mount('broken@a.example')
    await rename(wrapper, 'broken.new')
    const report = wrapper.get('[data-rename-report]')
    expect(report.attributes('role')).toBe('alert')
    expect(report.attributes('data-kind')).toBe('incomplete')
    expect(report.text()).toContain('Previous address: broken@a.example')
    expect(report.text()).toContain('New address: broken.new@a.example')
    expect(report.get('[data-step="database"] [data-outcome]').text()).toBe('Undo failed')
    expect(r.currentRoute.value.params.address).toBe('broken@a.example')
    await report.get('button').trigger('click')
    expect(wrapper.find('[data-rename-report]').exists()).toBe(false)
  })
})

describe('RenameReport', () => {
  it('translates every step and outcome and names the unknown step', () => {
    const wrapper = mountWithApp(RenameReport, {
      props: {
        message: 'Unknown.',
        report: {
          kind: 'unknown',
          previousAddress: 'slow@a.example',
          newAddress: 'slow.new@a.example',
          unknownStep: 'mailStoreMove',
          steps: [
            { step: 'database', outcome: 'done' },
            { step: 'mailStoreMove', outcome: 'unknown' },
            { step: 'webmailRename', outcome: 'notDone' },
          ],
        },
      },
    })
    expect(wrapper.get('[data-unknown-step]').text()).toBe('Unknown outcome: Moving the mail')
    expect(wrapper.findAll('[data-step]').map((row) => row.text())).toEqual([
      'Updating the databaseDone',
      'Moving the mailUnknown',
      'Renaming the webmail dataNot done',
    ])
  })
})
