import { describe, expect, it } from 'vitest'

import { ApiProblem } from '@/api'
import ListState from '@/shared/components/ListState.vue'

import { mountWithApp } from '../../support/mount'

describe('list presentation shared by paged collections', () => {
  it('preserves the original problem, named empty slot and ready defaults when failed is omitted', async () => {
    const wrapper = mountWithApp(ListState, {
      props: {
        loading: false,
        empty: false,
        problem: ApiProblem.fromParts({ kind: 'network' }),
      },
      slots: { empty: '<p id="legacy-empty">Nothing yet</p>', default: '<ul id="rows" />' },
    })
    expect(wrapper.findAll('[role="alert"]')[0]?.text()).toBe('The list could not be loaded.')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
    expect(wrapper.find('#rows').exists()).toBe(false)

    await wrapper.setProps({ problem: null, empty: true })
    expect(wrapper.get('.py-8.text-center #legacy-empty').text()).toBe('Nothing yet')
    expect(wrapper.find('#rows').exists()).toBe(false)

    await wrapper.setProps({ empty: false })
    expect(wrapper.find('#legacy-empty').exists()).toBe(false)
    expect(wrapper.find('#rows').exists()).toBe(true)
    wrapper.unmount()
  })

  it('keeps the requested skeleton size and hides actions until the initial load finishes', () => {
    const wrapper = mountWithApp(ListState, {
      props: { loading: true, empty: false, problem: null, skeleton: 40 },
      slots: { 'before-content': '<p id="bulk">Bulk result</p>', default: '<ul id="rows" />' },
    })
    expect(wrapper.get('[data-list-loading]').attributes('aria-busy')).toBe('true')
    expect(wrapper.findAll('[aria-hidden="true"].h-40')).toHaveLength(3)
    expect(wrapper.text()).toContain('Loading...')
    expect(wrapper.find('#bulk').exists()).toBe(false)
    expect(wrapper.find('#rows').exists()).toBe(false)
  })

  it('retains rows and feature notices during a failed refresh, in their original order', () => {
    const wrapper = mountWithApp(ListState, {
      props: {
        loading: false,
        failed: false,
        empty: false,
        problem: ApiProblem.fromParts({ kind: 'network' }),
        refreshFailed: true,
        refreshText: 'Existing rows may be outdated.',
      },
      slots: {
        'before-refresh': '<p>Saved</p>',
        'before-content': '<p>Bulk result</p>',
        default: '<ul id="rows"><li>Existing row</li></ul>',
      },
    })
    expect(wrapper.get('[role="alert"]').text()).toBe('Existing rows may be outdated.')
    expect(wrapper.text()).toBe('SavedExisting rows may be outdated.Bulk resultExisting row')
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('distinguishes no matches from an empty collection and preserves the appropriate actions', async () => {
    const wrapper = mountWithApp(ListState, {
      props: {
        loading: false,
        empty: true,
        problem: null,
        noMatches: true,
        emptyLayout: 'actions',
        clearLabel: 'Clear search',
        noMatchesAttrs: { 'data-empty': 'noMatch' },
        emptyAttrs: { 'data-empty': 'none' },
      },
      slots: {
        'empty-actions': '<a href="/create">Add</a>',
        'before-content': '<p>Bulk result</p>',
      },
    })
    expect(wrapper.get('[data-empty="noMatch"]').text()).toContain('No matching records found')
    expect(wrapper.find('a').exists()).toBe(false)
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('clear')).toHaveLength(1)

    await wrapper.setProps({ noMatches: false })
    expect(wrapper.get('[data-empty="none"]').text()).toContain('No data available in table')
    expect(wrapper.get('a').text()).toBe('Add')
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.text()).toContain('Bulk result')
  })

  it('allows a custom loading state and error text with a separate retry for unavailable services', async () => {
    const wrapper = mountWithApp(ListState, {
      props: {
        loading: true,
        empty: false,
        problem: null,
        failed: true,
        errorText: 'Service unavailable',
        errorAttrs: { 'data-service-error': '' },
        retryPlacement: 'separate',
      },
      slots: { loading: '<p role="status" data-custom-loading>Waiting</p>' },
    })
    expect(wrapper.get('[data-custom-loading]').text()).toBe('Waiting')
    await wrapper.setProps({ loading: false })
    expect(wrapper.get('[data-service-error] [role="alert"]').text()).toBe('Service unavailable')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })
})
