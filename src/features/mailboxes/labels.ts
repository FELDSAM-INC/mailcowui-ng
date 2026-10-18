// Translation keys built from enumeration values (data-model §9). Their values are required in
// full by `src/i18n/coverage.json` ("complete"); `text()` shows mailcow's own text where
// `LEGACY_TEXTS` names one (statuses, most sort fields), and the new string otherwise.
import type {
  MailboxRenameStep,
  MailboxStatus,
  componentsParametersMailboxSortValues,
  mailboxDeletionPreviewBlockersDependencyValues,
} from '@/api'

export type MailboxSort = (typeof componentsParametersMailboxSortValues)[number]
export type BlockerDependency = (typeof mailboxDeletionPreviewBlockersDependencyValues)[number]

export const statusLabelKey = (status: MailboxStatus) => `mailboxes.status.${status}`
export const sortLabelKey = (sort: MailboxSort) => `mailboxes.sort.${sort}`
export const renameStepKey = (step: MailboxRenameStep['step']) => `mailboxes.rename.step.${step}`
export const renameOutcomeKey = (outcome: MailboxRenameStep['outcome']) =>
  `mailboxes.rename.outcome.${outcome}`
export const blockerKey = (dependency: BlockerDependency) =>
  `mailboxes.delete.blocker.${dependency}`
