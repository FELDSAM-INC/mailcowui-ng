import type { UiTexts, UiTextsPatch } from '@/api'

export const uiTextSections = ['names', 'login-help', 'announcement', 'footer'] as const
export type UiTextSection = (typeof uiTextSections)[number]
export const uiTextFields = {
  names: ['pageTitle', 'productName', 'appsHeading'],
  'login-help': ['loginHelpHtml'],
  announcement: ['announcement'],
  footer: ['footerHtml'],
} as const

export function uiTextPatch(
  section: UiTextSection,
  draft: UiTexts,
  base: UiTexts,
): UiTextsPatch | null {
  const patch: UiTextsPatch = {}
  if (section === 'announcement') {
    const announcement: NonNullable<UiTextsPatch['announcement']> = {}
    if (draft.announcement.type !== base.announcement.type)
      announcement.type = draft.announcement.type
    if (draft.announcement.text !== base.announcement.text)
      announcement.text = draft.announcement.text
    if (draft.announcement.active !== base.announcement.active)
      announcement.active = draft.announcement.active
    if (Object.keys(announcement).length) patch.announcement = announcement
  } else {
    for (const field of uiTextFields[section])
      if (draft[field] !== base[field]) patch[field] = draft[field]
  }
  return Object.keys(patch).length ? patch : null
}

export function uiTextErrors(
  section: UiTextSection,
  draft: UiTexts,
): Record<string, 'tooLong' | 'singleLine'> {
  const errors: Record<string, 'tooLong' | 'singleLine'> = {}
  const fields = section === 'announcement' ? ['announcement.text'] : uiTextFields[section]
  for (const field of fields) {
    const value =
      field === 'announcement.text'
        ? draft.announcement.text
        : draft[field as Exclude<keyof UiTexts, 'announcement'>]
    if ([...value].length > (section === 'names' ? 255 : 65535)) errors[field] = 'tooLong'
    else if (section === 'names' && /[\u0000-\u001f\u007f]/.test(value))
      errors[field] = 'singleLine'
  }
  return errors
}
