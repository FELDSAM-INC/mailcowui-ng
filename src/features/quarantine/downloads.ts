// Downloads of a quarantined message and its attachments (UI 006 research R10, FR-036 to FR-038):
// fetched through the API client and saved as files with the name the API gives (fallbacks
// `quarantine-<itemId>.eml` and `attachment-<position>`), never displayed. A virus-flagged item
// warns first; Cancel downloads nothing. A refusal rejects with the client's ApiProblem.
import type { QuarantineAttachment, QuarantineItem } from '@/api'
import { saveApiFile } from '@/shared/platform/download'

import { fetchAttachmentFile, fetchMessageFile } from './api'
import { askVirusDownload } from './confirmations'

type DownloadItem = Pick<QuarantineItem, 'id' | 'virus'>

export const messageFallbackName = (itemId: number) => `quarantine-${itemId}.eml`
export const attachmentFallbackName = (position: number) => `attachment-${position}`

/** Saves the whole message; resolves with the saved name, or null when the user cancelled. */
export async function saveMessage(
  item: DownloadItem,
  ask: () => Promise<boolean> = askVirusDownload,
): Promise<string | null> {
  if (item.virus && !(await ask())) return null
  return saveApiFile(() => fetchMessageFile(item.id), messageFallbackName(item.id))
}

/** Saves one attachment; resolves with the saved name, or null when the user cancelled. */
export async function saveAttachment(
  item: DownloadItem,
  attachment: Pick<QuarantineAttachment, 'position'>,
  ask: () => Promise<boolean> = askVirusDownload,
): Promise<string | null> {
  if (item.virus && !(await ask())) return null
  return saveApiFile(
    () => fetchAttachmentFile(item.id, attachment.position),
    attachmentFallbackName(attachment.position),
  )
}
