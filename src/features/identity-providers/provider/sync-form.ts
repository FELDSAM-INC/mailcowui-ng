import type { IdentityProviderType } from '@/api'
import { lt } from '@/i18n'
import type { IdentitySyncSettings } from './synchronisation-api'

export type SyncSetting = keyof IdentitySyncSettings

/** Initial upstream defaults; stored providers are always read from the API. */
export function defaultSyncSettings(): IdentitySyncSettings {
  return {
    offboarding: false,
    offboardingLimit: 10,
    groupSync: false,
    groupAutocreate: true,
    groupDefaultDomain: '',
    groupPaths: [],
    idAttribute: '',
    disabledFilter: '',
    groupBaseDn: '',
    groupFilter: '',
    groupNameAttribute: 'cn',
    groupMemberMode: 'memberof',
    groupMemberAttribute: 'member',
  }
}

export function syncSections(
  type: IdentityProviderType | null | undefined,
): { id: string; fields: SyncSetting[] }[] {
  if (type !== 'ldap' && type !== 'keycloak') return []
  return [
    ...(type === 'ldap'
      ? [{ id: 'directory', fields: ['idAttribute', 'disabledFilter'] as SyncSetting[] }]
      : []),
    { id: 'offboarding', fields: ['offboarding', 'offboardingLimit'] },
    {
      id: 'groups',
      fields: [
        'groupSync',
        ...(type === 'ldap'
          ? ([
              'groupBaseDn',
              'groupFilter',
              'groupNameAttribute',
              'groupMemberMode',
              'groupMemberAttribute',
            ] as SyncSetting[])
          : (['groupPaths'] as SyncSetting[])),
        'groupAutocreate',
        'groupDefaultDomain',
      ],
    },
  ]
}

export const syncSectionTitle = (id: string, t: (key: string) => string) =>
  id === 'groups'
    ? lt('admin.iam_section_groups')
    : id === 'offboarding'
      ? lt('admin.iam_offboarding')
      : t('identitySync.sections.directory')

/** Send only fields belonging to the selected provider; preserve the draft on type switches. */
export function syncSettingsInput(
  settings: IdentitySyncSettings,
  type: IdentityProviderType,
): Partial<IdentitySyncSettings> {
  return Object.fromEntries(
    syncSections(type).flatMap(({ fields }) => fields.map((key) => [key, settings[key]])),
  )
}
