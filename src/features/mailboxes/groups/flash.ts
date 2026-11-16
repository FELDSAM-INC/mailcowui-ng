import { drafts, draftOwner } from '@/shared/composables/draft-registry'
const KEY = 'mailbox-group-deletion-warnings'
export function setDeletionWarnings(warnings: string[]) {
  drafts.set(KEY, { owner: draftOwner() ?? '', value: warnings })
}
export function takeDeletionWarnings(): string[] {
  const entry = drafts.get(KEY)
  drafts.delete(KEY)
  return entry?.owner === draftOwner() && Array.isArray(entry.value)
    ? entry.value.filter((item): item is string => typeof item === 'string')
    : []
}
