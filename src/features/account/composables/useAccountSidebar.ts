// Sidebar and account tabs use the same permission-filtered section registry.
import { computed, ref, toValue, watch, type Component, type MaybeRefOrGetter } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Identity } from '@/api'
import type { SidebarSection } from '@/app/navigation/sections'
import { legacy, loadFeatureMessages } from '@/i18n'
import {
  AtSignIcon,
  FilterIcon,
  GearIcon,
  HomeIcon,
  KeyIcon,
  LockIcon,
  LogsIcon,
  MailIcon,
  MonitorIcon,
  PasskeyIcon,
  ShieldIcon,
} from '@/shared/icons'
import type { AccountSectionId } from '../sections'
import { useOfferedSections } from './useOfferedSections'

const icons: Record<AccountSectionId, Component> = {
  overview: HomeIcon,
  mailApps: MonitorIcon,
  activeScript: FilterIcon,
  password: LockIcon,
  recoveryEmail: MailIcon,
  twoFactor: ShieldIcon,
  passkeys: PasskeyIcon,
  recentLogins: LogsIcon,
  mailSettings: GearIcon,
  temporaryAliases: AtSignIcon,
  appPasswords: KeyIcon,
  pushNotifications: MonitorIcon,
  filters: FilterIcon,
}

export function useAccountSidebar(identity: MaybeRefOrGetter<Identity | null | undefined>) {
  const route = useRoute()
  const router = useRouter()
  const enabled = computed(() => toValue(identity)?.role === 'mailboxUser')
  const offered = useOfferedSections(enabled)
  const translated = ref(false)
  watch(
    enabled,
    async (active) => {
      if (!active) return
      await loadFeatureMessages('account')
      translated.value = true
    },
    { immediate: true },
  )

  return computed<SidebarSection[]>(() =>
    enabled.value && translated.value
      ? [
          {
            id: 'userSettings',
            labelKey: legacy('header.user_settings'),
            items: offered.value.map((section) => ({
              id: `account-${section.id}`,
              labelKey: section.title,
              icon: icons[section.id],
              to: router.resolve({ name: section.route! }).fullPath,
              current: route.meta.accountSection === section.id,
              tabs: [],
            })),
          },
        ]
      : [],
  )
}
