import { expect, it } from 'vitest'
import { mountWithApp } from '../../support/mount'
import { loadFeatureMessages } from '@/i18n'
import MapChangeReview from '@/features/system-settings/components/spam/MapChangeReview.vue'
it('shows bidi controls as markers and renders large reviews in explicit batches', async () => {
  await loadFeatureMessages('system-settings')
  const added = ['/x\u202ey/i', ...Array.from({ length: 205 }, (_, index) => `/line-${index}/`)]
  const wrapper = mountWithApp(MapChangeReview, { props: { added, removed: ['/old/'] } })
  expect(wrapper.find('[data-marker]').text()).toContain('U+202E')
  expect(wrapper.findAll('li')).toHaveLength(101)
  await wrapper.get('button').trigger('click')
  expect(wrapper.findAll('li')).toHaveLength(201)
})
