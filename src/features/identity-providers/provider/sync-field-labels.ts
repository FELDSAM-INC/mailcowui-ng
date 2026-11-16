import type { LegacyKey } from '@/i18n'
import type { IdentitySyncSettings } from './synchronisation-api'

export const syncFieldLabels = {
  offboarding: 'admin.iam_offboarding',
  offboardingLimit: 'admin.iam_offboarding_limit',
  groupSync: 'admin.iam_group_sync',
  groupAutocreate: 'admin.iam_group_autocreate',
  groupDefaultDomain: 'admin.iam_group_default_domain',
  groupPaths: 'admin.iam_group_paths',
  idAttribute: 'admin.iam_id_attribute',
  disabledFilter: 'admin.iam_disabled_filter',
  groupBaseDn: 'admin.iam_group_basedn',
  groupFilter: 'admin.iam_group_filter',
  groupNameAttribute: 'admin.iam_group_name_attribute',
  groupMemberMode: 'admin.iam_group_member_mode',
  groupMemberAttribute: 'admin.iam_group_member_attribute',
} as const satisfies Record<keyof IdentitySyncSettings, LegacyKey>

export const syncFieldHelp: Partial<Record<keyof IdentitySyncSettings, LegacyKey>> = {
  offboarding: 'admin.iam_offboarding_info',
  offboardingLimit: 'admin.iam_offboarding_limit_info',
  groupSync: 'admin.iam_group_sync_info',
  groupAutocreate: 'admin.iam_group_autocreate_info',
  groupDefaultDomain: 'admin.iam_group_default_domain_info',
  groupPaths: 'admin.iam_group_paths_info',
  idAttribute: 'admin.iam_id_attribute_info',
  disabledFilter: 'admin.iam_disabled_filter_info',
  groupMemberAttribute: 'admin.iam_group_member_attribute_info',
}
