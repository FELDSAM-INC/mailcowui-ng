// mailcow 2026-11 consolidated sync-job labels into `syncjobs`. Normalize older
// installation files before merging languages, preserving operator wording and translations.
import type { LegacyKey } from './legacy'

export const LEGACY_KEY_ALIASES = {
  'syncjobs.automap': ['add.automap', 'edit.automap'],
  'syncjobs.custom_params': ['add.custom_params'],
  'syncjobs.custom_params_hint': ['add.custom_params_hint'],
  'syncjobs.delete1': ['add.delete1', 'edit.delete1'],
  'syncjobs.delete2': ['add.delete2', 'edit.delete2'],
  'syncjobs.delete2duplicates': ['add.delete2duplicates', 'edit.delete2duplicates'],
  'syncjobs.dry': ['add.dry'],
  'syncjobs.exclude': ['add.exclude', 'edit.exclude'],
  'syncjobs.mins_interval': ['add.mins_interval', 'edit.mins_interval'],
  'syncjobs.skipcrossduplicates': ['add.skipcrossduplicates', 'edit.skipcrossduplicates'],
  'syncjobs.subscribeall': ['add.subscribeall'],
  'syncjobs.add': ['add.syncjob'],
  'syncjobs.add_hint': ['add.syncjob_hint'],
  'syncjobs.timeout1': ['add.timeout1', 'edit.timeout1'],
  'syncjobs.timeout2': ['add.timeout2', 'edit.timeout2'],
  'syncjobs.maxage': ['edit.maxage'],
  'syncjobs.maxbytespersecond': ['edit.maxbytespersecond'],
  'syncjobs.subfolder2': ['edit.subfolder2'],
  'syncjobs.edit': ['edit.syncjob'],
  'syncjobs.sync_jobs': ['mailbox.sync_jobs', 'user.sync_jobs'],
  'syncjobs.syncjob_check_log': ['mailbox.syncjob_check_log', 'user.syncjob_check_log'],
  'syncjobs.syncjob_last_run_result': [
    'mailbox.syncjob_last_run_result',
    'user.syncjob_last_run_result',
  ],
  'syncjobs.syncjob_EX_OK': ['mailbox.syncjob_EX_OK', 'user.syncjob_EX_OK'],
  'syncjobs.syncjob_EXIT_CONNECTION_FAILURE': [
    'mailbox.syncjob_EXIT_CONNECTION_FAILURE',
    'user.syncjob_EXIT_CONNECTION_FAILURE',
  ],
  'syncjobs.syncjob_EXIT_TLS_FAILURE': [
    'mailbox.syncjob_EXIT_TLS_FAILURE',
    'user.syncjob_EXIT_TLS_FAILURE',
  ],
  'syncjobs.syncjob_EXIT_AUTHENTICATION_FAILURE': [
    'mailbox.syncjob_EXIT_AUTHENTICATION_FAILURE',
    'user.syncjob_EXIT_AUTHENTICATION_FAILURE',
  ],
  'syncjobs.syncjob_EXIT_OVERQUOTA': [
    'mailbox.syncjob_EXIT_OVERQUOTA',
    'user.syncjob_EXIT_OVERQUOTA',
  ],
  'syncjobs.syncjob_EXIT_CONNECTION_FAILURE_HOST1': [
    'mailbox.syncjob_EXIT_CONNECTION_FAILURE_HOST1',
    'user.syncjob_EXIT_CONNECTION_FAILURE_HOST1',
  ],
  'syncjobs.syncjob_EXIT_AUTHENTICATION_FAILURE_USER1': [
    'mailbox.syncjob_EXIT_AUTHENTICATION_FAILURE_USER1',
    'user.syncjob_EXIT_AUTHENTICATION_FAILURE_USER1',
  ],
  'syncjobs.create': ['user.create_syncjob'],
} as const satisfies Partial<Record<LegacyKey, readonly string[]>>
