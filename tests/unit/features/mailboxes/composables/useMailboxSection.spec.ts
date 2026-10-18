// One section of the mailbox page (UI 003 T041, research R6, data-model §7.1): Save sends the
// changed members as a JSON Merge Patch with If-Match; 200 continues with the new version and says
// legacy's "Changes to mailbox … have been saved"; 412 keeps the input and lists what changed with
// the saved values ("Save again", "Discard"); refused attributes turn read-only; field errors use
// legacy's messages; a save with a password never goes through the mutation cache.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, reactive } from 'vue'

import { queryKeys } from '@/api'
import { fetchMailbox } from '@/features/mailboxes/api'
import {
  useMailboxSection,
  type MailboxSectionProps,
} from '@/features/mailboxes/composables/useMailboxSection'
import type { Mailbox } from '@/features/mailboxes/types'

import { GIB } from '../../../../mocks/factories/domain'
import { mockState, useScenario } from '../../../../mocks/node'
import { applyOverrides } from '../../../../mocks/scenarios'
import { mountWithApp, testPlugins } from '../../../support/mount'

interface Form {
  displayName: string
  quota: number
  password: string
}

async function setup(address = 'anna@a.example', signedInAs = 'admin') {
  useScenario('admin-mailboxes-small', {
    signedInAs,
    domainAssignments: { reseller: ['a.example'] },
  })
  const mailbox = await fetchMailbox(address)
  testPlugins().queryClient.setQueryData(queryKeys.mailboxes.detail(address), mailbox)
  const props = reactive<MailboxSectionProps>({ mailbox, editing: false })
  const emitted: string[] = []
  let section!: ReturnType<typeof useMailboxSection<Form>>
  mountWithApp(
    defineComponent({
      setup() {
        section = useMailboxSection<Form>(props, (event: string) => emitted.push(event), {
          id: 'mailbox',
          fields: ['displayName', 'quota', 'password'],
          toForm: (m: Mailbox) => ({ displayName: m.displayName, quota: m.quota, password: '' }),
          makePatch: (opened, form, canEdit) => ({
            ...(form.displayName !== opened.displayName && canEdit('displayName')
              ? { displayName: form.displayName }
              : {}),
            ...(form.quota !== opened.quota && canEdit('quota') ? { quota: form.quota } : {}),
            ...(form.password ? { password: form.password } : {}),
          }),
        })
        return () => h('div')
      },
    }),
  )
  props.editing = true
  await flushPromises()
  return { props, section, emitted }
}

const patches = () =>
  mockState().requests.filter((request) => request.operationId === 'updateMailbox')

describe('useMailboxSection', () => {
  it('200: sends the changed members with If-Match and announces legacy’s success', async () => {
    const { section, emitted, props } = await setup()
    section.form.value.displayName = 'Anna S'
    await section.save()
    const request = patches().at(-1)!
    expect(request.headers['content-type']).toBe('application/merge-patch+json')
    expect(request.headers['if-match']).toBe(props.mailbox.etag)
    expect(request.body).toEqual({ displayName: 'Anna S' })
    expect(section.status.value).toEqual({
      kind: 'success',
      message: 'Changes to mailbox anna@a.example have been saved',
    })
    expect(emitted).toContain('close')
  })

  it('412: keeps the input, lists the changed values, and "Save again" uses the new version', async () => {
    const { section } = await setup()
    applyOverrides(mockState(), { mailboxes: { set: { 'anna@a.example': { quota: 3 * GIB } } } })
    section.form.value.displayName = 'Anna S'
    await section.save()
    expect(section.form.value.displayName).toBe('Anna S')
    expect(section.outdated.value).toEqual([
      { field: 'quota', label: expect.any(String), saved: '3 GiB' },
    ])
    await section.saveAgain()
    expect(patches().at(-1)?.status).toBe(200)
    expect(patches().at(-1)?.body).toEqual({ displayName: 'Anna S' })
  })

  it('"Discard my changes" takes the reloaded values', async () => {
    const { section } = await setup()
    applyOverrides(mockState(), {
      mailboxes: { set: { 'anna@a.example': { displayName: 'Elsewhere' } } },
    })
    section.form.value.quota = GIB
    await section.save()
    section.discard()
    expect(section.form.value).toEqual({ displayName: 'Elsewhere', quota: 2 * GIB, password: '' })
  })

  it('a refused attribute turns read-only and its error names the permission', async () => {
    const { section } = await setup('anna@a.example', 'reseller')
    const reseller = mockState().accounts.find((account) => account.username === 'reseller')!
    reseller.permissions.unlimitedQuota = false
    section.form.value.quota = 0
    await section.save()
    expect(section.canEdit('quota')).toBe(false)
    expect(section.errorsFor('quota')).toEqual(['Unlimited quota prohibited by ACL'])
  })

  it('shows legacy’s field messages for rule codes', async () => {
    const { section } = await setup()
    section.form.value.quota = 50 * GIB
    await section.save()
    expect(section.errorsFor('quota')).toEqual(['Quota exceeds the domain limit (max. 10240 MiB)'])
  })

  it('a save with a password never enters the mutation cache', async () => {
    const { section } = await setup()
    const mutations = testPlugins().queryClient.getMutationCache()
    const before = mutations.getAll().length
    section.form.value.password = 'Secret-pass-1'
    await section.save()
    expect(patches().at(-1)?.status).toBe(200)
    expect(mutations.getAll().length).toBe(before)
    expect(section.form.value.password).toBe('')
  })
})
