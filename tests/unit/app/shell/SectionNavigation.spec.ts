import { flushPromises } from '@vue/test-utils'
import { expect, it } from 'vitest'
import SectionNavigation from '@/shared/components/SectionNavigation.vue'
import { mountWithApp } from '../../support/mount'
import { createTestRouter } from '../../support/router'

it('uses the Routing disclosure style with the selected tab and disables roadmap tabs', async () => {
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
  expect(wrapper.get('ul').classes()).toContain('hidden')
  await wrapper.get('button').trigger('click')
  expect(wrapper.get('ul').classes()).toContain('flex')
  expect(wrapper.get('[aria-disabled="true"]').attributes('href')).toBeUndefined()
  await wrapper.get('a[href="/ng/domain-templates"]').trigger('click')
  await flushPromises()
  expect(wrapper.get('button').attributes('aria-expanded')).toBe('false')
  wrapper.unmount()
})
