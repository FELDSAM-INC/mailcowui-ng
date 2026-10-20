import { expect, it } from 'vitest'
import EditorLoadState from '@/shared/components/code-editor/EditorLoadState.vue'
import { mountWithApp } from '../../support/mount'
it('announces loading, hides internal diagnostics and offers the native editor after failure', async () => {
  const wrapper = mountWithApp(EditorLoadState)
  expect(wrapper.get('[role=status]').attributes('aria-busy')).toBe('true')
  await wrapper.setProps({ error: new Error('internal-chunk-url') })
  expect(wrapper.text()).not.toContain('internal-chunk-url')
  await wrapper.get('button').trigger('click')
  expect(wrapper.emitted('fallback')).toEqual([[]])
})
