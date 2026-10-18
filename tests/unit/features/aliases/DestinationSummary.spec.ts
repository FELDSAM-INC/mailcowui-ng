// The goto address of an alias (T033, FR-012, FR-063): the first two plus "+N more", all of them
// on the alias page, and the special actions as legacy's texts.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import DestinationSummary from '@/features/aliases/components/DestinationSummary.vue'
import { loadLegacy, resetLegacy } from '@/i18n/legacy'

import { mountWithApp } from '../../support/mount'
import { alias } from './alias-fixture'

beforeEach(async () => {
  await loadLegacy('en-gb')
})
afterEach(() => resetLegacy())

const twelve = Array.from({ length: 12 }, (_, index) => `user${index + 1}@example.org`)

describe('DestinationSummary', () => {
  it('shows the first two and the number of the others, or all of them', () => {
    const many = alias({ destinations: twelve, destinationsUnicode: twelve })
    const short = mountWithApp(DestinationSummary, { props: { alias: many } })
    expect(short.findAll('li').map((item) => item.text())).toEqual([
      'user1@example.org',
      'user2@example.org',
      '+10 more',
    ])
    const full = mountWithApp(DestinationSummary, { props: { alias: many, full: true } })
    expect(full.findAll('li')).toHaveLength(12)
  })

  it('shows the readable form of destinations', () => {
    const idn = alias({
      destinations: ['info@xn--bcher-kva.example'],
      destinationsUnicode: ['info@bücher.example'],
    })
    expect(mountWithApp(DestinationSummary, { props: { alias: idn } }).text()).toBe(
      'info@bücher.example',
    )
  })

  it.each([
    ['discard', 'Silently discard mail'],
    ['learnSpam', 'Learn as spam'],
    ['learnHam', 'Learn as ham'],
  ] as const)('shows the special action %s as text', (destinationType, text) => {
    const special = alias({ destinationType, destinations: [], destinationsUnicode: [] })
    const wrapper = mountWithApp(DestinationSummary, { props: { alias: special } })
    expect(wrapper.get('[data-special-action]').text()).toBe(text)
  })
})
