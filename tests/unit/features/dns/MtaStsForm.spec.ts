// The MTA-STS form (T068 as settled: the classic `#dmtasts` form): version, mode, max age, MX
// server and active in legacy order with legacy's labels and help texts, the HTML help shown whole,
// the input attributes, the used length of the MX hosts from 90 %, and the field errors.
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'

import MtaStsForm from '@/features/dns/components/MtaStsForm.vue'
import type { MtaStsFormValues } from '@/features/dns/mta-sts/policy-change'

import { mountWithApp } from '../../support/mount'
import { dnsCapabilities } from './fixtures'

function mountForm(values: Partial<MtaStsFormValues> = {}, props: Record<string, unknown> = {}) {
  const model = ref<MtaStsFormValues>({
    version: 'STSv1',
    mode: 'enforce',
    maxAge: '',
    mx: 'mail.example.org',
    active: false,
    ...values,
  })
  const wrapper = mountWithApp(MtaStsForm, {
    props: {
      modelValue: model.value,
      'onUpdate:modelValue': (value: MtaStsFormValues) => (model.value = value),
      domain: 'example.net',
      caps: dnsCapabilities(),
      creating: true,
      errorsFor: () => [],
      ...props,
    },
  })
  return { wrapper, model }
}

describe('MtaStsForm', () => {
  it('has the classic fields, labels, help texts and options in legacy order', () => {
    const { wrapper } = mountForm()
    const labels = wrapper.findAll('label').map((label) => label.text())
    expect(labels.slice(0, 4)).toEqual(['Version', 'Mode', 'Max age', 'MX server'])
    expect(labels).toContain('Active')
    expect(
      wrapper
        .get('#mta-sts-version')
        .findAll('option')
        .map((o) => o.text()),
    ).toEqual(['STSv1'])
    expect(
      wrapper
        .get('#mta-sts-mode')
        .findAll('option')
        .map((o) => o.text()),
    ).toEqual(['enforce', 'testing', 'none'])
    expect(wrapper.text()).toContain('Time in seconds')
    expect(wrapper.text()).toContain('Multiple MX servers can be specified (separated by commas).')
    expect(wrapper.text()).toContain('If unchecked, the MTA-STS policy will not be published')
    expect(wrapper.find('ul li em').text()).toBe('testing')
    expect(wrapper.find('code').text()).toBe('STSv1')
  })

  it('gives the inputs the attributes of FR-081', () => {
    const { wrapper } = mountForm()
    const mx = wrapper.get('#mta-sts-mx')
    expect(mx.element.tagName).toBe('TEXTAREA')
    expect(mx.attributes()).toMatchObject({
      autocapitalize: 'none',
      autocorrect: 'off',
      spellcheck: 'false',
    })
    expect(wrapper.get('#mta-sts-max-age').attributes('inputmode')).toBe('numeric')
  })

  it('shows the certificate notice next to the set-up form only', () => {
    expect(mountForm().wrapper.text()).toContain('certificate for mta-sts.example.net')
    expect(mountForm({}, { creating: false }).wrapper.text()).not.toContain(
      'certificate for mta-sts.example.net',
    )
  })

  it('updates the model and shows the used length from 90 % of the limit', async () => {
    const { wrapper, model } = mountForm()
    await wrapper.get('#mta-sts-mode').setValue('testing')
    expect(model.value.mode).toBe('testing')
    await wrapper.get('#mta-sts-active').setValue(true)
    expect(model.value.active).toBe(true)
    expect(wrapper.text()).not.toContain('characters')
    const hosts = Array.from(
      { length: 16 },
      (_, i) => `mx${String(i).padStart(2, '0')}.example.org`,
    )
    await wrapper.get('#mta-sts-mx').setValue(hosts.join(','))
    expect(model.value.mx).toBe(hosts.join(','))
    expect(wrapper.text()).toMatch(/\d+ of 255 characters/)
  })

  it('shows the errors of each field', () => {
    const { wrapper } = mountForm(
      {},
      { errorsFor: (path: string) => (path === 'mxHosts' ? ['MX record a..b is invalid'] : []) },
    )
    expect(wrapper.get('#mta-sts-mx').attributes('aria-invalid')).toBe('true')
    expect(wrapper.text()).toContain('MX record a..b is invalid')
  })
})
