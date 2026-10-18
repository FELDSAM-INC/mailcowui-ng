// The labels of the sync-job form fields, as the classic forms have them (plan legacy form map):
// the add modals' keys on the create page, the edit page's keys on the job page. Both forms label
// some fields with the other form's key, and the edit page hard-codes "Port" (`add.port`, the same
// text). Three labels carry HTML (`edit.subfolder2`, `edit.maxage`, `edit.maxbytespersecond`) and
// are shown through the sanitiser, verbatim.
import { legacy, type LegacyRef } from '@/i18n'

import type { FormField } from './form-model'

export type FormMode = 'create' | 'edit'

const CREATE: Record<FormField, LegacyRef> = {
  remoteHost: legacy('add.hostname'),
  remotePort: legacy('add.port'),
  remoteUser: legacy('add.username'),
  remotePassword: legacy('add.password'),
  encryption: legacy('add.enc_method'),
  intervalMinutes: legacy('add.mins_interval'),
  destinationSubfolder: legacy('edit.subfolder2'),
  maxAgeDays: legacy('edit.maxage'),
  maxBytesPerSecond: legacy('edit.maxbytespersecond'),
  remoteTimeoutSeconds: legacy('edit.timeout1'),
  localTimeoutSeconds: legacy('edit.timeout2'),
  exclude: legacy('add.exclude'),
  customParameters: legacy('add.custom_params'),
  deleteDuplicatesOnDestination: legacy('add.delete2duplicates'),
  deleteFromSource: legacy('add.delete1'),
  deleteFromDestination: legacy('add.delete2'),
  automap: legacy('add.automap'),
  skipCrossDuplicates: legacy('add.skipcrossduplicates'),
  subscribeAll: legacy('add.subscribeall'),
  dryRun: legacy('add.dry'),
  active: legacy('add.active'),
}

const EDIT: Record<FormField, LegacyRef> = {
  remoteHost: legacy('edit.hostname'),
  remotePort: legacy('add.port'),
  remoteUser: legacy('edit.username'),
  remotePassword: legacy('edit.password'),
  encryption: legacy('edit.encryption'),
  intervalMinutes: legacy('edit.mins_interval'),
  destinationSubfolder: legacy('edit.subfolder2'),
  maxAgeDays: legacy('edit.maxage'),
  maxBytesPerSecond: legacy('edit.maxbytespersecond'),
  remoteTimeoutSeconds: legacy('add.timeout1'),
  localTimeoutSeconds: legacy('add.timeout2'),
  exclude: legacy('edit.exclude'),
  customParameters: legacy('add.custom_params'),
  deleteDuplicatesOnDestination: legacy('edit.delete2duplicates'),
  deleteFromSource: legacy('edit.delete1'),
  deleteFromDestination: legacy('edit.delete2'),
  automap: legacy('edit.automap'),
  skipCrossDuplicates: legacy('edit.skipcrossduplicates'),
  subscribeAll: legacy('add.subscribeall'),
  dryRun: legacy('add.dry'),
  active: legacy('edit.active'),
}

/** The owner select of the administrators' add modal. */
export const OWNER_LABEL = legacy('add.username')

export function fieldLabel(mode: FormMode, field: FormField): LegacyRef {
  return (mode === 'create' ? CREATE : EDIT)[field]
}
