import { flushPromises, type VueWrapper } from '@vue/test-utils'

/** Exercise the same mobile sort menu the user sees, including its portalled content. */
export async function sortList(wrapper: VueWrapper, key: string) {
  const header = wrapper.find(`thead [data-sort="${key}"]`)
  if (header.exists()) {
    await header.trigger('click')
    await flushPromises()
    return
  }
  await wrapper.get('[data-list-columns]').trigger('keydown', { key: 'Enter' })
  await flushPromises()
  const choice = document.querySelector<HTMLElement>(`[data-sort-choice="${key}"]`)
  if (!choice) throw new Error(`Missing mobile sort choice: ${key}`)
  choice.click()
  await flushPromises()
}
