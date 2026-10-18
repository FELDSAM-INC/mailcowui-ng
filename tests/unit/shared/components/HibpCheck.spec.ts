// The haveibeenpwned check (docs/conventions.md, constitution 1.4.0, UI 003): it runs only on
// "Check against haveibeenpwned.com", sends only the first five hex characters of the password's
// SHA-1 to api.pwnedpasswords.com, compares the rest in the browser and shows legacy's answers.
import { flushPromises } from '@vue/test-utils'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import HibpCheck from '@/shared/components/HibpCheck.vue'

import { server } from '../../../mocks/node'
import { mountWithApp } from '../../support/mount'

// SHA-1("password") = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
const PREFIX = '5BAA6'
const SUFFIX = '1E4C9B93F3F0682250B6CF8331B7EE68FD8'

function answer(body: string, status = 200) {
  const seen: { url: string }[] = []
  server.use(
    http.get('https://api.pwnedpasswords.com/range/:prefix', ({ request }) => {
      seen.push({ url: request.url })
      return new HttpResponse(body, { status, headers: { 'Content-Type': 'text/plain' } })
    }),
  )
  return seen
}

describe('HibpCheck', () => {
  it('sends nothing until the check is clicked, then only the SHA-1 prefix', async () => {
    const seen = answer(`0018A45C4D1DEF81644B54AB7F969B88D65:1\r\n${SUFFIX}:3861493`)
    const wrapper = mountWithApp(HibpCheck, { props: { password: 'password' } })
    await flushPromises()
    expect(seen).toHaveLength(0)
    const button = wrapper.get('button')
    expect(button.text()).toBe('Check against haveibeenpwned.com')
    await button.trigger('click')
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 20))
    await flushPromises()
    expect(seen.map((item) => item.url)).toEqual([`https://api.pwnedpasswords.com/range/${PREFIX}`])
    expect(wrapper.text()).toContain('Matched! This is a potentially dangerous password!')
  })

  it('says no match was found when the suffix is not listed', async () => {
    answer('0018A45C4D1DEF81644B54AB7F969B88D65:1')
    const wrapper = mountWithApp(HibpCheck, { props: { password: 'password' } })
    await wrapper.get('button').trigger('click')
    await new Promise((resolve) => setTimeout(resolve, 20))
    await flushPromises()
    expect(wrapper.get('[role="status"]').text()).toBe('No match found.')
  })

  it('reports an error of the service, and asks for a password first when the field is empty', async () => {
    answer('down', 503)
    const wrapper = mountWithApp(HibpCheck, { props: { password: '' } })
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('empty')).toHaveLength(1)
    await wrapper.setProps({ password: 'password' })
    await wrapper.get('button').trigger('click')
    await new Promise((resolve) => setTimeout(resolve, 20))
    await flushPromises()
    expect(wrapper.get('[role="status"]').text()).toBe('API error')
  })

  it('forgets the result when the password changes, as legacy does on input', async () => {
    answer(`${SUFFIX}:1`)
    const wrapper = mountWithApp(HibpCheck, { props: { password: 'password' } })
    await wrapper.get('button').trigger('click')
    await new Promise((resolve) => setTimeout(resolve, 20))
    await flushPromises()
    expect(wrapper.get('[role="status"]').text()).not.toBe('')
    await wrapper.setProps({ password: 'password2' })
    expect(wrapper.get('[role="status"]').text()).toBe('')
  })
})
