// UI 011 (FR-027, FR-028, T130): the release notes dialog is labelled by its title, renders the
// notes safely through the release-notes profile, and links the release page in a new window.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import ReleaseNotesDialog from '@/features/operations/dashboard/components/ReleaseNotesDialog.vue'

import { RELEASE_NOTES } from '../../../../mocks/factories/host'
import { mountWithApp } from '../../../support/mount'

describe('ReleaseNotesDialog', () => {
  it('shows the notes safely with the release page link', async () => {
    const wrapper = mountWithApp(ReleaseNotesDialog, {
      props: {
        title: 'New Release 2026-10',
        notes: RELEASE_NOTES,
        tag: '2026-10',
        url: 'https://github.com/mailcow/mailcow-dockerized/releases/tag/2026-10',
      },
      attachTo: document.body,
    })
    await vi.dynamicImportSettled()
    await flushPromises()
    await vi.dynamicImportSettled()
    await flushPromises()
    const dialog = document.querySelector('[role="dialog"]')!
    const title = dialog.querySelector('h2')!
    expect(title.textContent?.trim()).toBe('New Release 2026-10')
    expect(dialog.getAttribute('aria-labelledby')).toBe(title.id)
    const notes = dialog.querySelector('.release-notes-html')!
    expect(notes.querySelector('img, script, iframe')).toBeNull()
    expect(notes.textContent).toContain('<script>window.__releaseNotesScript = true</script>')
    const image = [...notes.querySelectorAll('a')].find((a) => a.textContent?.startsWith('Image'))!
    expect(image.textContent).toBe('Image: Release diagram (opens in a new tab)')
    expect(image.getAttribute('rel')).toBe('noopener noreferrer nofollow')
    expect(notes.querySelector('table th')?.textContent).toBe('Component')
    const github = [...dialog.querySelectorAll('a')].at(-1)!
    expect(github.getAttribute('href')).toBe(
      'https://github.com/mailcow/mailcow-dockerized/releases/tag/2026-10',
    )
    expect(github.getAttribute('target')).toBe('_blank')
    expect(dialog.textContent).toContain('Github Link:')
    wrapper.unmount()
  })
})
