// The building blocks UI 006 relies on (T010, plan P01–P25 as the legacy form map changes them):
// each is imported where UI 001–004 put it, or where T011–T035 put it, and the behaviour this
// feature needs is checked. Names follow the conventions' canonical list. Differences found and
// settled (T011):
// - `useBulkSelection` has `keep(ids)` instead of `retain(results, keep)` and no `targets()`: the
//   feature keeps the failed, refused and outdated IDs and builds `{ id, version }` targets itself.
// - `AclReadOnlyNote` (P15) is promoted to `src/shared/components` (T012); `MailboxSearchPicker` is
//   already shared (UI 004/008), so the rate limit area does not keep its own copy.
// - `download.ts` (P25) already exists, created by UI 010 (`downloadText`); T029 adds `saveApiFile`.
// - P16–P19 are the host pages that render the sections of legacy form map D9.
// - P24 `FilterPanel` does not exist yet; the quarantine list creates it (T011, with its test).
import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'
import { h } from 'vue'

import { ApiProblem, reportSessionProblem, setSessionReactions, type Identity } from '@/api'
import { isEntryAvailable } from '@/app/navigation/visibility'
import { routeAccess } from '@/app/router/guards'
import AclReadOnlyNote from '@/shared/components/AclReadOnlyNote.vue'
import BulkActionBar from '@/shared/components/BulkActionBar.vue'
import BulkResultSummary from '@/shared/components/BulkResultSummary.vue'
import DomainPicker from '@/shared/components/DomainPicker.vue'
import EditableSection from '@/shared/components/EditableSection.vue'
import LegacyRateLimitField from '@/shared/components/LegacyRateLimitField.vue'
import LocaleNumberField from '@/shared/components/LocaleNumberField.vue'
import MailboxSearchPicker from '@/shared/components/MailboxSearchPicker.vue'
import PlainText from '@/shared/components/PlainText.vue'
import { useBulkSelection } from '@/shared/composables/useBulkSelection'
import { matchesTyped } from '@/shared/composables/useConfirm'
import { prefixed } from '@/shared/composables/useListState'
import { changedSince } from '@/shared/composables/useVersionedSave'
import { saveApiFile } from '@/shared/platform/download'
import { utf8ByteLength } from '@/shared/validation/utf8'

import { mountWithApp } from '../support/mount'

const who = (role: Identity['role']) => ({ role, permissions: {} }) as unknown as Identity

describe('P01 useListState', () => {
  it('names prefixed keys for two lists on one page', () => {
    expect(prefixed('allow')('q')).toBe('allowQ')
    expect(prefixed('block')('inheritedPage')).toBe('blockInheritedPage')
    expect(prefixed(undefined)('q')).toBe('q')
  })
})

describe('P03 useBulkSelection', () => {
  it('honours the bulk limit and keeps the given IDs after a run', () => {
    const selection = useBulkSelection({ limit: 2 })
    expect(selection.selectPage(['1', '2', '3']).cut).toBe(true)
    expect(selection.toggle('3')).toBe(false)
    selection.keep(['2'])
    expect([...selection.ids.value]).toEqual(['2'])
  })
})

describe('P04–P06 bulk bar, result summary and typed confirmation', () => {
  it('renders the bar with its actions and the summary with an item slot', async () => {
    const bar = mountWithApp(BulkActionBar, {
      props: { count: 2, actions: [{ id: 'delete', label: 'Remove' }] },
    })
    await bar.get('button').trigger('click')
    expect(bar.emitted('action')?.[0]).toEqual(['delete'])
    const summary = mountWithApp(BulkResultSummary, {
      props: { rows: [{ id: '1', label: 'Invoice', outcome: 'done' }] },
      slots: { item: () => h('span', { class: 'extra' }, 'warning') },
    })
    expect(summary.find('.extra').exists()).toBe(true)
    expect(matchesTyped('40', { accepted: ['40'], labelKey: 'bulk.confirm.typeCount' })).toBe(true)
  })
})

describe('P07 EditableSection and the changed values of an outdated save', () => {
  it('lists the fields changed elsewhere', () => {
    expect(
      changedSince({ junk: 80, reject: 150 }, { junk: 80, reject: 120 }, ['junk', 'reject']),
    ).toEqual([{ field: 'reject', savedValue: 120 }])
    const section = mountWithApp(EditableSection, {
      props: { sectionId: 'ratelimit', title: 'Rate limit', editable: true, editing: false },
    })
    expect(section.text()).toContain('Rate limit')
  })
})

describe('P09 route roles', () => {
  it('denies a route whose roles exclude the identity', () => {
    const route = { meta: { navEntry: 'quarantine' as const, roles: ['admin' as const] } }
    expect(routeAccess(route, who('admin'))).toBe('allowed')
    expect(routeAccess(route, who('domainAdmin'))).toBe('denied')
  })
})

describe('P11 shared text helpers', () => {
  it('counts UTF-8 bytes for the template limit', () => {
    expect(utf8ByteLength('ž')).toBe(2)
  })
})

describe('P12 problems and session reactions', () => {
  it('exposes extension members and refreshes the identity on flag refusals', () => {
    const forbidden = vi.fn()
    setSessionReactions({
      unauthenticated: vi.fn(),
      secondFactorRequired: vi.fn(),
      pendingActionRequired: vi.fn(),
      forbidden,
    })
    const problem = ApiProblem.fromParts({
      kind: 'problem',
      type: '/api/v2/problems/permission-flag-required',
      status: 403,
      extensions: { requiredFlags: ['quarantine'] },
    })
    expect(problem.extensions.requiredFlags).toEqual(['quarantine'])
    reportSessionProblem(problem)
    reportSessionProblem(
      ApiProblem.fromParts({
        kind: 'problem',
        type: '/api/v2/problems/attribute-not-permitted',
        status: 403,
      }),
    )
    expect(forbidden).toHaveBeenCalledTimes(2)
  })
})

describe('P14, P15, P25 and the 006 shared blocks', () => {
  it('are importable components and helpers', () => {
    for (const component of [
      DomainPicker,
      MailboxSearchPicker,
      AclReadOnlyNote,
      LegacyRateLimitField,
      LocaleNumberField,
      PlainText,
    ]) {
      expect(component).toBeTruthy()
    }
    expect(typeof saveApiFile).toBe('function')
    expect(typeof isEntryAvailable).toBe('function')
  })
})

describe('P16–P19 the host pages of the sections (legacy form map D9)', () => {
  it.each([
    'src/features/domains/pages/DomainDetailPage.vue',
    'src/features/domains/components/detail/sections/RateLimitSection.vue',
    'src/features/mailboxes/pages/MailboxDetailPage.vue',
    'src/features/mailboxes/components/sections/MailboxSection.vue',
    'src/features/mailboxes/components/sections/ManagedSections.vue',
    'src/features/mailboxes/components/list/MailboxBulkActions.vue',
    'src/features/alias-domains/pages/AliasDomainDetailPage.vue',
    'src/features/resources/pages/ResourceDetailPage.vue',
  ])('%s exists', (path) => {
    expect(existsSync(join(process.cwd(), path))).toBe(true)
  })
})
