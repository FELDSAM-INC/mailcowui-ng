import { beforeEach, describe, expect, it } from 'vitest'
import { hasMessage, loadFeatureMessages, text } from '@/i18n'
import { violationMessage } from '@/i18n/problems'

beforeEach(() => loadFeatureMessages('system-settings'))
describe('brand colour refusal', () => {
  it.each([
    ['en-gb', '4.42', '4.5'],
    ['cs-cz', '4,42', '4,5'],
  ])('keeps the API ratio, minimum and surface in %s', (locale, ratio, minimum) => {
    const message = violationMessage(
      {
        code: 'insufficientContrast',
        message: 'Server diagnostic',
        params: { ratio: 4.42, minimum: 4.5, surface: '#ffffff' },
      },
      { t: text, te: hasMessage, locale },
    )
    expect(message).toContain(`${ratio}:1`)
    expect(message).toContain(`${minimum}:1`)
    expect(message).toContain('#ffffff')
    expect(message).not.toContain('Server diagnostic')
  })
})
