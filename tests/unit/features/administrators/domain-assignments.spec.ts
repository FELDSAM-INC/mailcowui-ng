import { beforeAll, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import DomainAssignmentList from '@/features/administrators/components/DomainAssignmentList.vue'
import { loadLegacy } from '@/i18n/legacy'
import { assignment } from '../../../mocks/factories/domain-admin'
import { mountWithApp } from '../../support/mount'

beforeAll(() => loadLegacy('en-gb'))

function render(assignments: ReturnType<typeof assignment>[], limit = Infinity) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/domains/:domain', name: 'domain-detail', component: { template: '<div />' } },
    ],
  })
  return mountWithApp(DomainAssignmentList, {
    props: { assignments, accountActive: true, limit },
    global: { plugins: [router] },
  })
}

it('links Unicode labels to the ASCII domain and shows only a differing assignment status', () => {
  const wrapper = render([
    assignment('xn--bcher-kva.example', { domainUnicode: 'bücher.example', active: false }),
    assignment('example.org'),
  ])
  const link = wrapper.get('a')
  expect(link.text()).toBe('bücher.example')
  expect(link.attributes('title')).toBe('xn--bcher-kva.example')
  expect(link.attributes('href')).toBe('/domains/xn--bcher-kva.example')
  expect(wrapper.findAll('li')[0]!.text()).toContain('Inactive')
  expect(wrapper.findAll('li')[1]!.text()).toBe('example.org')
})

it('explains missing and catch-all assignments without creating broken domain links', () => {
  const wrapper = render([
    assignment('gone.example', { domainExists: false }),
    assignment('ALL', { domainExists: false }),
  ])
  expect(wrapper.findAll('a')).toHaveLength(0)
  expect(wrapper.findAll('li')[0]!.text()).toContain('This assigned domain no longer exists.')
  expect(wrapper.findAll('li')[1]!.text()).toContain('This is a non-domain assignment')
})

it('explains an empty assignment and limits card previews to their requested count', () => {
  expect(render([]).text()).toBe('No domains are assigned.')
  const wrapper = render(
    ['a.example', 'b.example', 'c.example', 'd.example'].map((name) => assignment(name)),
    3,
  )
  expect(wrapper.findAll('a')).toHaveLength(3)
  expect(wrapper.text()).toContain('+1 more')
  expect(wrapper.text()).not.toContain('d.example')
})
