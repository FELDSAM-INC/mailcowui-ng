// The rate limit section of the domain, alias domain and mailbox pages (T100 as the legacy form
// map settles it, D2, D9, D17): legacy's form on `EditableSection` with the version tag; an empty
// value and Save removes the limit; the range checked before sending; the frame from the
// capabilities; an invalid stored value; a mailbox's limit in effect and legacy's help; read-only
// without `ratelimit`; nothing for mailbox users; an outdated save; a shared store that is down;
// History for administrators.
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import RateLimitSection from '@/features/rate-limits/components/RateLimitSection.vue'

import { mockState, useScenario } from '../../../mocks/node'
import { mountWithApp } from '../../support/mount'

const Stub = defineComponent({ render: () => null })

function router() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: Stub },
      { path: '/audit-log', name: 'audit-log', component: Stub },
    ],
  })
}

async function settle(times = 6) {
  for (let index = 0; index < times; index += 1) await flushPromises()
}

const mounted: { unmount(): void }[] = []
afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
})

async function mountSection(
  scenario: string,
  kind: 'domain' | 'aliasDomain' | 'mailbox',
  object: string,
) {
  useScenario(scenario)
  const instance = router()
  await instance.push('/')
  const wrapper = mountWithApp(RateLimitSection, {
    props: { kind, object },
    global: { plugins: [instance] },
    attachTo: document.body,
  })
  mounted.push(wrapper)
  await settle()
  return wrapper
}

const writes = () =>
  mockState().requests.filter(
    (request) => request.path.includes('/rate-limit') && request.method !== 'GET',
  )

async function edit(wrapper: Awaited<ReturnType<typeof mountSection>>) {
  await wrapper.get('button[aria-label="Edit Rate limit"]').trigger('click')
  await settle(2)
}

async function submit(wrapper: Awaited<ReturnType<typeof mountSection>>) {
  await wrapper.get('form').trigger('submit')
  await settle(8)
}

describe('RateLimitSection', () => {
  it('shows a domain limit with legacy labels and sets a new one with the version tag', async () => {
    const wrapper = await mountSection('rate-limits-domain-admin', 'domain', 'example.org')
    expect(wrapper.find('#rate-limit').exists()).toBe(true)
    expect(wrapper.get('#rate-limit h2').text()).toBe('Rate limit')
    expect(wrapper.text()).toContain('100 msgs / hour')
    // History is for administrators only.
    expect(wrapper.find('a[href^="/audit-log"]').exists()).toBe(false)
    await edit(wrapper)
    const value = wrapper.get('#rate-limit-value')
    expect((value.element as HTMLInputElement).value).toBe('100')
    expect(value.attributes('placeholder')).toBe('Disabled')
    expect((wrapper.get('#rate-limit-frame').element as HTMLSelectElement).value).toBe('hour')
    expect(wrapper.get('legend').text()).toBe('Rate limit')
    expect(wrapper.get('button[type="submit"]').text()).toBe('Save changes')
    await value.setValue('200')
    await wrapper.get('#rate-limit-frame').setValue('day')
    await submit(wrapper)
    const [request] = writes()
    expect(request?.method).toBe('PUT')
    expect(request?.path).toBe('/api/v2/domains/example.org/rate-limit')
    expect(request?.body).toEqual({ value: 200, frame: 'day' })
    expect(request?.headers['if-match']).toMatch(/^"r/)
    expect(wrapper.text()).toContain('Rate limit for object example.org saved')
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.text()).toContain('200 msgs / day')
  })

  it('removes the limit with an empty value and Save, as legacy does (D2)', async () => {
    const wrapper = await mountSection('rate-limits-admin', 'mailbox', 'alice@example.org')
    expect(wrapper.text()).toContain('10 msgs / minute')
    expect(wrapper.text()).toContain('In effect: 10 msgs / minute (Mailbox)')
    await edit(wrapper)
    await wrapper.get('#rate-limit-value').setValue('')
    await submit(wrapper)
    const [request] = writes()
    expect(request?.method).toBe('DELETE')
    expect(decodeURIComponent(request?.path ?? '')).toBe(
      '/api/v2/mailboxes/alice@example.org/rate-limit',
    )
    expect(request?.headers['if-match']).toMatch(/^"r/)
    expect(wrapper.text()).toContain('Rate limit for object alice@example.org saved')
    await settle()
    expect(wrapper.text()).toContain('In effect: 100 msgs / hour (Domain)')
  })

  it("shows a mailbox's limit in effect from its domain and legacy's mailbox help", async () => {
    const wrapper = await mountSection('rate-limits-admin', 'mailbox', 'carol@example.org')
    const text = wrapper.text()
    expect(text).toContain('Disabled')
    expect(text).toContain('In effect: 100 msgs / hour (Domain)')
    expect(text).toContain('This rate limit is applied on the SASL login name')
    const history = wrapper.get('a[href^="/audit-log"]')
    expect(decodeURIComponent(history.attributes('href')!)).toBe(
      '/audit-log?targetType=rateLimit&targetId=carol@example.org',
    )
    await edit(wrapper)
    expect(wrapper.get('legend').text()).toBe('Rate limit')
    expect(wrapper.text()).toContain('This rate limit is applied on the SASL login name')
    expect(wrapper.get('button[type="submit"]').text()).toBe('Save changes')
  })

  it('says "In effect: Disabled" when neither the mailbox nor its domain has a limit', async () => {
    const wrapper = await mountSection('rate-limits-admin', 'mailbox', 'hank@shop.example')
    expect(wrapper.text()).toContain('In effect: Disabled')
  })

  it('checks the range before sending and sends nothing', async () => {
    const wrapper = await mountSection('rate-limits-admin', 'aliasDomain', 'example.net')
    expect(wrapper.get('#rate-limit h2').text()).toBe('Rate limit')
    expect(wrapper.text()).toContain('20 msgs / hour')
    await edit(wrapper)
    await wrapper.get('#rate-limit-value').setValue('0')
    await submit(wrapper)
    expect(writes()).toEqual([])
    expect(wrapper.get('#rate-limit-error').text()).toBe('Enter a value from 1 to 2,147,483,647.')
    expect(wrapper.get('#rate-limit-value').attributes('aria-invalid')).toBe('true')
    await wrapper.get('#rate-limit-value').setValue('12a')
    await submit(wrapper)
    expect(writes()).toEqual([])
    expect(wrapper.get('#rate-limit-error').text()).toBe('Value 12a is not numeric')
  })

  it('shows a stored value in an invalid format and replaces it', async () => {
    const wrapper = await mountSection('rate-limits-invalid-stored', 'domain', 'example.com')
    expect(wrapper.get('[data-invalid-stored]').text()).toBe(
      'The stored rate limit "100/hour" has an invalid format. Save a new value or empty the field.',
    )
    await edit(wrapper)
    expect((wrapper.get('#rate-limit-value').element as HTMLInputElement).value).toBe('')
    await wrapper.get('#rate-limit-value').setValue('100')
    await wrapper.get('#rate-limit-frame').setValue('hour')
    await submit(wrapper)
    expect(writes().map((request) => request.method)).toEqual(['PUT'])
    expect(wrapper.find('[data-invalid-stored]').exists()).toBe(false)
    expect(wrapper.text()).toContain('100 msgs / hour')
  })

  it('removes an invalid stored value with an empty value', async () => {
    const wrapper = await mountSection('rate-limits-invalid-stored', 'mailbox', 'dave@example.org')
    expect(wrapper.get('[data-invalid-stored]').text()).toContain('"lots / 1w"')
    await edit(wrapper)
    await submit(wrapper)
    expect(writes().map((request) => request.method)).toEqual(['DELETE'])
    expect(mockState().quarantine.invalidRateLimits).not.toHaveProperty('mailbox:dave@example.org')
  })

  it('saves an unchanged empty form without a request and reports it saved', async () => {
    const wrapper = await mountSection('rate-limits-admin', 'mailbox', 'carol@example.org')
    await edit(wrapper)
    await submit(wrapper)
    expect(writes()).toEqual([])
    expect(wrapper.text()).toContain('Rate limit for object carol@example.org saved')
  })

  it('is read-only with the ACL note for a domain administrator without the flag', async () => {
    const wrapper = await mountSection('rate-limits-domain-admin-no-flag', 'domain', 'example.org')
    expect(wrapper.text()).toContain('100 msgs / hour')
    expect(wrapper.find('button[aria-label="Edit Rate limit"]').exists()).toBe(false)
    const note = wrapper.get('[data-acl-note]')
    expect(note.text()).toContain('Prohibited by ACL')
    expect(note.text()).toContain('Rate limit')
  })

  it('is not offered to mailbox users', async () => {
    const wrapper = await mountSection('rate-limits-mailbox-user', 'mailbox', 'alice@example.org')
    expect(wrapper.find('#rate-limit').exists()).toBe(false)
    expect(mockState().requests.filter((request) => request.path.includes('/rate-limit'))).toEqual(
      [],
    )
  })

  it('keeps the input after an outdated save, marks the new value and saves again', async () => {
    const wrapper = await mountSection('rate-limits-admin', 'domain', 'example.org')
    await edit(wrapper)
    await wrapper.get('#rate-limit-value').setValue('300')
    // Changed elsewhere in the meantime.
    mockState().domains.find((domain) => domain.name === 'example.org')!.rateLimit = {
      value: 7,
      frame: 'second',
    }
    await submit(wrapper)
    expect(writes().map((request) => request.status)).toEqual([412])
    const outdated = wrapper.get('[data-outdated]')
    expect(outdated.text()).toContain('Rate limit: now saved as 7 msgs / second')
    expect((wrapper.get('#rate-limit-value').element as HTMLInputElement).value).toBe('300')
    await submit(wrapper)
    expect(writes().map((request) => request.status)).toEqual([412, 200])
    expect(wrapper.text()).toContain('300 msgs / hour')
  })

  it('discards the input after an outdated save on request', async () => {
    const wrapper = await mountSection('rate-limits-admin', 'domain', 'example.org')
    await edit(wrapper)
    await wrapper.get('#rate-limit-value').setValue('')
    mockState().domains.find((domain) => domain.name === 'example.org')!.rateLimit = {
      value: 7,
      frame: 'second',
    }
    await submit(wrapper)
    expect(writes().map((request) => [request.method, request.status])).toEqual([['DELETE', 412]])
    const discard = wrapper
      .findAll('button')
      .find((button) => button.text() === 'Discard my changes')
    await discard!.trigger('click')
    await settle()
    expect((wrapper.get('#rate-limit-value').element as HTMLInputElement).value).toBe('7')
    expect((wrapper.get('#rate-limit-frame').element as HTMLSelectElement).value).toBe('second')
  })

  it('says nothing changed when the shared store is down, and retries with the input kept', async () => {
    const wrapper = await mountSection('rate-limits-admin', 'aliasDomain', 'example.net')
    mockState().failures.setAliasDomainRateLimit = {
      status: 503,
      type: 'temporary-failure',
      extra: { dependency: 'sharedStore' },
      times: 1,
    }
    await edit(wrapper)
    await wrapper.get('#rate-limit-value').setValue('25')
    await submit(wrapper)
    expect(wrapper.text()).toContain('Nothing was changed')
    expect((wrapper.get('#rate-limit-value').element as HTMLInputElement).value).toBe('25')
    const retry = wrapper.findAll('button').find((button) => button.text() === 'Try again')
    await retry!.trigger('click')
    await settle(8)
    expect(writes().map((request) => request.status)).toEqual([503, 200])
    expect(wrapper.text()).toContain('Rate limit for object example.net saved')
  })

  it('shows the frame refusal of the server with the legacy message', async () => {
    const wrapper = await mountSection('rate-limits-admin', 'domain', 'example.org')
    mockState().quarantine.capabilities.rateLimit.frames = ['hour', 'day']
    await edit(wrapper)
    // The capabilities were read before the change: the client offers "second".
    await wrapper.get('#rate-limit-frame').setValue('second')
    await submit(wrapper)
    expect(writes().map((request) => request.status)).toEqual([422])
    expect(wrapper.text()).toContain('Rate limit time frame is incorrect')
  })
})
