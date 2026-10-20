import { QueryClient } from '@tanstack/vue-query'
import { afterEach, describe, expect, it } from 'vitest'
import { queryKeys } from '@/api'
import { installBrandColors } from '@/app/branding/brand-colors'
import { publicConfig } from '../../../mocks/scenarios/public-config'

const cleanups: (() => void)[] = []
afterEach(() => {
  cleanups.splice(0).forEach((fn) => fn())
  document.documentElement.removeAttribute('style')
})
describe('runtime brand colours', () => {
  it('sets all six properties, follows refreshed configuration, and removes absent colours', () => {
    const client = new QueryClient(),
      root = document.documentElement
    const config = publicConfig('default')
    config.brandColors = {
      light: { color: '#1d4ed8', foreground: '#ffffff' },
      dark: { color: '#60a5fa', foreground: '#000000' },
    }
    client.setQueryData(queryKeys.publicConfig(), config)
    cleanups.push(installBrandColors(client))
    expect(root.style.getPropertyValue('--brand-light')).toBe('#1d4ed8')
    expect(root.style.getPropertyValue('--brand-light-foreground')).toBe('#ffffff')
    expect(root.style.getPropertyValue('--brand-light-hover')).toBe('#1a45be')
    expect(root.style.getPropertyValue('--brand-dark')).toBe('#60a5fa')
    expect(root.style.getPropertyValue('--brand-dark-foreground')).toBe('#000000')
    expect(root.style.getPropertyValue('--brand-dark-hover')).toBe('#73b0fb')
    client.setQueryData(queryKeys.publicConfig(), {
      ...config,
      brandColors: { light: config.brandColors.light, dark: null },
    })
    expect(root.style.getPropertyValue('--brand-dark')).toBe('')
    expect(root.style.getPropertyValue('--brand-dark-foreground')).toBe('')
    expect(root.style.getPropertyValue('--brand-dark-hover')).toBe('')
    client.setQueryData(queryKeys.publicConfig(), { ...config, brandColors: undefined })
    expect(root.style.getPropertyValue('--brand-light')).toBe('')
    client.setQueryData(queryKeys.publicConfig(), config)
    client.removeQueries({ queryKey: queryKeys.publicConfig() })
    expect(root.style.getPropertyValue('--brand-light')).toBe('')
  })
  it('does not subscribe twice on bootstrap retry and stops updating after disposal', () => {
    const client = new QueryClient(),
      root = document.documentElement
    const cleanup = installBrandColors(client)
    expect(installBrandColors(client)).toBe(cleanup)
    cleanup()
    client.setQueryData(queryKeys.publicConfig(), {
      ...publicConfig('default'),
      brandColors: { light: { color: '#1d4ed8', foreground: '#ffffff' }, dark: null },
    })
    expect(root.style.getPropertyValue('--brand-light')).toBe('')
  })
})
