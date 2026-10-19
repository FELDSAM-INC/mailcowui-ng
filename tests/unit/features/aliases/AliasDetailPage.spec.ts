// The alias page (US1 FR-016, US3; FR-022 to FR-028; `templates/edit/alias.twig`): legacy's
// heading with the address, the ID, the domain linked to its screen (an alias domain's or a
// domain's), the target domain of an alias in an alias domain, the badges and the orphaned warning,
// the creation's message, the "Edit alias" section opened by `?edit=alias` with the client checks,
// only the changed members saved and legacy's messages, the marks after a 412, the refused external
// entry, the return to the list when the alias vanishes, History for administrators, "not found"
// and the load error.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { setAliasFlash, takeAliasListFlash } from '@/features/aliases/flash'
import AliasDetailPage from '@/features/aliases/pages/AliasDetailPage.vue'
import { confirmState, settleConfirm } from '@/shared/composables/useConfirm'

import { mockState, useScenario } from '../../../mocks/node'
import { applyOverrides, type ScenarioOverrides } from '../../../mocks/scenarios'
import { ALIAS_004 } from '../../../mocks/scenarios/feature-004-base'
import { testPlugins } from '../../support/mount'
import { mountPage } from '../aliases-common/page-support'

const SALES = ALIAS_004.sales

async function mountDetail(
  path = `/aliases/${SALES}`,
  options: { scenario?: string; overrides?: ScenarioOverrides; wide?: boolean } = {},
) {
  useScenario(options.scenario ?? 'aliases-edit', options.overrides)
  const mounted = await mountPage(AliasDetailPage, 'alias-detail', path, { wide: options.wide })
  await vi.waitFor(() => expect(mounted.wrapper.find('[data-page-loading]').exists()).toBe(false))
  await flushPromises()
  return mounted
}

type Wrapper = Awaited<ReturnType<typeof mountDetail>>['wrapper']

const requests = (operationId: string) =>
  mockState().requests.filter((request) => request.operationId === operationId)

const button = (wrapper: Wrapper, text: string) =>
  wrapper.findAll('button').find((candidate) => candidate.text() === text)

const summary = (wrapper: Wrapper) => wrapper.get('[data-alias-summary]')

async function save(wrapper: Wrapper) {
  await wrapper.get('#section-alias form').trigger('submit')
  await flushPromises()
  await vi.waitFor(() => expect(wrapper.text()).not.toContain('Saving…'))
  await flushPromises()
}

const errorOf = (wrapper: Wrapper, id: string) => wrapper.get(`#${id}-error`).text()

describe('AliasDetailPage: reading', () => {
  it("shows legacy's heading, the ID, the linked domain and History for administrators", async () => {
    const { wrapper } = await mountDetail()
    expect(wrapper.get('h1').text()).toBe('Edit alias')
    expect(wrapper.text()).toContain('sales@example.org')
    expect(summary(wrapper).text()).toContain(String(SALES))
    expect(summary(wrapper).get('[data-field="domain"] a').attributes('href')).toBe(
      '/ng/domains/example.org',
    )
    expect(summary(wrapper).find('[data-field="primaryDomain"]').exists()).toBe(false)
    expect(wrapper.findAll('a').some((link) => link.text() === 'History')).toBe(true)
  })

  it('links an alias of an alias domain to the alias domain and names its target domain', async () => {
    const { wrapper } = await mountDetail(`/aliases/${ALIAS_004.infoNet}`)
    expect(summary(wrapper).get('[data-field="domain"] a').attributes('href')).toBe(
      '/ng/alias-domains/example.net',
    )
    expect(summary(wrapper).get('[data-field="primaryDomain"] a').attributes('href')).toBe(
      '/ng/domains/example.org',
    )
  })

  it('shows a catch-all with its badge', async () => {
    const { wrapper } = await mountDetail(`/aliases/${ALIAS_004.catchAll}`)
    expect(summary(wrapper).find('[data-badge="catchAll"]').exists()).toBe(true)
  })

  it('warns an administrator about an orphaned alias and shows its domain without a link', async () => {
    const { wrapper } = await mountDetail(`/aliases/${ALIAS_004.orphaned}`)
    expect(wrapper.find('[data-orphaned-warning]').exists()).toBe(true)
    expect(summary(wrapper).find('[data-badge="orphaned"]').exists()).toBe(true)
    expect(summary(wrapper).find('[data-field="domain"] a').exists()).toBe(false)
    expect(summary(wrapper).get('[data-field="domain"]').text()).toBe('gone.example')
  })

  it('shows no History to a domain administrator, and "not found" outside the scope', async () => {
    const { wrapper } = await mountDetail(`/aliases/${SALES}`, { scenario: 'aliases-edit-da' })
    expect(wrapper.findAll('a').some((link) => link.text() === 'History')).toBe(false)
    const outside = await mountDetail(`/aliases/${ALIAS_004.contact}`, {
      scenario: 'aliases-edit-da',
    })
    await vi.waitFor(() => expect(outside.wrapper.text()).toContain('Page not found'))
    expect(outside.wrapper.text()).toContain('Back to the list')
  })

  it("shows the creation's message once, and dismisses it", async () => {
    setAliasFlash(SALES, `Alias address sales@example.org (${SALES}) has been added`)
    const { wrapper } = await mountDetail()
    expect(wrapper.get('[data-alert]').text()).toContain('has been added')
    await wrapper.get('[data-alert] button').trigger('click')
    expect(wrapper.find('[data-alert]').exists()).toBe(false)
  })

  it('drops an unknown section from the address and keeps its hash', async () => {
    const { router } = await mountDetail(`/aliases/${SALES}?edit=general#top`)
    await vi.waitFor(() => expect(router.currentRoute.value.query.edit).toBeUndefined())
    expect(router.currentRoute.value.hash).toBe('#top')
  })

  it('says the alias could not be loaded and retries', async () => {
    const { wrapper } = await mountDetail(`/aliases/${SALES}`, {
      overrides: { failures: { getAlias: { status: 500, times: 1 } } },
    })
    await vi.waitFor(() => expect(wrapper.text()).toContain('This item could not be loaded.'))
    await button(wrapper, 'Try again')!.trigger('click')
    await vi.waitFor(() => expect(wrapper.find('#section-alias').exists()).toBe(true))
  })

  it('returns to the list with a message when the alias vanishes on a refresh', async () => {
    const { router } = await mountDetail()
    applyOverrides(mockState(), { deleteElsewhere: { alias: [SALES] } })
    await testPlugins().queryClient.invalidateQueries({ queryKey: ['aliases'] })
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('aliases'))
    expect(takeAliasListFlash()).toEqual({
      kind: 'danger',
      message: 'This alias no longer exists or is no longer available to you.',
    })
  })
})

describe('AliasDetailPage: editing', () => {
  it("opens the section, saves only the changed goto addresses and says legacy's message", async () => {
    const { wrapper, router } = await mountDetail()
    await wrapper.get('#section-alias button').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.query.edit).toBe('alias'))
    await wrapper.get('#alias-edit-goto').setValue('anna@example.org, carol@example.org')
    await save(wrapper)
    const patch = requests('updateAlias')[0]!
    expect(patch.body).toEqual({
      destinationType: 'addresses',
      destinations: ['anna@example.org', 'carol@example.org'],
    })
    expect(patch.headers['if-match']).toBeTruthy()
    await vi.waitFor(() =>
      expect(wrapper.text()).toContain(
        'Changes to alias address sales@example.org have been saved',
      ),
    )
    await vi.waitFor(() => expect(router.currentRoute.value.query.edit).toBeUndefined())
  })

  it("names an emptied address and goto list with legacy's messages, without sending anything", async () => {
    const { wrapper } = await mountDetail(`/aliases/${SALES}?edit=alias`)
    await wrapper.get('#alias-edit-address').setValue(' ')
    await wrapper.get('#alias-edit-goto').setValue('')
    await save(wrapper)
    expect(requests('updateAlias')).toHaveLength(0)
    expect(errorOf(wrapper, 'alias-edit-address')).toContain('Alias address must not be empty')
    expect(errorOf(wrapper, 'alias-edit-goto')).toContain(
      'An alias address must contain at least one valid goto address',
    )
  })

  it("checks the goto list against the server's length limit", async () => {
    const { wrapper } = await mountDetail(`/aliases/${SALES}?edit=alias`, {
      overrides: { capabilities004: { destinationsMaxLength: 20 } },
    })
    await wrapper.get('#alias-edit-goto').setValue('anna@example.org, bob@example.org')
    await save(wrapper)
    expect(requests('updateAlias')).toHaveLength(0)
    expect(errorOf(wrapper, 'alias-edit-goto')).toContain('Enter at most 20 characters.')
  })

  it("shows an address in use with legacy's message at the address", async () => {
    const { wrapper } = await mountDetail(`/aliases/${SALES}?edit=alias`)
    await wrapper.get('#alias-edit-address').setValue('info@example.org')
    await save(wrapper)
    expect(requests('updateAlias')[0]!.status).toBe(409)
    expect(errorOf(wrapper, 'alias-edit-address')).toContain(
      'info@example.org is already known as an alias',
    )
  })

  it('names the external goto address a domain administrator may not add', async () => {
    const { wrapper } = await mountDetail(`/aliases/${SALES}?edit=alias`, {
      scenario: 'aliases-edit-da',
    })
    await wrapper.get('#alias-edit-goto').setValue('anna@example.org, new@partner.example')
    await save(wrapper)
    expect(requests('updateAlias')[0]!.status).toBe(403)
    expect(wrapper.text()).toContain('External goto address new@partner.example is not allowed')
  })

  it('lists every value changed elsewhere after a 412, keeps the input and saves again', async () => {
    const { wrapper } = await mountDetail(`/aliases/${SALES}?edit=alias`)
    applyOverrides(mockState(), {
      changeElsewhere: {
        alias: {
          [String(SALES)]: {
            destinationType: 'discard',
            destinations: [],
            internal: true,
            senderAllowed: false,
            groupwareVisible: false,
            privateComment: 'Kept for the auditors',
            publicComment: 'Sales team',
            active: false,
          },
        },
      },
    })
    await wrapper.get('#alias-edit-privateComment').setValue('Mine')
    await save(wrapper)
    const outdated = wrapper.get('[data-outdated]').text()
    expect(outdated).toContain('Goto address: now saved as Silently discard mail')
    expect(outdated).toContain('Internal: now saved as Yes')
    expect(outdated).toContain('Allow to send as this alias: now saved as No')
    expect(outdated).toContain('Public comment: now saved as Sales team')
    expect(outdated).toContain('Active: now saved as No')
    expect(wrapper.get<HTMLTextAreaElement>('#alias-edit-privateComment').element.value).toBe(
      'Mine',
    )
    await save(wrapper)
    const patches = requests('updateAlias')
    expect(patches.map((request) => request.status)).toEqual([412, 200])
    expect(patches[1]!.body).toEqual({ privateComment: 'Mine' })
  })

  it('discards the input for the values saved elsewhere after a 412', async () => {
    const { wrapper } = await mountDetail(`/aliases/${SALES}?edit=alias`)
    applyOverrides(mockState(), {
      changeElsewhere: { alias: { [String(SALES)]: { destinations: ['bob@example.org'] } } },
    })
    await wrapper.get('#alias-edit-goto').setValue('carol@example.org')
    await save(wrapper)
    expect(wrapper.get('[data-outdated]').text()).toContain(
      'Goto address: now saved as bob@example.org',
    )
    await button(wrapper, 'Discard my changes')!.trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-outdated]').exists()).toBe(false)
    expect(wrapper.get<HTMLTextAreaElement>('#alias-edit-goto').element.value).toBe(
      'bob@example.org',
    )
  })

  it('returns to the list when the alias vanished before the save', async () => {
    const { wrapper, router } = await mountDetail(`/aliases/${SALES}?edit=alias`)
    applyOverrides(mockState(), { deleteElsewhere: { alias: [SALES] } })
    await wrapper.get('#alias-edit-active').setValue(false)
    await save(wrapper)
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('aliases'))
    expect(takeAliasListFlash()?.kind).toBe('danger')
  })

  it('asks before closing the section with changes, and stays when asked to', async () => {
    const { wrapper, router } = await mountDetail(`/aliases/${SALES}?edit=alias`)
    await wrapper.get('#alias-edit-active').setValue(false)
    await button(wrapper, 'Cancel')!.trigger('click')
    await vi.waitFor(() => expect(confirmState.value?.title).toBe('Leave without saving?'))
    settleConfirm(false)
    await flushPromises()
    expect(router.currentRoute.value.query.edit).toBe('alias')
    expect(requests('updateAlias')).toHaveLength(0)
  })

  it('gives the open section the whole screen below md', async () => {
    const { wrapper } = await mountDetail(`/aliases/${SALES}?edit=alias`, { wide: false })
    expect(wrapper.find('#section-alias form').exists()).toBe(true)
    expect(wrapper.find('h1').exists()).toBe(false)
    expect(wrapper.find('[data-alias-summary]').exists()).toBe(false)
  })
})
