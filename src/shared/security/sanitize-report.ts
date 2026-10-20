// Preview-only reporting stays in this lazy module. The rendered result always comes from the
// shell's sanitizer; the report is explanation, never another HTML security boundary.
import { sanitizeHtml } from './sanitize'

export const REMOVED_HTML_KINDS = [
  'scripts',
  'styles',
  'images',
  'forms',
  'frames',
  'eventHandlers',
  'links',
  'formatting',
] as const
export type RemovedHtmlKind = (typeof REMOVED_HTML_KINDS)[number]

export function sanitizeHtmlWithReport(source: string): {
  html: string
  removed: RemovedHtmlKind[]
} {
  const kinds = new Set<RemovedHtmlKind>()
  // These elements are discarded before DOMPurify visits the body: styles by defangForParsing,
  // scripts in the document head by its inert parser. The raw tags never enter a live document.
  if (/<(?:[\w-]+:)?script\b/i.test(source)) kinds.add('scripts')
  if (/<style\b/i.test(source)) kinds.add('styles')
  const html = sanitizeHtml(source, (removed) => {
    for (const entry of removed) {
      if ('element' in entry && entry.element) {
        const name = entry.element.nodeName.toLowerCase()
        if (name === 'body') continue
        if (name === 'script') kinds.add('scripts')
        else if (name === 'style') kinds.add('styles')
        else if (name === 'img' || name === 'picture') kinds.add('images')
        else if (['form', 'input', 'button', 'textarea', 'select'].includes(name))
          kinds.add('forms')
        else if (['iframe', 'frame', 'object', 'embed'].includes(name)) kinds.add('frames')
        else kinds.add('formatting')
      } else if ('attribute' in entry && entry.attribute) {
        const name = entry.attribute.name.toLowerCase()
        if (name.startsWith('on') || name.startsWith('data-removed-on')) kinds.add('eventHandlers')
        else if (name === 'style' || name === 'data-removed-style') kinds.add('styles')
        else if (name === 'href') kinds.add('links')
        else kinds.add('formatting')
      }
    }
  })
  return { html, removed: REMOVED_HTML_KINDS.filter((kind) => kinds.has(kind)) }
}
