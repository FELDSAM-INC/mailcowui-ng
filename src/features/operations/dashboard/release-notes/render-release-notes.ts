// Release notes as HTML (research R9, FR-028): externally authored Markdown rendered by `marked`,
// imported only when notes are opened (its own chunk), with three renderer overrides — raw HTML
// is escaped and shown as text, an image becomes a link labelled with its description (it is never
// loaded), and a link keeps only an http(s) or mailto target (any other link is its text). The
// result is sanitised again by `SanitizedHtml` with the `releaseNotes` profile.
import { escapeHtml } from '@/i18n/legacy-format'

export interface ReleaseNotesTexts {
  image: (description: string) => string
  imageUntitled: string
}

function linkTarget(href: string | null | undefined): string | null {
  if (!href) return null
  try {
    const url = new URL(href.trim())
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : null
  } catch {
    return null
  }
}

export async function renderReleaseNotes(
  markdown: string,
  texts: ReleaseNotesTexts,
): Promise<string> {
  const { Marked } = await import('marked')
  const marked = new Marked({ gfm: true, breaks: false, async: false })
  marked.use({
    renderer: {
      html({ text }) {
        return escapeHtml(text)
      },
      image({ href, text }) {
        const label = text ? texts.image(text) : texts.imageUntitled
        const target = linkTarget(href)
        return target
          ? `<a href="${escapeHtml(target)}">${escapeHtml(label)}</a>`
          : escapeHtml(label)
      },
      link({ href, tokens }) {
        const inner = this.parser.parseInline(tokens)
        const target = linkTarget(href)
        return target ? `<a href="${escapeHtml(target)}">${inner}</a>` : inner
      },
    },
  })
  return marked.parse(markdown, { async: false })
}
