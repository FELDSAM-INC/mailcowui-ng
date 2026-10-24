<script setup lang="ts">
// The account dropdown: username/role, flagged language choices, password settings, passkeys
// and sign-out. The theme menu is a separate header control. Language names stay exactly as
// the installation supplies them; flags are decorative.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useOfferedSections } from '@/features/account'

import type { Identity } from '@/api'
import { lt, resolveText, text } from '@/i18n'
import {
  ChevronDownIcon,
  GlobeIcon,
  LockIcon,
  MailIcon,
  PasskeyIcon,
  SignOutIcon,
  UserCircleIcon,
} from '@/shared/icons'
import LegacyText from '@/shared/components/LegacyText.vue'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
} from '@/shared/ui/dropdown-menu'

import { usePreferencesStore } from '../preferences/store'
import LanguageOptions from '../preferences/LanguageOptions.vue'
import { localeFlag } from '../preferences/locale-flag'

defineProps<{ identity: Identity; signingOut?: boolean }>()
defineEmits<{ signOut: [] }>()
const { t } = useI18n()
const prefs = usePreferencesStore()
const router = useRouter()
const offered = useOfferedSections()
const passwordSections = computed(() =>
  offered.value.filter((section) => section.id === 'password' || section.id === 'recoveryEmail'),
)
const besideLanguage = useMediaQuery('(min-width: 640px)')
const currentLanguage = computed(() =>
  prefs.availableLanguages.find((language) => language.code === prefs.locale),
)
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger
      :aria-label="t('a11y.userMenu', { username: identity.username })"
      class="flex min-h-11 max-w-[14rem] min-w-11 items-center gap-2 rounded-lg px-2 text-gray-700 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-300 dark:hover:bg-white/5"
    >
      <UserCircleIcon class="size-6 shrink-0" />
      <span class="hidden truncate font-medium sm:inline">{{ identity.username }}</span>
      <ChevronDownIcon class="size-4 shrink-0" />
    </DropdownMenuTrigger>
    <DropdownMenuContent
      align="end"
      class="max-h-[80dvh] w-72 max-w-[calc(100vw-2rem)] overflow-y-auto"
    >
      <DropdownMenuLabel class="px-3 py-2">
        <LegacyText
          k="success.logged_in_as"
          :args="[identity.username]"
          class="block font-medium break-all text-gray-900 dark:text-white"
        />
        <span class="block text-sm text-gray-600 dark:text-gray-400">{{
          text(`roles.${identity.role}`)
        }}</span>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <template v-if="prefs.showLanguageChoice">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger data-language-submenu-trigger class="min-h-11 gap-2">
            <GlobeIcon />
            <span>{{ t('preferences.language') }}</span>
            <span
              data-current-language
              class="ms-auto flex min-w-0 items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-xs dark:bg-gray-800"
              :title="currentLanguage?.name"
            >
              <span class="max-w-28 truncate">{{ currentLanguage?.name ?? prefs.locale }}</span>
              <span aria-hidden="true">{{ localeFlag(prefs.locale) }}</span>
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent
              data-language-submenu
              :side-offset="besideLanguage ? 14 : -250"
              :align-offset="besideLanguage ? -3 : 44"
              :collision-padding="8"
              class="w-[250px] max-w-[calc(100vw-1rem)] p-2"
            >
              <LanguageOptions />
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
      </template>
      <DropdownMenuItem
        v-for="section in passwordSections"
        :key="section.id"
        :to="router.resolve({ name: section.route! }).fullPath"
        class="min-h-11"
      >
        <component :is="section.id === 'password' ? LockIcon : MailIcon" />
        {{ resolveText(section.title, t) }}
      </DropdownMenuItem>
      <DropdownMenuItem to="/passkeys" class="min-h-11">
        <PasskeyIcon />
        {{ t('nav.passkeys') }}
      </DropdownMenuItem>
      <DropdownMenuItem class="min-h-11" :disabled="signingOut" @select="$emit('signOut')">
        <SignOutIcon />
        {{
          signingOut
            ? lt('footer.loading')
            : t(identity.impersonation ? 'userMenu.signOutCompletely' : 'common.signOut')
        }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
