// The MTA-STS section of the domain page (T068 as settled: legacy's `#dmtasts` tab as a section):
// the policy and its records, no policy, set-up and changes with only the changed members and the
// version tag, the identifier notice and highlight, deactivation asking first, an outdated save,
// the client checks with the classic messages, and History for administrators only.
import { afterEach, describe, expect, it } from 'vitest'

import DomainMtaStsSection from '@/features/dns/components/DomainMtaStsSection.vue'
import { confirmState, settleConfirm } from '@/shared/composables/useConfirm'

import { mockState, useScenario } from '../../../mocks/node'
import { applyDnsOverrides } from '../../../mocks/scenarios/dns'
import { mountWithApp } from '../../support/mount'
import { mtaStsRouter, settle } from './mta-sts-fixtures'

async function mountSection(domain: string, signedInAs = 'admin') {
  useScenario('dns-mta-sts', { signedInAs })
  const router = mtaStsRouter()
  await router.push('/')
  const wrapper = mountWithApp(DomainMtaStsSection, {
    props: { domain },
    global: { plugins: [router] },
    attachTo: document.body,
  })
  await settle()
  return wrapper
}

const writes = () =>
  mockState().requests.filter(
    (request) => request.path.startsWith('/api/v2/mta-sts-policies') && request.method !== 'GET',
  )

afterEach(() => settleConfirm(false))

describe('DomainMtaStsSection', () => {
  it('shows the policy, its identifier, address, records and History', async () => {
    const wrapper = await mountSection('example.org')
    expect(wrapper.get('#mta-sts h2').text()).toBe('MTA-STS')
    const text = wrapper.text()
    for (const value of ['STSv1', 'enforce', '604,800', 'mail.example.org', 'Active']) {
      expect(text).toContain(value)
    }
    const policyId = mockState().dns.policies['example.org']!.policyId
    expect(text).toContain(policyId)
    const link = wrapper.get('a[href="https://mta-sts.example.org/.well-known/mta-sts.txt"]')
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toBe('noopener noreferrer')
    expect(text).toContain(`v=STSv1;id=${policyId};`)
    expect(wrapper.find('button[aria-label="Copy value of _mta-sts.example.org"]').exists()).toBe(
      true,
    )
    expect(
      wrapper.find('a[href="/audit-log?targetType=mtaStsPolicy&targetId=example.org"]').exists(),
    ).toBe(true)
    wrapper.unmount()
  })

  it('says that no policy is set up and creates one from the classic defaults', async () => {
    const wrapper = await mountSection('example.net')
    expect(wrapper.text()).toContain('No MTA-STS policy is set up for this domain.')
    await wrapper.get('button[aria-label="Edit MTA-STS"]').trigger('click')
    await settle()
    expect((wrapper.get('#mta-sts-mode').element as HTMLSelectElement).value).toBe('enforce')
    expect((wrapper.get('#mta-sts-max-age').element as HTMLInputElement).value).toBe('')
    expect((wrapper.get('#mta-sts-mx').element as HTMLTextAreaElement).value).toBe(
      'mail.example.org',
    )
    expect((wrapper.get('#mta-sts-active').element as HTMLInputElement).checked).toBe(false)
    await wrapper.get('#mta-sts-max-age').setValue('86400')
    await wrapper.get('form').trigger('submit')
    await settle(8)
    expect(writes().map((request) => [request.method, request.body])).toEqual([
      [
        'POST',
        {
          domain: 'example.net',
          version: 'STSv1',
          mode: 'enforce',
          maxAge: 86400,
          mxHosts: ['mail.example.org'],
          active: false,
        },
      ],
    ])
    expect(wrapper.text()).toContain('Changes to object example.net have been saved')
    expect(wrapper.find('form').exists()).toBe(false)
    expect(mockState().dns.policies['example.net']).toBeTruthy()
    wrapper.unmount()
  })

  it('sends only the changed mode with the version tag, then names the new identifier and highlights the record', async () => {
    const wrapper = await mountSection('example.org')
    const before = mockState().dns.policies['example.org']!.policyId
    await wrapper.get('button[aria-label="Edit MTA-STS"]').trigger('click')
    await settle()
    await wrapper.get('#mta-sts-mode').setValue('testing')
    await wrapper.get('form').trigger('submit')
    await settle(8)
    const [request] = writes()
    expect(request?.method).toBe('PATCH')
    expect(request?.body).toEqual({ mode: 'testing' })
    expect(request?.headers['content-type']).toBe('application/merge-patch+json')
    expect(request?.headers['if-match']).toMatch(/^"/)
    const after = mockState().dns.policies['example.org']!.policyId
    expect(after).not.toBe(before)
    expect(wrapper.get('[data-policy-id-notice]').text()).toContain(before)
    expect(wrapper.get('[data-policy-id-notice]').text()).toContain(after)
    expect(wrapper.get('[data-highlighted-record]').text()).toContain('Update this record')
    wrapper.unmount()
  })

  it('asks before a save that deactivates, and shows no identifier notice', async () => {
    const wrapper = await mountSection('example.org')
    await wrapper.get('button[aria-label="Edit MTA-STS"]').trigger('click')
    await settle()
    await wrapper.get('#mta-sts-active').setValue(false)
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(confirmState.value?.title).toBe('Deactivate the MTA-STS policy?')
    expect(confirmState.value?.description).toContain('up to its max age')
    settleConfirm(true)
    await settle(8)
    expect(writes().map((request) => request.body)).toEqual([{ active: false }])
    expect(wrapper.find('[data-policy-id-notice]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Inactive')
    wrapper.unmount()
  })

  it('sends nothing when a deactivation is not confirmed', async () => {
    const wrapper = await mountSection('example.org')
    await wrapper.get('button[aria-label="Edit MTA-STS"]').trigger('click')
    await settle()
    await wrapper.get('#mta-sts-active').setValue(false)
    await wrapper.get('form').trigger('submit')
    await settle()
    settleConfirm(false)
    await settle()
    expect(writes()).toEqual([])
    expect(wrapper.find('form').exists()).toBe(true)
    wrapper.unmount()
  })

  it('keeps the input after an outdated save and lists what changed meanwhile', async () => {
    const wrapper = await mountSection('example.org')
    await wrapper.get('button[aria-label="Edit MTA-STS"]').trigger('click')
    await settle()
    applyDnsOverrides(mockState(), { policies: { 'example.org': { maxAge: 86_400 } } })
    await wrapper.get('#mta-sts-mode').setValue('none')
    await wrapper.get('form').trigger('submit')
    await settle(8)
    const outdated = wrapper.get('[data-outdated]')
    expect(outdated.text()).toContain('Max age')
    expect(outdated.text()).toContain('86400')
    expect((wrapper.get('#mta-sts-mode').element as HTMLSelectElement).value).toBe('none')
    wrapper.unmount()
  })

  it('checks the max age and the MX hosts with the classic messages before sending', async () => {
    const wrapper = await mountSection('example.org')
    await wrapper.get('button[aria-label="Edit MTA-STS"]').trigger('click')
    await settle()
    await wrapper.get('#mta-sts-max-age').setValue('0')
    await wrapper.get('#mta-sts-mx').setValue('mail.example.org, mail..example')
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(wrapper.text()).toContain('Max age example.org is invalid')
    expect(wrapper.text()).toContain('MX record mail..example is invalid')
    expect(writes()).toEqual([])
    wrapper.unmount()
  })

  it('offers History to administrators only', async () => {
    const wrapper = await mountSection('example.org', 'reseller')
    expect(wrapper.text()).toContain('enforce')
    expect(wrapper.find('a[href^="/audit-log"]').exists()).toBe(false)
    expect(wrapper.find('button[aria-label="Edit MTA-STS"]').exists()).toBe(true)
    wrapper.unmount()
  })
})
