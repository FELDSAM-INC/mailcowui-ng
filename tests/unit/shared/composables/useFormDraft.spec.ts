// The in-memory draft registry (T023, UI 004 data-model §4, research R10): a form's input survives
// a session expiry in the same tab, for the same account only, and never reaches device storage.
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'

import {
  clearAllDrafts,
  draftCount,
  markSessionEnded,
  setDraftOwner,
  useFormDraft,
} from '@/shared/composables/useFormDraft'

const Form = defineComponent({
  props: { initial: { type: String, default: '' } },
  setup(props, { expose }) {
    const text = ref(props.initial)
    const draft = useFormDraft('alias-create', {
      capture: () => ({ text: text.value }),
      restore: (value: { text: string }) => {
        text.value = value.text
      },
      dirty: () => text.value !== '',
    })
    expose({ text, draft })
    return () =>
      h('textarea', {
        value: text.value,
        onInput: (event: Event) => {
          text.value = (event.target as HTMLTextAreaElement).value
        },
      })
  },
})

function setup() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/aliases/new', component: Form },
      { path: '/sign-in', component: { render: () => null } },
    ],
  })
  return router
}

beforeEach(() => {
  clearAllDrafts()
  setDraftOwner('admin')
})
afterEach(() => vi.restoreAllMocks())

async function openForm(router: ReturnType<typeof setup>) {
  await router.push('/aliases/new')
  const wrapper = mount(RouterView, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

describe('useFormDraft', () => {
  it('keeps the input when the form unmounts because the session ended, and restores it for the same account', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const router = setup()
    const wrapper = await openForm(router)
    await wrapper.get('textarea').setValue('sales@example.org')
    markSessionEnded()
    await router.push('/sign-in')
    await flushPromises()
    expect(draftCount()).toBe(1)
    setDraftOwner('admin')
    await router.push('/aliases/new')
    await flushPromises()
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('sales@example.org')
    expect(draftCount()).toBe(0)
    expect(setItem).not.toHaveBeenCalled()
  })

  it('saves nothing when the form unmounts during a normal navigation', async () => {
    const router = setup()
    const wrapper = await openForm(router)
    await wrapper.get('textarea').setValue('x@example.org')
    await router.push('/sign-in')
    await flushPromises()
    expect(draftCount()).toBe(0)
  })

  it('never restores another account’s input, and clears on an account change', async () => {
    const router = setup()
    const wrapper = await openForm(router)
    await wrapper.get('textarea').setValue('secret@example.org')
    markSessionEnded()
    await router.push('/sign-in')
    await flushPromises()
    expect(draftCount()).toBe(1)
    setDraftOwner('reseller')
    expect(draftCount()).toBe(0)
    await router.push('/aliases/new')
    await flushPromises()
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('')
  })

  it('is cleared by clearAllDrafts() (sign-out) and by clear() after a save or discard', async () => {
    const router = setup()
    const wrapper = await openForm(router)
    await wrapper.get('textarea').setValue('a@example.org')
    markSessionEnded()
    await router.push('/sign-in')
    await flushPromises()
    clearAllDrafts()
    expect(draftCount()).toBe(0)

    setDraftOwner('admin')
    await router.push('/aliases/new')
    await flushPromises()
    await wrapper.get('textarea').setValue('b@example.org')
    ;(wrapper.findComponent(Form).vm as unknown as { draft: { clear(): void } }).draft.clear()
    markSessionEnded()
    await router.push('/sign-in')
    await flushPromises()
    // A form that was saved or discarded keeps nothing, even if it unmounts afterwards.
    expect(draftCount()).toBe(0)
  })
})
