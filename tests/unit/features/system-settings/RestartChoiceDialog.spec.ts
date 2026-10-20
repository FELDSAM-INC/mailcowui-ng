import { expect, it } from 'vitest'
import { loadFeatureMessages } from '@/i18n'
import RestartChoiceDialog from '@/features/system-settings/components/mail-filtering/RestartChoiceDialog.vue'
import { mountWithApp } from '../../support/mount'
it('defaults to restart now and reports only explicit changes, with an empty-script explanation', async () => {
  await loadFeatureMessages('system-settings')
  const wrapper = mountWithApp(RestartChoiceDialog, { props: { empty: true } })
  expect((wrapper.get('input[value=now]').element as HTMLInputElement).checked).toBe(true)
  expect(wrapper.emitted('choice')).toBeUndefined()
  expect(wrapper.text()).toContain('An empty script means no global filter')
  await wrapper.get('input[value=later]').setValue()
  expect(wrapper.emitted('choice')).toEqual([[true]])
  await wrapper.get('input[value=now]').setValue()
  expect(wrapper.emitted('choice')).toEqual([[true], [false]])
  await wrapper.setProps({ empty: false })
  expect(wrapper.find('[data-empty-script]').exists()).toBe(false)
})
