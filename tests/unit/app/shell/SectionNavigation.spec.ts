import { flushPromises } from '@vue/test-utils'
import { expect, it } from 'vitest'
import SectionNavigation from '@/shared/components/SectionNavigation.vue'
import { mountWithApp } from '../../support/mount'
import { createTestRouter } from '../../support/router'

it('exposes section links directly, marks the current page and disables roadmap tabs', async () => {
  const router = createTestRouter()
  await router.push('/domains')
  const wrapper = mountWithApp(SectionNavigation, {
    props: {
      label: 'Section navigation',
      items: [
        { id: 'domains', labelKey: 'nav.domains', to: '/domains', current: true },
        { id: 'templates', labelKey: 'nav.domainTemplates', to: '/domain-templates' },
        { id: 'future', labelKey: 'nav.system', disabled: true },
      ],
    },
    global: { plugins: [router] },
  })
  expect(wrapper.get('a[aria-current="page"]').attributes('href')).toBe('/ng/domains')
  expect(wrapper.find('button').exists()).toBe(false)
  expect(wrapper.findAll('a')).toHaveLength(2)
  expect(wrapper.get('[aria-disabled="true"]').attributes('href')).toBeUndefined()
  await wrapper.get('a[href="/ng/domain-templates"]').trigger('click')
  await flushPromises()
  expect(router.currentRoute.value.path).toBe('/domain-templates')
  wrapper.unmount()
})
