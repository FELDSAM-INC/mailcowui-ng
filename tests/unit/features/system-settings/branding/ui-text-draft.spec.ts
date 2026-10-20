import { describe, expect, it } from 'vitest'
import { uiTextPatch, uiTextErrors } from '@/features/system-settings/lib/ui-text-draft'
import { brandingState } from '../../../../mocks/scenarios/settings-branding'
import { useScenario } from '../../../../mocks/node'

describe('UI text section drafts', () => {
  it('patches only changed fields in this section, including individual announcement properties', () => {
    const base = brandingState(useScenario('ui-texts-custom')).texts
    const draft = structuredClone(base)
    draft.productName = 'New name'
    draft.footerHtml = 'Unrelated'
    expect(uiTextPatch('names', draft, base)).toEqual({ productName: 'New name' })
    draft.announcement.active = false
    expect(uiTextPatch('announcement', draft, base)).toEqual({ announcement: { active: false } })
    expect(uiTextPatch('login-help', draft, base)).toBeNull()
  })
  it('checks code-point limits and rejects pasted controls without stripping the draft', () => {
    const base = brandingState(useScenario('ui-texts-custom')).texts
    expect(
      uiTextErrors('names', { ...base, productName: 'Name\nsecond', pageTitle: 'x'.repeat(256) }),
    ).toEqual({ pageTitle: 'tooLong', productName: 'singleLine' })
    expect(uiTextErrors('names', { ...base, pageTitle: '😀'.repeat(255) })).toEqual({})
    expect(uiTextErrors('footer', { ...base, footerHtml: 'x'.repeat(65536) })).toEqual({
      footerHtml: 'tooLong',
    })
    expect(
      uiTextErrors('announcement', {
        ...base,
        announcement: { ...base.announcement, text: 'x'.repeat(65536) },
      }),
    ).toEqual({ 'announcement.text': 'tooLong' })
  })
})
