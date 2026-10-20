import { describe, expect, it } from 'vitest'
import ScriptEditor from '@/features/filters/components/ScriptEditor.vue'
import { mountWithApp } from '../../support/mount'

describe('Sieve script editor', () => {
  it('counts UTF-8 bytes and keeps long code inside its own scroll area', async () => {
    const wrapper = mountWithApp(ScriptEditor, { props: { modelValue: '# Ž', maxBytes: 65535 } })
    const input = wrapper.get('textarea')
    expect(input.attributes()).toMatchObject({
      wrap: 'off',
      autocapitalize: 'none',
      autocorrect: 'off',
      spellcheck: 'false',
    })
    expect(wrapper.get('[data-script-bytes]').text()).toContain('4')
    expect(wrapper.get('[data-script-bytes]').text()).toContain('65')
    await input.setValue('keep;')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['keep;'])
  })
})
