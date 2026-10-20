export const resetPlaceholders = [
  'link',
  'username',
  'username2',
  'date',
  'token_lifetime',
  'hostname',
] as const
export type ResetSamples = Partial<Record<(typeof resetPlaceholders)[number], string>>
const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
export function replaceResetSamples(
  template: string,
  samples: ResetSamples,
  html: boolean,
): string {
  return template.replace(
    /\{\{(link|username|username2|date|token_lifetime|hostname)\}\}/g,
    (original, key: keyof ResetSamples) => {
      const value = samples[key]
      return value === undefined ? original : html ? escapeHtml(value) : value
    },
  )
}
