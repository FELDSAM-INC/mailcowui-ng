// UI 006 (T027, research R10, FR-036): downloads are saved as files and never opened. A download
// started by `action` must arrive as Playwright's `download` event without the page navigating and
// without a new page or tab; the helper returns the suggested file name and the saved bytes.
import { readFile } from 'node:fs/promises'

import { expect, type Page } from '@playwright/test'

export interface SavedDownload {
  fileName: string
  bytes: Buffer
}

export async function expectDownload(
  page: Page,
  action: () => Promise<unknown>,
): Promise<SavedDownload> {
  const url = page.url()
  const pages = page.context().pages().length
  const [download] = await Promise.all([page.waitForEvent('download'), action()])
  const path = await download.path()
  const bytes = await readFile(path)
  expect(page.url(), 'a download never navigates the page').toBe(url)
  expect(page.context().pages(), 'a download never opens a page').toHaveLength(pages)
  return { fileName: download.suggestedFilename(), bytes }
}

/** Runs `action` and asserts that no download starts within `timeout` milliseconds. */
export async function expectNoDownload(
  page: Page,
  action: () => Promise<unknown>,
  timeout = 1000,
): Promise<void> {
  let started = false
  const listener = () => {
    started = true
  }
  page.on('download', listener)
  try {
    await action()
    await page.waitForTimeout(timeout)
  } finally {
    page.off('download', listener)
  }
  expect(started, 'no download starts').toBe(false)
}
