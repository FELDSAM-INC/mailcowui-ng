import { describe, expect, it } from 'vitest'
import { queryKeys } from '@/api'
import BrandLogo from '@/app/shell/BrandLogo.vue'
import { publicConfig } from '../../../mocks/scenarios/public-config'
import { mountWithApp, testPlugins } from '../../support/mount'

describe('BrandLogo preview sizing and current shell behavior (T058)', () => {
  it('preserves the compact sidebar size while accepting a candidate source', async () => {
    testPlugins().queryClient.setQueryData(queryKeys.publicConfig(), publicConfig())
    const wrapper = mountWithApp(BrandLogo, { props: { compact: true, src: 'blob:candidate' } })
    expect(wrapper.get('img').attributes('src')).toBe('blob:candidate')
    expect(wrapper.get('img').classes()).toContain('max-w-11')
    expect(wrapper.get('img').classes()).toContain('h-10')
    await wrapper.setProps({ compact: false, size: 'signIn' })
    expect(wrapper.get('img').classes()).toContain('h-12')
    expect(wrapper.get('img').classes()).toContain('max-w-full')
    wrapper.unmount()
  })
  it('recovers from a failed preview when the source changes and honors an explicit empty source', async () => {
    testPlugins().queryClient.setQueryData(queryKeys.publicConfig(), publicConfig())
    const wrapper = mountWithApp(BrandLogo, { props: { src: 'blob:broken' } })
    await wrapper.get('img').trigger('error')
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toBe('Example Mail')
    await wrapper.setProps({ src: 'blob:working' })
    expect(wrapper.get('img').attributes('src')).toBe('blob:working')
    await wrapper.setProps({ src: null })
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toBe('Example Mail')
    wrapper.unmount()
  })
})
